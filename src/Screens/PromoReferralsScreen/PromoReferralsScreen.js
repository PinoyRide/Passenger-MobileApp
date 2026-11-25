import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import Clipboard from '@react-native-clipboard/clipboard';
import usePostRequest from '@/Services/Api';
import { Constants } from '@/Utils';
import { markPromosSeen } from '@/Redux/Slices/userSlice';

// Referrals are hidden until a real programme exists (the owner, A-188,
// 2026-11-26: "no referral programme planned yet"). The part below showed the
// same made-up code to everyone, and nothing paid the promised credits. It is
// kept, switched off, for when the programme is built. The promos stay: they
// are real (the list, the "NEW" badge on the Account page).
// noReferralEntry.test.mjs fails if this is turned back on.
const SHOW_REFERRALS = false;

const PromoReferralsScreen = () => {
  const { colors } = useTheme();
  const styles = getStyles({ colors });
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const promoRequest = usePostRequest();
  const [promos, setPromos] = useState([]);

  // The promos open to this passenger. Seeing them here is what takes the
  // "NEW" badge off the Account page.
  useEffect(() => {
    let showing = true;
    (async () => {
      const { response } = await promoRequest.makePostRequest(
        Constants.ENDPOINT.GET_PROMO_LIST,
        {},
      );
      const list = response?.data?.promos;
      if (showing && Array.isArray(list)) {
        setPromos(list);
        dispatch(markPromosSeen(list.map(promo => promo.id)));
      }
    })();
    return () => {
      showing = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // This will later come from API
  const [referralCode] = useState('4F45HFA9AS');

  const handleBack = () => {
    navigation.replace('SettingsScreen');
  };

  const handleCopy = () => {
    Clipboard.setString(referralCode);
    // Optional: show a toast/snackbar later
    // AppUtil.showToast('Referral code copied!');
  };

  const renderPromoItem = ({ item }) => {
    return (
      <View style={styles.promoCard}>
        <Text style={styles.promoName}>{item.name || item.code}</Text>
        <Text style={styles.promoMeta}>
          {`Code ${item.code}`}
          {item.end_date ? ` · until ${item.end_date}` : ''}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={handleBack} style={styles.iconButton}>
            <Image
              source={require('@/Assets/Common/Back_2.png')}
              style={styles.backIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Promos</Text>
          <View style={styles.spacing} />
        </View>
      </View>

      {/* Contents */}
      <View style={styles.contents}>
        <Text style={styles.title}>Promotion</Text>

        {/* Promo Card FlatList */}
        <FlatList
          data={promos}
          renderItem={renderPromoItem}
          keyExtractor={(item, index) => String(item.id ?? index)}
          contentContainerStyle={styles.promoList}
          ListEmptyComponent={
            <Text style={styles.subtitle}>No promos right now.</Text>
          }
          showsVerticalScrollIndicator={false}
        />

        {SHOW_REFERRALS && (
          <>
            <View style={styles.divider} />

            <Text style={styles.title}>Referrals</Text>
            <Text style={styles.subtitle}>
              Invite your friends and earn ride credits! They will get discounts
              too when they sign up using your code.
            </Text>

            <TouchableOpacity style={styles.referralCard} onPress={handleCopy}>
              <View style={styles.row}>
                <Text style={styles.label}>Referral Code:</Text>
                <Text style={styles.code}>{referralCode}</Text>
                <Text style={styles.copy}>Copy</Text>
              </View>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

export default PromoReferralsScreen;

const getStyles = ({ colors }) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerContainer: {
      backgroundColor: colors.primary,
      paddingTop: 60,
      paddingBottom: 20,
      paddingHorizontal: 20,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    iconButton: {
      width: 25,
    },
    spacing: {
      width: 25,
    },
    backIcon: {
      width: 23,
      height: 23,
    },
    headerTitle: {
      fontFamily: 'Poppins Regular',
      fontSize: 16,
      fontWeight: '400',
      color: colors.onPrimary,
      textAlign: 'center',
      flex: 1,
    },
    contents: {
      paddingHorizontal: 30,
      paddingVertical: 20,
    },
    title: {
      fontFamily: 'Poppins Medium',
      fontWeight: '500',
      fontSize: 16,
      color: colors.text,
    },
    subtitle: {
      fontFamily: 'Poppins Regular',
      fontWeight: '400',
      fontSize: 12,
      color: colors.grey4,
      marginTop: 6,
    },
    divider: {
      borderBottomWidth: 0.5,
      borderBottomColor: colors.grey5,
      marginVertical: 10,
    },
    referralCard: {
      backgroundColor: colors.card,
      padding: 16,
      marginVertical: 20,
      borderRadius: 12,
      elevation: 3,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    label: {
      fontFamily: 'Poppins Regular',
      fontSize: 14,
      fontWeight: '400',
      marginRight: 8,
      color: colors.text,
    },
    code: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 14,
      color: colors.text,
    },
    copy: {
      fontFamily: 'Poppins Regular',
      fontSize: 8,
      color: colors.blue,
      marginLeft: 5,
      marginTop: -2,
      alignSelf: 'flex-start',
    },

    // Promo styles
    promoList: {
      marginTop: 10,
      gap: 10,
    },
    promoCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      overflow: 'hidden',
      elevation: 3,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      marginBottom: 10,
    },
    promoName: {
      paddingHorizontal: 16,
      paddingTop: 14,
      fontFamily: 'Poppins Medium',
      fontSize: 15,
      color: colors.text,
    },
    promoMeta: {
      paddingHorizontal: 16,
      paddingTop: 2,
      paddingBottom: 14,
      fontFamily: 'Poppins Regular',
      fontSize: 12,
      color: colors.grey4,
    },
  });
