import React, { useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { AlertBox, AppButton, AppTextInput, Container } from '@/Components';
import ConsentCheck from '@/Components/ConsentCheck/ConsentCheck';
import useApiRequest from '@/Services/ApiV2';
import { Constants } from '@/Utils';
import { consentBody } from '@/Utils/consent';
import { handedCode } from '@/Utils/handedCode';
import {
  refusalField,
  registrationErrors,
  registrationFields,
} from '@/Utils/registerForm';

// Register: the passenger's details first, the mobile number last, every field
// required (the owner, 2026-11-22). Everything that could stop the
// registration is checked before a code is sent; the code screen then creates
// the account and sends the passenger to log in.
const RegisterFormScreen = () => {
  const { colors } = useTheme();
  const styles = getStyles({ colors });
  const navigation = useNavigation();
  const sendCode = useApiRequest();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [mobileValid, setMobileValid] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [errors, setErrors] = useState({});
  const [alertMessage, setAlertMessage] = useState('');
  const [showAlert, setShowAlert] = useState(false);

  // A field's message goes away as soon as it is changed
  const changed = (field, set) => value => {
    set(value);
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleNext = async () => {
    const problems = registrationErrors({
      firstName,
      lastName,
      email,
      mobile,
      mobileValid,
      acceptedTerms,
      acceptedPrivacy,
    });
    setErrors(problems);
    if (Object.keys(problems).length > 0) {
      return;
    }

    const details = registrationFields({ firstName, lastName, email });
    const { response, error, offline } = await sendCode.request(
      'POST',
      Constants.API.OTP_REGISTER,
      { mobileNo: mobile, userType: 'customer', ...details },
    );

    if (offline) {
      Alert.alert(
        'No Internet Connection',
        'Registering needs an internet connection. Please reconnect and try again.',
      );
      return;
    }

    if (error || !response) {
      // Number or email already taken, a missing name: shown where it belongs
      const { field, message } = refusalField(error);
      if (field) {
        setErrors(prev => ({ ...prev, [field]: message }));
      } else {
        setAlertMessage(message);
        setShowAlert(true);
      }
      return;
    }

    navigation.navigate('OTPScreen', {
      mobileNumber: mobile,
      otpSent: true,
      // a test environment that hands the code to the app instead of texting it
      handedCode: handedCode(response.data),
      mode: 'register',
      consent: consentBody({ acceptedTerms, acceptedPrivacy }),
      registration: details,
    });
  };

  return (
    <Container style={styles.container}>
      {alertMessage ? (
        <AlertBox
          title="Unable to Register"
          message={alertMessage}
          visible={showAlert}
          setVisible={setShowAlert}
        />
      ) : null}

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
          <Text style={styles.headerTitle}>Register</Text>
        </View>
      </View>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.pageContainer}>
            <Text style={styles.intro}>
              Riders see your name so they can find you at pickup.
            </Text>

            <AppTextInput
              label="First Name"
              value={firstName}
              onChangeText={changed('firstName', setFirstName)}
              placeholder="e.g. Juan"
              error={errors.firstName}
            />
            <AppTextInput
              label="Last Name"
              value={lastName}
              onChangeText={changed('lastName', setLastName)}
              placeholder="e.g. Dela Cruz"
              error={errors.lastName}
            />
            <AppTextInput
              label="Email"
              value={email}
              onChangeText={changed('email', setEmail)}
              placeholder="e.g. juan@email.com"
              inputMode="email"
              error={errors.email}
            />
            <AppTextInput
              label="Mobile"
              value={mobile}
              onChangeText={changed('mobile', setMobile)}
              onValidationChange={setMobileValid}
              inputMode="phone"
              placeholder="9XX-XXX-XXXX"
              error={errors.mobile}
            />

            <View style={styles.consents}>
              <ConsentCheck
                checked={acceptedTerms}
                onToggle={() => {
                  setAcceptedTerms(v => !v);
                  setErrors(prev => ({ ...prev, consent: '' }));
                }}
                label="I accept the"
                linkText="Terms and Conditions"
                onOpen={() => navigation.navigate('TAC')}
              />
              <ConsentCheck
                checked={acceptedPrivacy}
                onToggle={() => {
                  setAcceptedPrivacy(v => !v);
                  setErrors(prev => ({ ...prev, consent: '' }));
                }}
                label="I have read and agree to the"
                linkText="Privacy Policy"
                onOpen={() => navigation.navigate('PrivacyPolicyScreen')}
                style={styles.secondConsent}
              />
              {errors.consent ? (
                <Text style={styles.errorText}>{errors.consent}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              We will send a code to your mobile number to confirm it is yours.
              Then log in with the same number.
            </Text>
            <AppButton
              title={sendCode.loading ? 'Please wait…' : 'Next'}
              onPress={handleNext}
              isBold
              disabled={sendCode.loading}
            />
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </Container>
  );
};

export default RegisterFormScreen;

const getStyles = ({ colors }) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 10,
    },
    header: {
      height: 52,
      justifyContent: 'center',
      marginBottom: 12,
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
    },
    intro: {
      fontFamily: 'Poppins Regular',
      fontSize: 13,
      color: colors.grey4,
      marginBottom: 16,
    },
    consents: {
      marginTop: 8,
    },
    secondConsent: {
      marginTop: 12,
    },
    errorText: {
      fontFamily: 'Poppins Regular',
      fontSize: 12,
      color: colors.error,
      marginTop: 8,
    },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 20,
    },
    footerText: {
      fontFamily: 'Poppins Regular',
      fontSize: 12,
      color: colors.grey4,
      textAlign: 'center',
      marginBottom: 12,
    },
  });
