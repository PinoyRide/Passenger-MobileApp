// src/Components/RiderFoundAlertBox.js
import React from 'react';
import { ON_PRIMARY_BUTTON_TEXT } from '@/Theme';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { AppButton } from '@/Components';

const RiderFoundAlertBox = ({
  visible,
  onClose,
  riderName,
  plateNumber,
  vehicle,
  imageSource,
}) => {
  const { colors } = useTheme();
  const styles = getStyles({ colors });

  if (!visible) {
    return null;
  }

  return (
    <Pressable style={styles.backdrop} onPress={onClose}>
      <View style={styles.container}>
        <Text style={styles.title}>Congratulations</Text>
        <Text style={styles.subtitle}>We found you a Rider!</Text>
        <Image
          source={imageSource}
          style={styles.profileImage}
          resizeMode="contain"
        />
        <Text style={styles.riderName}>{riderName}</Text>
        <Text style={styles.plateNumber}>{plateNumber}</Text>
        <Text style={styles.vehicle}>{vehicle}</Text>
        <AppButton
          title="Okay"
          textColor={ON_PRIMARY_BUTTON_TEXT}
          onPress={onClose}
          isBold
          noSpacing
          featureStyle={styles.okayButton}
        />
      </View>
    </Pressable>
  );
};

export default RiderFoundAlertBox;

const getStyles = ({ colors }) =>
  StyleSheet.create({
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 20,
    },
    container: {
      width: 321,
      paddingVertical: 26,
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 20,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 5,
    },
    title: {
      fontSize: 16,
      fontFamily: 'Poppins SemiBold',
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 16,
      color: colors.text,
      fontFamily: 'Poppins Regular',
      marginBottom: 15,
    },
    profileImage: {
      width: 124,
      height: 124,
      borderRadius: 32,
      marginBottom: 12,
      backgroundColor: colors.surfaceVariant,
    },
    riderName: {
      fontSize: 14,
      fontFamily: 'Poppins SemiBold',
      color: colors.text,
      marginBottom: 4,
    },
    plateNumber: {
      fontSize: 14,
      fontFamily: 'Poppins SemiBold',
      color: colors.text,
    },
    vehicle: {
      fontSize: 16,
      fontFamily: 'Poppins Regular',
      color: colors.text,
      marginBottom: 20,
    },
    // same pill as AdvanceBookingAcceptedModal "Okay"
    okayButton: {
      width: 266,
      height: 47,
      borderRadius: 23.5,
      elevation: 0,
      shadowOpacity: 0,
      marginTop: 0,
    },
  });
