import { AlertBox, AppButton, AppTextInput, Container } from '@/Components';
import { AppUtil, Constants } from '@/Utils';
import usePostRequest from '@/Services/Api';
import { selectUserInfo } from '@/Redux/Slices/userSlice';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Image,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';

const {
  afterCashOut,
  cashOutRequest,
  gcashNumber,
  gcashNumberError,
} = require('@/Utils/cashOut');

const CashOutScreen = ({ route }) => {
  const { colors } = useTheme();
  const walletDetails = route?.params?.walletDetails;
  const styles = getStyles({ colors });
  const navigation = useNavigation();

  const userInfo = useSelector(selectUserInfo);
  const cashOut = usePostRequest();

  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const [gcash, setGcash] = useState('');
  const [gcashError, setGcashError] = useState('');
  const [isFirstSlide, setIsFirstSlide] = useState(true);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertVisible, setAlertVisible] = useState(false);
  const isSecondSlide = !isFirstSlide;

  // Only the cashable part can leave (the owner, 2026-11-23): money added by
  // Pinoy Ride in the Admin Portal pays for rides but is not cashed out. The
  // backend says how much is cashable; without it (an older backend), the
  // balance.
  const totalBalance = Number(walletDetails?.avail_balance) || 0;
  const cashable = walletDetails?.cashable_balance;
  const availableBalance =
    cashable !== undefined && cashable !== null
      ? Math.max(0, Number(cashable) || 0)
      : totalBalance;
  const notCashable = Math.max(0, totalBalance - availableBalance);
  const minimumAmount = 10.0;

  useEffect(() => {
    AppUtil.debugDeep(walletDetails?.avail_balance);
  });

  const handleBack = () => {
    if (isSecondSlide) {
      setIsFirstSlide(true);
    } else {
      navigation.goBack();
    }
  };

  const formatAmount = val => {
    if (!val || val === '') {
      return '';
    }
    const number = parseFloat(val.replace(/,/g, ''));
    if (isNaN(number)) {
      return '';
    }

    const formatted = number.toFixed(2);
    const parts = formatted.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  const validateAmount = () => {
    const numericAmount = parseFloat(amount.replace(/,/g, ''));

    if (!amount || amount === '') {
      setAmountError('Please enter an amount');
      return false;
    }

    if (isNaN(numericAmount) || numericAmount <= 0) {
      setAmountError('Please enter a valid amount');
      return false;
    }

    if (numericAmount < minimumAmount) {
      setAmountError(`Minimum amount is ₱${minimumAmount.toFixed(2)}`);
      return false;
    }

    if (numericAmount > availableBalance) {
      setAmountError(`You can cash out up to ₱${availableBalance.toFixed(2)}`);
      return false;
    }

    setAmountError('');
    return true;
  };

  const handleNext = () => {
    const amountOk = validateAmount();
    const problem = gcashNumberError(gcash);
    setGcashError(problem);
    if (amountOk && !problem) {
      const formattedAmount = formatAmount(amount);
      setAmount(formattedAmount);
      setGcash(gcashNumber(gcash));
      setIsFirstSlide(false);
    }
  };

  // Sent once; "done" only when the backend says PayCools has the order
  const handleSubmit = async () => {
    if (cashOut.loading) {
      return;
    }
    const value = parseFloat(amount.replace(/,/g, ''));
    const answer = await cashOut.makePostRequest(
      Constants.ENDPOINT.CASH_OUT,
      cashOutRequest({
        amount: value,
        number: gcash,
        firstName: userInfo?.ekyc_details?.first_name || userInfo?.fname,
        lastName: userInfo?.ekyc_details?.last_name || userInfo?.lname,
      }),
      {},
      'json',
    );
    const next = afterCashOut(answer, value);
    if (next.refusal) {
      setAlertMessage(next.refusal);
      setAlertVisible(true);
      return;
    }
    if (next.complete) {
      navigation.navigate('AppTransactionComplete', {
        referenceData: {
          amount: next.complete.amount,
          transactionType: 'CASHOUT',
          status: next.complete.status,
          transactionId: next.complete.reference,
        },
      });
    }
  };

  const handleGcashChange = value => {
    setGcash(value);
    if (gcashError) {
      setGcashError('');
    }
  };

  const handleAmountChange = value => {
    setAmount(value);
    if (amountError) {
      setAmountError('');
    }
  };

  return (
    <Container style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Image
            source={require('@/Assets/Common/Back.png')}
            style={styles.backIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Cash Out</Text>
        </View>
      </View>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.lowerPart}>
            <View
              style={[
                styles.balanceContainer,
                isSecondSlide && { alignItems: 'flex-start' },
              ]}>
              <Text
                style={[
                  styles.availableText,
                  isSecondSlide && styles.confirmationTitle,
                ]}>
                {isFirstSlide ? 'Available for Cash out' : 'Confirmation'}
              </Text>
              <Text
                style={[
                  styles.balance,
                  isSecondSlide && styles.confirmationSubtitle,
                ]}>
                {isFirstSlide
                  ? `₱${availableBalance.toFixed(2)}`
                  : 'Check if your transaction is correct before clicking Cash-out.'}
              </Text>
              {isFirstSlide && notCashable > 0 ? (
                <Text style={styles.notCashable}>
                  ₱{notCashable.toFixed(2)} of your balance was added by Pinoy
                  Ride. It can pay for your rides but cannot be cashed out.
                </Text>
              ) : null}
            </View>

            {isFirstSlide && (
              <>
                <View style={styles.transaction}>
                  <Text style={styles.amountTitle}>Enter Amount</Text>
                  <AppTextInput
                    value={amount}
                    onChangeText={handleAmountChange}
                    placeholder="Amount"
                    inputMode="amount"
                    error={amountError}
                  />
                </View>
                <Text style={styles.minimum}>
                  ₱{minimumAmount.toFixed(2)} is the minimum amount you can Cash
                  out
                </Text>
                <View style={styles.transaction}>
                  <Text style={styles.amountTitle}>GCash number</Text>
                  <AppTextInput
                    value={gcash}
                    onChangeText={handleGcashChange}
                    placeholder="09XXXXXXXXX"
                    inputMode="numeric"
                    error={gcashError}
                  />
                </View>
              </>
            )}

            {isSecondSlide && (
              <>
                <Text style={styles.cashOutLabel}>Cash Out</Text>
                <View style={styles.divider} />
                <View style={styles.rowBetween}>
                  <Text style={styles.label}>From</Text>
                  <Text style={styles.value}>PinoyRide Wallet</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.rowBetween}>
                  <Text style={styles.label}>To e-Wallet</Text>
                  <Text style={styles.value}>
                    GCash{'\n'}
                    {gcash}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.rowBetween}>
                  <Text style={styles.label}>Amount</Text>
                  <Text style={[styles.icon, { color: colors.primary }]}>
                    ₱{amount}
                  </Text>
                </View>
              </>
            )}
          </View>

          <View style={styles.buttonWrapper}>
            <AppButton
              title={
                isFirstSlide
                  ? 'Confirm'
                  : cashOut.loading
                  ? 'Sending…'
                  : 'Submit'
              }
              onPress={isFirstSlide ? handleNext : handleSubmit}
              disabled={isSecondSlide && cashOut.loading}
              isBold
            />
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
      <AlertBox
        title="Cash out"
        message={alertMessage}
        visible={alertVisible}
        setVisible={setAlertVisible}
      />
    </Container>
  );
};

export default CashOutScreen;

const getStyles = ({ colors }) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      height: 52,
      justifyContent: 'center',
      marginBottom: 20,
    },
    backButton: {
      position: 'absolute',
      left: 0,
      width: 52,
      height: 52,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2,
    },
    backIcon: {
      width: 23,
      height: 23,
    },
    headerTitleContainer: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 16,
      fontFamily: 'Poppins Medium',
      color: colors.primary,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'space-between',
    },
    lowerPart: {
      paddingHorizontal: 16,
      flex: 1,
    },
    transaction: {
      marginTop: 20,
    },
    notCashable: {
      marginTop: 8,
      fontFamily: 'Poppins Regular',
      fontSize: 12,
      lineHeight: 17,
      textAlign: 'center',
      color: colors.grey3,
    },
    balanceContainer: {
      alignItems: 'center',
    },
    availableText: {
      fontFamily: 'Poppins Medium',
      fontSize: 10,
      color: colors.text,
      marginBottom: 3,
    },
    balance: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 18,
      color: colors.text,
      marginBottom: 12,
    },
    confirmationTitle: {
      fontSize: 16,
      fontFamily: 'Poppins SemiBold',
    },
    confirmationSubtitle: {
      fontSize: 12,
      fontFamily: 'Poppins Regular',
      color: colors.grey3,
      letterSpacing: -0.45,
      marginTop: 7,
      marginBottom: 40,
    },
    amountTitle: {
      fontFamily: 'Poppins Medium',
      fontSize: 16,
      color: colors.text,
      marginBottom: 12,
    },
    minimum: {
      fontFamily: 'Poppins Regular',
      fontSize: 12,
      color: colors.grey3,
      marginBottom: 31,
    },
    fee: {
      fontFamily: 'Poppins Regular',
      fontSize: 12,
      color: colors.grey3,
      marginBottom: 12,
    },
    cashOutLabel: {
      fontFamily: 'Poppins Medium',
      fontSize: 16,
      color: colors.text,
      marginBottom: 16,
      marginTop: 8,
    },
    divider: {
      borderBottomWidth: 0.5,
      borderBottomColor: colors.grey5,
      marginBottom: 12,
    },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    label: {
      fontFamily: 'Poppins Regular',
      width: 100,
      marginRight: 70,
      fontSize: 14,
      color: colors.grey3,
    },
    value: {
      fontFamily: 'Poppins Medium',
      fontSize: 14,
      color: colors.text,
    },
    buttonWrapper: {
      paddingTop: 20,
      paddingBottom: 20,
    },
  });
