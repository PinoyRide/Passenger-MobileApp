import usePostRequest from '@/Services/Api';
import { Constants } from '@/Utils';
import React, { useEffect, useState } from 'react';
import { ON_PRIMARY_BUTTON_TEXT } from '@/Theme';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { modern } from '@/Theme/modern';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomSpace } from '@/Utils/bottomSpace';

const PromoModal = ({
  visible,
  onClose,
  onSelect,
  selectedPromo = null,
  availablePromos = [],
  isLoading = false,
}) => {
  // The navigation bar may cover the bottom of the screen: keep the bottom content clear of it
  const { bottom: bottomInset } = useSafeAreaInsets();
  const theme = useTheme();
  const { colors } = theme;
  const styles = getStyles({ colors, dark: theme.dark, look: modern(theme) });

  const [promoCode, setPromoCode] = useState('');
  const [checkedPromo, setCheckedPromo] = useState(null);
  const [checkError, setCheckError] = useState('');

  const checkPromoCode = usePostRequest();

  const handleSelectPromo = promo => {
    onSelect?.(promo);
    onClose?.();
  };

  // Trigger check promo code
  const triggerCheckPromoCode = () => {
    if (!promoCode.trim()) {
      setCheckError('Please enter a promo code');
      return;
    }

    setCheckError('');
    setCheckedPromo(null);

    const postdata = {
      promo_code: promoCode.trim(),
    };
    checkPromoCode.makePostRequest(
      Constants.ENDPOINT.CHECK_PROMO_CODE,
      postdata,
    );
  };

  const handleCheckPromoCode = () => {
    if (checkPromoCode.error) {
      setCheckError(checkPromoCode.error);
      setCheckedPromo(null);
      return;
    }

    if (!checkPromoCode.response) {
      return;
    }

    const results = checkPromoCode.response;

    if (results?.code === 200 && results?.data) {
      setCheckedPromo(results.data);
      setCheckError('');
      // Auto-select the found promo
      onSelect?.(results.data);
    } else {
      setCheckError(results?.message || 'Promo code not found');
      setCheckedPromo(null);
    }
  };

  useEffect(() => {
    handleCheckPromoCode();
  }, [checkPromoCode.response, checkPromoCode.error]);

  // Reset states when modal closes
  useEffect(() => {
    if (!visible) {
      setPromoCode('');
      setCheckedPromo(null);
      setCheckError('');
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View
        style={[
          styles.modalContainer,
          { paddingBottom: bottomSpace(bottomInset, 34) },
        ]}>
        <Text style={styles.title}>Select Promo</Text>

        <View style={styles.inputWrapper}>
          <View style={styles.searchRow}>
            <TextInput
              value={promoCode}
              onChangeText={text => {
                setPromoCode(text);
                setCheckError('');
                setCheckedPromo(null);
              }}
              placeholder="Enter Promo Code"
              placeholderTextColor="#999"
              style={styles.input}
            />
            <TouchableOpacity
              onPress={triggerCheckPromoCode}
              disabled={checkPromoCode.loading || !promoCode.trim()}
              style={[
                styles.checkButton,
                (checkPromoCode.loading || !promoCode.trim()) &&
                  styles.checkButtonDisabled,
              ]}>
              <Text style={styles.checkButtonText}>Check</Text>
            </TouchableOpacity>
          </View>

          {checkPromoCode.loading && (
            <View style={styles.checkingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.checkingText}>Checking promo code...</Text>
            </View>
          )}

          {checkError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{checkError}</Text>
            </View>
          )}

          {checkedPromo && (
            <View style={styles.successContainer}>
              <View style={styles.successHeader}>
                <Text style={styles.successTitle}>✓ Valid Promo Code</Text>
              </View>
              <View style={styles.promoDetailsCard}>
                <Text style={styles.promoCode}>{checkedPromo.code}</Text>
                <Text style={styles.promoTitle}>{checkedPromo.name}</Text>
                <View style={styles.promoDetails}>
                  <Text style={styles.promoDetailText}>
                    Valid:{' '}
                    {checkedPromo.start_date_pretty || checkedPromo.start_date}{' '}
                    - {checkedPromo.end_date_pretty || checkedPromo.end_date}
                  </Text>
                  {checkedPromo.location && (
                    <Text style={styles.promoDetailText}>
                      Location: {checkedPromo.location}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Available Promos</Text>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading promos...</Text>
          </View>
        ) : availablePromos.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No promos available</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.promoList}
            showsVerticalScrollIndicator={false}>
            {availablePromos.map(promo => (
              <TouchableOpacity
                key={promo.id}
                style={[
                  styles.promoOption,
                  selectedPromo?.id === promo.id && styles.promoSelected,
                ]}
                onPress={() => handleSelectPromo(promo)}>
                <View style={styles.promoHeader}>
                  <Text style={styles.promoCodeList}>{promo.code}</Text>
                  {promo.status === 1 && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.badgeText}>Active</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.promoTitle}>{promo.name}</Text>
                <View style={styles.promoDetails}>
                  <Text style={styles.promoDetailText}>
                    Valid: {promo.start_date_pretty} - {promo.end_date_pretty}
                  </Text>
                  {promo.location && (
                    <Text style={styles.promoDetailText}>
                      Location: {promo.location}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {selectedPromo && (
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => {
              onSelect?.(null);
              onClose?.();
            }}>
            <Text style={styles.removeText}>Remove Promo</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
};

export default PromoModal;

// The Figma colours in the light look; the shared look's (Theme/modern.js) in
// the dark one (Settings > Dark mode).
const getStyles = ({ colors, dark, look }) => {
  const pick = (light, darkValue) => (dark ? darkValue : light);
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: pick('#D9D9D9', look.surface),
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 34,
      maxHeight: '80%',
    },
    title: {
      fontFamily: 'Poppins Medium',
      fontSize: 22,
      marginBottom: 20,
      color: pick('#000', look.ink),
    },
    inputWrapper: {
      marginBottom: 16,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    input: {
      flex: 1,
      backgroundColor: pick('#FFFFFF', look.card),
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      fontFamily: 'Poppins Regular',
      color: pick('#000', look.ink),
      borderWidth: 1,
      borderColor: pick('#E0E0E0', look.hairline),
    },
    checkButton: {
      height: 50,
      paddingHorizontal: 20,
      backgroundColor: colors.primary,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      minWidth: 80,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    checkButtonDisabled: {
      backgroundColor: colors.grey3,
    },
    checkButtonText: {
      fontSize: 16,
      fontFamily: 'Poppins SemiBold',
      color: ON_PRIMARY_BUTTON_TEXT,
      includeFontPadding: false,
      textAlignVertical: 'center',
    },
    checkingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      gap: 8,
    },
    checkingText: {
      fontSize: 13,
      fontFamily: 'Poppins Regular',
      color: pick('#666', look.muted),
    },
    errorContainer: {
      marginTop: 8,
      padding: 10,
      backgroundColor: pick('#FFEBEE', look.redSoft),
      borderRadius: 6,
      borderLeftWidth: 3,
      borderLeftColor: pick('#DC3545', look.danger),
    },
    errorText: {
      fontSize: 13,
      fontFamily: 'Poppins Regular',
      color: pick('#DC3545', look.danger),
    },
    successContainer: {
      marginTop: 8,
    },
    successHeader: {
      marginBottom: 8,
    },
    successTitle: {
      fontSize: 14,
      fontFamily: 'Poppins Medium',
      color: pick('#4CAF50', look.success),
    },
    promoDetailsCard: {
      backgroundColor: pick('#FFFFFF', look.card),
      padding: 12,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: colors.primary || '#FEC107',
    },
    promoCode: {
      fontSize: 16,
      fontFamily: 'Poppins SemiBold',
      color: colors.primary || '#FEC107',
      marginBottom: 2,
    },
    sectionTitle: {
      fontFamily: 'Poppins Medium',
      fontSize: 16,
      marginBottom: 12,
      color: pick('#000', look.ink),
    },
    promoList: {
      maxHeight: 250,
    },
    promoOption: {
      backgroundColor: pick('#FFFFFF', look.card),
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 8,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: pick('#E0E0E0', look.hairline),
    },
    promoSelected: {
      backgroundColor: pick('#FFF9E6', look.chip),
      borderColor: colors.primary || '#FEC107',
      borderWidth: 1.5,
    },
    promoHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    promoCodeList: {
      fontSize: 15,
      fontFamily: 'Poppins SemiBold',
      color: colors.primary || '#FEC107',
    },
    activeBadge: {
      backgroundColor: '#4CAF50',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    badgeText: {
      fontSize: 11,
      fontFamily: 'Poppins Medium',
      color: '#FFFFFF',
    },
    promoTitle: {
      fontSize: 14,
      fontFamily: 'Poppins Medium',
      color: pick('#000', look.ink),
      lineHeight: 20,
      marginBottom: 6,
    },
    promoDetails: {
      gap: 2,
    },
    promoDetailText: {
      fontSize: 12,
      fontFamily: 'Poppins Regular',
      color: pick('#666', look.muted),
    },
    removeButton: {
      marginTop: 16,
      alignItems: 'center',
      paddingVertical: 8,
    },
    removeText: {
      fontSize: 15,
      fontFamily: 'Poppins Medium',
      color: colors.error || '#DC3545',
    },
    loadingContainer: {
      paddingVertical: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      fontFamily: 'Poppins Regular',
      color: pick('#666', look.muted),
    },
    emptyContainer: {
      paddingVertical: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      fontSize: 14,
      fontFamily: 'Poppins Regular',
      color: pick('#666', look.muted),
    },
  });
};
