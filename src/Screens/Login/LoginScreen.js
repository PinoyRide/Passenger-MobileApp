import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Container from '@/Components/Container/Container';
import { useTheme } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AlertBox, AppButton, AppTextInput } from '@/Components';
import useApiRequest from '@/Services/ApiV2';
import { Constants } from '@/Utils';
import { handedCode } from '@/Utils/handedCode';

const OFFLINE_ALERT_TITLE = 'No Internet Connection';
const OFFLINE_ALERT_MESSAGE =
  'This action needs an internet connection. Please reconnect and try again.';

const LoginScreen = () => {
  const { colors } = useTheme();
  const styles = getStyles({ colors });
  const navigation = useNavigation();
  const route = useRoute();

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [mobileNumber, setMobileNumber] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isPhoneValid, setIsPhoneValid] = useState(false);

  const [alertMessage, setAlertMessage] = useState('');
  const [showAlert, setShowAlert] = useState(false);

  // Sends the login OTP. The backend answers "does not exist" for an unregistered
  // number, so this also checks registration. Nothing about the account is returned
  // until OTPScreen logs in with the code.
  const loginCheck = useApiRequest();
  const isRegister = route.params?.mode === 'register';

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

    const { response, error, offline } = await loginCheck.request(
      'POST',
      isRegister ? Constants.API.OTP_REGISTER : Constants.API.OTP_LOGIN,
      { mobileNo: mobileNumber, userType: 'customer' },
    );

    if (offline) {
      Alert.alert(OFFLINE_ALERT_TITLE, OFFLINE_ALERT_MESSAGE);
      return;
    }

    if (error || !response) {
      // Not registered (login), already registered (register), or the OTP could not be sent
      setAlertMessage(error || 'Unable to send the code. Please try again.');
      setShowAlert(true);
      return;
    }

    // OTP sent; OTPScreen logs in with it.
    navigation.navigate('OTPScreen', {
      mobileNumber,
      otpSent: true,
      // a test environment that hands the code to the app instead of texting it
      handedCode: handedCode(response.data),
      mode: isRegister ? 'register' : 'login',
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
        <ScrollView
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
              title={loginCheck.loading ? 'Please wait…' : 'Next'}
              onPress={handleNext}
              isBold
              disabled={loginCheck.loading}
            />
          </View>
        </ScrollView>
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
      color: colors.shadow,
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
