import React, { useEffect, useState } from 'react';
import {
  Image,
  Keyboard,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import KeyboardScroll from '@/Components/KeyboardScroll/KeyboardScroll';
import Container from '@/Components/Container/Container';
import { useTheme } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AlertBox, AppButton, AppTextInput } from '@/Components';
import useApiRequest from '@/Services/ApiV2';
import { Constants } from '@/Utils';
import { handedCode } from '@/Utils/handedCode';
import { SMS } from '@/Utils/codeChannel';
import appAlert from '@/Utils/appAlert';

const OFFLINE_ALERT_TITLE = 'No Internet Connection';
const OFFLINE_ALERT_MESSAGE =
  'This action needs an internet connection. Please reconnect and try again.';

const LoginScreen = () => {
  const { colors } = useTheme();
  const styles = getStyles({ colors });
  const navigation = useNavigation();
  const route = useRoute();

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  // Just registered: the number is filled in (639XXXXXXXXX)
  const registeredNumber = route.params?.mobileNumber || '';
  const [mobileNumber, setMobileNumber] = useState(registeredNumber);
  const [errorMessage, setErrorMessage] = useState('');
  const [isPhoneValid, setIsPhoneValid] = useState(
    /^639\d{9}$/.test(registeredNumber),
  );

  const [alertMessage, setAlertMessage] = useState('');
  const [showAlert, setShowAlert] = useState(false);

  // Asks how a code can reach this account, then sends it. The backend answers
  // "does not exist" for an unregistered number and says why an account may not
  // sign in, before anything is sent. Nothing about the account is returned
  // until OTPScreen logs in with the code.
  const loginCheck = useApiRequest();
  const sendCode = useApiRequest();
  const isRegister = route.params?.mode === 'register';
  const busy = loginCheck.loading || sendCode.loading;

  useEffect(() => {
    if (route.params?.registrationComplete) {
      setShowSuccessModal(true);
    }
  }, [route.params?.registrationComplete]);

  const handleBack = () => {
    navigation.navigate('LandingScreen');
  };

  const handleNext = async () => {
    if (!mobileNumber) {
      setErrorMessage('Mobile number is required');
      return;
    }

    if (!isPhoneValid) {
      setErrorMessage('Please enter a valid mobile number');
      return;
    }

    setErrorMessage('');

    if (isRegister) {
      await requestCode(SMS);
      return;
    }

    // How can a code reach this account? Every sign-in check runs first; nothing is sent
    const { response, error, offline } = await loginCheck.request(
      'POST',
      Constants.API.OTP_LOGIN_OPTIONS,
      { mobileNo: mobileNumber, userType: 'customer' },
    );
    if (offline) {
      appAlert(OFFLINE_ALERT_TITLE, OFFLINE_ALERT_MESSAGE);
      return;
    }
    if (error || !response) {
      // Not registered, or the account may not sign in now: the backend says which
      setAlertMessage(error || 'Unable to send the code. Please try again.');
      setShowAlert(true);
      return;
    }
    // The next step: where the code goes, a text or an email (the owner,
    // 2026-11-22: the same as the Rider app). Email can be chosen when the
    // account has an address.
    navigation.navigate('CodeChannelScreen', {
      mobileNumber,
      channels: response.data?.channels,
      emailHint: response.data?.emailHint,
    });
  };

  // Registering from the terms screen (an older way in): the code is texted.
  // Logging in, CodeChannelScreen sends it.
  const requestCode = async channel => {
    const { response, error, offline } = await sendCode.request(
      'POST',
      isRegister ? Constants.API.OTP_REGISTER : Constants.API.OTP_LOGIN,
      {
        mobileNo: mobileNumber,
        userType: 'customer',
        ...(isRegister ? {} : { channel }),
      },
    );

    if (offline) {
      appAlert(OFFLINE_ALERT_TITLE, OFFLINE_ALERT_MESSAGE);
      return;
    }

    if (error || !response) {
      // Already registered (register), the email could not be sent, or a code went out a minute ago
      setAlertMessage(error || 'Unable to send the code. Please try again.');
      setShowAlert(true);
      return;
    }

    navigation.navigate('OTPScreen', {
      mobileNumber,
      otpSent: true,
      // a test environment that hands a texted code to the app instead of texting it
      handedCode: handedCode(response.data),
      mode: isRegister ? 'register' : 'login',
      channel,
      // what was ticked on the terms screen; recorded with the new account
      consent: isRegister ? route.params?.consent : undefined,
    });
  };

  return (
    <Container style={styles.container}>
      {showSuccessModal && (
        <AlertBox
          title="Registration Successful!"
          message="Your account has been successfully created. Please log in to continue."
          visible={showSuccessModal}
          setVisible={setShowSuccessModal}
          onConfirm={() => setShowSuccessModal(false)}
        />
      )}

      {alertMessage ? (
        <AlertBox
          title="Error"
          message={alertMessage}
          visible={showAlert}
          setVisible={setShowAlert}
        />
      ) : null}

      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Image
            source={require('@/Assets/Common/Back.png')}
            style={styles.backIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            {isRegister ? 'Register' : 'Get Started'}
          </Text>
        </View>
      </View>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardScroll
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.pageContainer}>
            <AppTextInput
              label="Mobile"
              value={mobileNumber}
              onChangeText={setMobileNumber}
              onValidationChange={setIsPhoneValid}
              inputMode="phone"
              placeholder="9XX-XXX-XXXX"
              error={errorMessage}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Enter your active number to receive a verification code. This
              helps us keep your account secure.
            </Text>
            <AppButton
              title={busy ? 'Please wait…' : 'Next'}
              onPress={handleNext}
              isBold
              disabled={busy}
            />
          </View>
        </KeyboardScroll>
      </TouchableWithoutFeedback>
    </Container>
  );
};

export default LoginScreen;

const getStyles = ({ colors }) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 10,
    },
    header: {
      height: 52,
      justifyContent: 'center',
      marginBottom: 20,
    },
    backButton: {
      position: 'absolute',
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
      color: colors.text,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'space-between',
    },
    pageContainer: {
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    footer: {
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    footerText: {
      textAlign: 'center',
      fontFamily: 'Poppins Regular',
      fontSize: 12,
      color: colors.darkGrey,
      marginBottom: 15,
    },
  });
