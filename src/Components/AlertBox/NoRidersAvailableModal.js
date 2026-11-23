import React from 'react';
import { ON_PRIMARY_BUTTON_TEXT } from '@/Theme';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon, useTheme } from 'react-native-paper';
import { modern } from '@/Theme/modern';

// Figma frame 120 (node 296-3698): shown when no rider accepted within 5 min.
const NoRidersAvailableModal = ({
  visible,
  onTryAgain,
  onCancelBooking,
  loading = false,
  errorText = '',
}) => {
  const theme = useTheme();
  const styles = getStyles(theme.dark, modern(theme));
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card} testID="no-riders-modal">
          <Icon source="emoticon-sad-outline" size={56} color="#FFC107" />
          <Text style={styles.title}>No Riders Available</Text>
          <Text style={styles.body}>
            Sorry, no riders have accepted your booking yet. You can try again
            or cancel your booking.
          </Text>
          {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
          <TouchableOpacity
            style={[styles.pill, styles.primary]}
            disabled={loading}
            onPress={onTryAgain}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryText}>Try Again</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pill, styles.secondary]}
            disabled={loading}
            onPress={onCancelBooking}>
            <Text style={styles.secondaryText}>Cancel Booking</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default NoRidersAvailableModal;

// The Figma colours in the light look; the dark look's card and words in the
// dark one (Settings > Dark mode).
const getStyles = (dark, look) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    card: {
      width: 300,
      maxWidth: '100%',
      backgroundColor: look.card,
      borderRadius: 12,
      paddingHorizontal: 24,
      paddingVertical: 24,
      alignItems: 'center',
    },
    title: {
      fontFamily: 'Poppins SemiBold',
      fontWeight: '600',
      fontSize: 17,
      color: dark ? look.ink : '#333333',
      marginTop: 10,
    },
    body: {
      fontFamily: 'Poppins Regular',
      fontSize: 12,
      lineHeight: 18,
      color: dark ? look.muted : '#7C7C7C',
      textAlign: 'center',
      marginTop: 6,
      marginBottom: 14,
    },
    error: {
      fontFamily: 'Poppins Regular',
      fontSize: 12,
      color: '#E4423F',
      textAlign: 'center',
      marginBottom: 10,
    },
    pill: {
      alignSelf: 'stretch',
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    primary: { backgroundColor: '#FFC107' },
    secondary: { backgroundColor: '#FFE08A' },
    primaryText: {
      fontFamily: 'Poppins Medium',
      fontSize: 14,
      color: ON_PRIMARY_BUTTON_TEXT,
    },
    secondaryText: {
      fontFamily: 'Poppins Medium',
      fontSize: 14,
      color: '#5A4A00',
    },
  });
