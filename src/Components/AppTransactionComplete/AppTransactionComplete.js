import { AppButton, Container } from '@/Components';
import { AppUtil } from '@/Utils';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect } from 'react';
import { BackHandler, Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useCashOutResult from '@/Hooks/useCashOutResult';
import { cashOutResultText } from '@/Utils/cashOut';
import { modern } from '@/Theme/modern';
import { walletOff } from '@/Utils/walletOff';

const AppTransactionComplete = () => {
  const theme = useTheme();
  const { colors } = theme;
  const look = modern(theme);
  const styles = getStyles({ colors });
  const navigation = useNavigation();
  const route = useRoute();

  // Check if we came from PaymentMethodModal
  const returnTo = route?.params?.returnTo;
  const returnScreen = route?.params?.returnScreen;

  // Format amount with peso sign
  const formattedAmount = route?.params?.referenceData?.amount
    ? `₱${parseFloat(route?.params?.referenceData.amount).toFixed(2)}`
    : '₱0.00';

  // A cash-out's page follows it until it is paid out or has failed and come
  // back, the same as the Rider's (useCashOutResult, shared)
  const referenceData = route?.params?.referenceData;
  const isCashOut = referenceData?.transactionType === 'CASHOUT';
  const cashOut = useCashOutResult(
    referenceData?.transactionId,
    referenceData?.status,
    isCashOut,
  );
  const cashOutText = cashOutResultText(cashOut, formattedAmount);
  const cashOutFailed = isCashOut && cashOut === 'failed';

  useEffect(() => {
    AppUtil.debugDeep(route?.params);
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => true,
    );
    return () => backHandler.remove();
  }, []);

  const handleDone = () => {
    if (returnTo === 'PaymentMethodModal' && returnScreen) {
      navigation.reset({
        index: 0,
        routes: [{ name: returnScreen }],
      });
    } else {
      // Default behavior - go to home
      navigation.reset({
        index: 0,
        routes: [{ name: 'HomeScreen' }],
      });
    }
  };

  const noWallet = walletOff();

  const handleViewWallet = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'WalletScreen' }],
    });
  };

  // Determine button text based on context
  const getDoneButtonText = () => {
    if (returnTo === 'PaymentMethodModal' && returnScreen) {
      return 'Continue with Booking';
    }
    return 'Go back to Home screen';
  };

  return (
    <Container style={styles.container}>
      <View style={styles.contents}>
        {cashOutFailed ? (
          <View
            style={[styles.image, styles.mark, { backgroundColor: look.tile }]}>
            <Icon name="cash-refund" size={56} color={look.inkSoft} />
          </View>
        ) : (
          <Image
            source={require('@/Assets/Common/Success_Image.png')}
            style={styles.image}
            resizeMode="contain"
          />
        )}
        {/* Display dynamic amount */}
        <Text style={styles.amount}>{formattedAmount}</Text>

        {/* Dynamic title based on payment method */}
        <Text style={styles.title} accessibilityLiveRegion="polite">
          {referenceData?.paymentMethod === 'QRPH'
            ? 'QRPH Payment Successful!'
            : isCashOut
            ? cashOutText.title
            : 'Cash-out request sent!'}
        </Text>

        <Text style={styles.subtitle}>
          {isCashOut
            ? cashOutText.note
            : 'Your transaction has been completed successfully.'}
        </Text>

        {/*  Optional: Display transaction ID */}
        {route?.params?.referenceData?.transactionId && (
          <Text style={styles.transactionId}>
            Transaction ID: {route?.params?.referenceData.transactionId}
          </Text>
        )}
      </View>

      <View style={{ paddingBottom: 24 }}>
        {/* none in the Google Play build, which has no wallet
            (Utils/walletOff.js): the way back is then the one button */}
        {noWallet ? null : (
          <AppButton
            title="View Wallet"
            onPress={handleViewWallet}
            isBold
            noSpacing
            featureStyle={{ marginBottom: 10 }}
          />
        )}
        <AppButton
          title={getDoneButtonText()}
          onPress={handleDone}
          isBold
          noSpacing
          mode={noWallet ? undefined : 'outlined'}
          featureStyle={noWallet ? undefined : { backgroundColor: colors.card }}
        />
      </View>
    </Container>
  );
};

export default AppTransactionComplete;

const getStyles = ({ colors }) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 24,
    },
    contents: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // The picture has a white square behind it: round, it is a white disc
    // in the dark look instead of a box (the drawing and its tick lie inside).
    image: {
      width: 122,
      height: 122,
      borderRadius: 61,
      marginBottom: 24,
    },
    // a cash-out that came back: money returning, in place of the picture
    mark: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    amount: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 20,
      color: colors.primary,
      textAlign: 'center',
      marginBottom: 8,
    },
    title: {
      fontFamily: 'Poppins Medium',
      fontSize: 16,
      color: colors.primary,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontFamily: 'Poppins Regular',
      fontSize: 14,
      color: colors.grey3,
      textAlign: 'center',
      paddingHorizontal: 16,
    },
    transactionId: {
      fontFamily: 'Poppins Regular',
      fontSize: 12,
      color: colors.grey4,
      textAlign: 'center',
      marginTop: 8,
      paddingHorizontal: 16,
    },
  });
