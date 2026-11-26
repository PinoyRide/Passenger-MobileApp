import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { AppButton } from '@/Components';
import useApiRequest from '@/Services/ApiV2';
import { Constants } from '@/Utils';
import { selectUserInfo } from '@/Redux/Slices/userSlice';
import {
  LOCKED_MESSAGE,
  VERIFY_LABEL,
  verifyParams,
  walletLocked,
} from '@/Utils/walletLock';

// How a ride is paid (the owner, 2026-11-23: "starting on pinoy ride wallet if
// there is enough balance"): the booking sheet starts on the wallet when its
// balance covers the fare (src/Utils/startingPayment.js), on cash otherwise.
// This page says so; the choice itself is made on the booking sheet. While
// the wallet is locked until the ID check passes (`locked`, WALLET-EKYC-LOCK,
// A-325) every ride starts on cash, and the page says "Verify your ID to use
// your wallet." with Verify ID, which starts the check on the Wallet page.
const METHODS = [
  {
    label: 'PinoyRide Wallet',
    wallet: true,
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
  const userInfo = useSelector(selectUserInfo);
  const walletRequest = useApiRequest();
  const [locked, setLocked] = useState(false);

  // whether the wallet is locked, read each time the page shows (the wallet
  // answer without its transactions)
  useFocusEffect(
    useCallback(() => {
      if (!userInfo?.id) {
        return undefined;
      }
      let showing = true;
      (async () => {
        const { response } = await walletRequest.request(
          'GET',
          `${Constants.API.CUSTOMER_WALLET(userInfo.id)}?take=0`,
        );
        if (showing && response?.data) {
          setLocked(walletLocked(response.data));
        }
      })();
      return () => {
        showing = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userInfo?.id]),
  );

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
              <Text style={styles.warning}>
                {locked && method.wallet ? LOCKED_MESSAGE : method.note}
              </Text>
            </View>
          </View>
        ))}

        <View style={styles.divider} />

        {locked ? (
          <>
            <Text style={styles.warning}>
              Your rides start on cash until your ID is checked.
            </Text>
            <AppButton
              title={VERIFY_LABEL}
              onPress={() => navigation.navigate(...verifyParams())}
            />
          </>
        ) : (
          <Text style={styles.warning}>
            Each ride starts on your PinoyRide Wallet when it has enough for the
            fare. You can switch to cash for any ride on the booking sheet.
          </Text>
        )}
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
      fontFamily: 'Poppins Regular',
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
