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
import { useTheme } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AlertBox, Container, OTPInput } from '@/Components';
import useApiRequest from '@/Services/ApiV2';
import { toStoredUser } from '@/Utils/customerMapper';
import { signedInRoutes } from '@/Utils/consent';
import { Constants } from '@/Utils';
import { handedCode } from '@/Utils/handedCode';
import { SMS, sentTo } from '@/Utils/codeChannel';
import DeviceInfo from 'react-native-device-info';
import { useDispatch, useSelector } from 'react-redux';
import { selectUserInfo, setUserInfo } from '@/Redux/Slices/userSlice';

// The backend's message for an unregistered number ("Customer with this mobile number does not exist").
const NOT_REGISTERED_ERROR_PATTERN = /does not exist/i;

const OTPScreen = () => {
  const { colors } = useTheme();
  const styles = getStyles({ colors });
  const navigation = useNavigation();
  const route = useRoute();
  const { mobileNumber, otpSent, mode, consent, emailHint } = route.params;
  const isRegister = mode === 'register';
  // How the login code was sent: a text, or an email (chosen on LoginScreen).
  // A registration code is always texted.
  const channel = (!isRegister && route.params.channel) || SMS;

  const getOtpCode = useApiRequest();
  const loginUser = useApiRequest();

  const [, setOtpCode] = useState('');
  // A code the backend handed over instead of texting it (a test environment
  // without working SMS): filled in and submitted for the person.
  const [codeFromBackend, setCodeFromBackend] = useState(
    route.params.handedCode ?? null,
  );
  const [alertMessage, setAlertMessage] = useState('');
  const [showAlert, setShowAlert] = useState(false);

  const dispatch = useDispatch();
  const userInfo = useSelector(selectUserInfo);

  // LoginScreen already sent the OTP; only send one here if we arrived some other way
  useEffect(() => {
    if (!otpSent) {
      fetchOtp(mobileNumber);
    }
  }, [mobileNumber]);

  const fetchOtp = number =>
    getOtpCode.request(
      'POST',
      isRegister ? Constants.API.OTP_REGISTER : Constants.API.OTP_LOGIN,
      {
        mobileNo: number,
        userType: 'customer',
        ...(isRegister ? {} : { channel }),
      },
    );

  // Handle OTP generation response
  useEffect(() => {
    if (getOtpCode.error) {
      if (NOT_REGISTERED_ERROR_PATTERN.test(getOtpCode.error)) {
        Alert.alert(
          'Account Not Found',
          'No account was found for this mobile number. Please check the number or sign up.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('LoginScreen'),
            },
          ],
        );
        return;
      }

      setAlertMessage(getOtpCode.error);
      setShowAlert(true);
      return;
    }
    const handed = handedCode(getOtpCode.response?.data);
    if (handed) {
      setCodeFromBackend(handed);
    }
  }, [getOtpCode.response, getOtpCode.error]);

  // Log in with the OTP once 6 digits are entered: the backend checks and uses up the code,
  // then returns the customer.
  const verifyOtp = code =>
    loginUser.request(
      'POST',
      isRegister
        ? Constants.API.CUSTOMER_REGISTER
        : Constants.API.CUSTOMER_LOGIN,
      {
        mobileNo: mobileNumber,
        otpCode: code,
        appVersion: DeviceInfo.getVersion(),
        // registering: the Terms and Privacy Policy acceptance is recorded with the account,
        // which is made signed in; the profile comes next and can be skipped for now
        ...(isRegister ? { ...consent } : {}),
      },
    );

  useEffect(() => {
    if (loginUser.error) {
      setAlertMessage(
        /invalid otp/i.test(loginUser.error)
          ? 'Invalid OTP, please try again.'
          : loginUser.error,
      );
      setShowAlert(true);
      return;
    }
    // Signed in: by logging in, or by registering (the new account comes back signed in)
    if (
      loginUser.response?.data &&
      (isRegister || loginUser.response.code === 200)
    ) {
      dispatch(setUserInfo(toStoredUser(loginUser.response.data)));
    }
  }, [loginUser.response, loginUser.error]);

  // Redirect after login / registration. An account that has not accepted the current Terms and
  // Privacy Policy is asked first. An incomplete profile (no name yet) goes straight to
  // CompleteProfileScreen, with Home underneath: it can be skipped for now, and booking asks
  // for the name when it is still missing.
  useEffect(() => {
    if (!userInfo) {
      return;
    }
    navigation.reset(signedInRoutes(userInfo));
  }, [userInfo]);

  const [resendDisabled, setResendDisabled] = useState(false);

  const handleResendOtp = async () => {
    if (resendDisabled) {
      return;
    }

    setResendDisabled(true);
    setTimeout(() => setResendDisabled(false), 60000); // 60s cooldown

    try {
      await fetchOtp(mobileNumber);
    } catch (error) {
      setAlertMessage(error || 'Failed to resend OTP.');
      setShowAlert(true);
    }
  };

  return (
    <Container style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}>
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

      {/* Alert */}
      {alertMessage ? (
        <AlertBox
          title="Error"
          message={alertMessage}
          visible={showAlert}
          setVisible={setShowAlert}
        />
      ) : null}

      {/* Scrollable Content with Keyboard Dismissal */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.pageContainer}>
            <Text style={styles.title}>Enter One-Time PIN</Text>
            <Text style={styles.subtitle}>
              {sentTo({
                channel,
                emailHint,
                mobileNumber,
                handed: !!codeFromBackend,
              })}
            </Text>
            <OTPInput
              length={6}
              onOTPChange={setOtpCode}
              onOTPComplete={verifyOtp}
              autoFillCode={codeFromBackend}
            />

            <View style={styles.imageContainer}>
              <Image
                source={require('@/Assets/Common/LoginScreen/OTP_Image.png')}
                style={styles.otpImage}
                resizeMode="contain"
              />
            </View>

            <View style={styles.resendContainer}>
              <Text style={styles.resendLabel}>Didn't receive it?</Text>
              <TouchableOpacity
                onPress={handleResendOtp}
                disabled={resendDisabled}>
                <Text
                  style={[
                    styles.resendLink,
                    resendDisabled && { opacity: 0.5 },
                  ]}>
                  Request a new OTP
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </Container>
  );
};

export default OTPScreen;

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
      backgroundColor: colors.background || '#FFFFFF',
      zIndex: 10,
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
    backIcon: { width: 23, height: 23 },
    headerTitleContainer: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
      justifyContent: 'center',
      height: 52,
    },
    headerTitle: {
      fontSize: 16,
      fontFamily: 'Poppins Medium',
      color: colors.shadow,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    pageContainer: {
      paddingHorizontal: 20,
      paddingVertical: 20,
    },
    title: {
      fontSize: 20,
      fontWeight: '400',
      marginBottom: 15,
      fontFamily: 'Poppins Regular',
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 11,
      textAlign: 'center',
      fontFamily: 'Poppins Regular',
      color: colors.onSurfaceGrey,
      marginBottom: 20,
    },
    imageContainer: {
      marginVertical: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    otpImage: { width: 288, height: 288 },
    resendContainer: {
      marginTop: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    resendLabel: {
      fontFamily: 'Poppins Regular',
      fontSize: 16,
      color: colors.shadow,
      marginBottom: 2,
    },
    resendLink: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 16,
      color: colors.primary,
    },
  });
