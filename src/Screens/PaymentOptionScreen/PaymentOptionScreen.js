import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from 'react-native-paper';

// How a ride is paid (the owner, 2026-11-23: "starting on pinoy ride wallet if
// there is enough balance"): the booking sheet starts on the wallet when its
// balance covers the fare (src/Utils/startingPayment.js), on cash otherwise.
// This page says so; the choice itself is made on the booking sheet.
const METHODS = [
  {
    label: 'PinoyRide Wallet',
    note: 'Used first when your balance covers the fare',
    icon: require('@/Assets/Common/HomeScreen/PaymentMethodModal/Wallet.png'),
  },
  {
    label: 'Cash',
    note: 'When it does not, and for advance bookings',
    icon: require('@/Assets/Common/HomeScreen/PaymentMethodModal/Cash.png'),
  },
];

const PaymentOptionScreen = () => {
  const { colors } = useTheme();
  const styles = getStyles({ colors });
  const navigation = useNavigation();

  const handleBack = () => {
    navigation.replace('SettingsScreen');
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={handleBack} style={styles.iconButton}>
            <Image
              source={require('@/Assets/Common/Back_2.png')}
              style={styles.backIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment Option</Text>
          <View style={styles.spacing} />
        </View>
      </View>
      <View style={styles.contents}>
        {METHODS.map(method => (
          <View key={method.label} style={styles.row}>
            <Image
              source={method.icon}
              style={styles.icon}
              resizeMode="contain"
            />
            <View style={styles.textContainer}>
              <Text style={styles.label}>{method.label}</Text>
              <Text style={styles.warning}>{method.note}</Text>
            </View>
          </View>
        ))}

        <View style={styles.divider} />

        <Text style={styles.warning}>
          Each ride starts on your PinoyRide Wallet when it has enough for the
          fare. You can switch to cash for any ride on the booking sheet.
        </Text>
      </View>
    </View>
  );
};

export default PaymentOptionScreen;

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
      paddingVertical: 22,
      paddingHorizontal: 30,
      backgroundColor: colors.background,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
    },
    textContainer: {
      flex: 1,
      marginLeft: 10,
    },
    icon: {
      width: 27,
      height: 27,
      marginRight: 12,
    },
    label: {
      fontFamily: 'Poppins Light',
      fontWeight: 500,
      fontSize: 16,
      color: colors.text,
    },
    warning: {
      fontFamily: 'Poppins Regular',
      fontWeight: 400,
      fontSize: 12,
      color: colors.grey4,
    },
    divider: {
      borderBottomWidth: 0.5,
      borderBottomColor: colors.grey5,
      marginVertical: 10,
    },
  });
