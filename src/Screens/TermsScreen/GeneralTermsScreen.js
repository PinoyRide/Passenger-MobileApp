import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import React, { useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import Container from '@/Components/Container/Container';
import { AppButton } from '@/Components';
import ConsentCheck from '@/Components/ConsentCheck/ConsentCheck';
import useApiRequest from '@/Services/ApiV2';
import { Constants } from '@/Utils';
import { consentBody, signedInRoutes } from '@/Utils/consent';
import { toStoredUser } from '@/Utils/customerMapper';
import { selectUserInfo, setUserInfo } from '@/Redux/Slices/userSlice';
import appAlert from '@/Utils/appAlert';

const GeneralTermsScreen = () => {
  const { colors } = useTheme();
  const styles = getStyles({ colors });
  // Both must be ticked to go on: the terms of the service, and how personal
  // data is handled.
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const checked = acceptedTerms && acceptedPrivacy;
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const userInfo = useSelector(selectUserInfo);
  const consentRequest = useApiRequest();

  // 'accept': a signed-in passenger who has not accepted the current Terms
  // and Privacy Policy (an older account, or the policy changed since).
  // Otherwise this is the first step of registering.
  const acceptOnly = route.params?.mode === 'accept';

  const handleNext = async () => {
    const consent = consentBody({ acceptedTerms, acceptedPrivacy });
    if (!acceptOnly) {
      // Registration: number → OTP → account (the acceptance is recorded with
      // it), then the profile (name + selfie) before the first booking
      navigation.replace('LoginScreen', { mode: 'register', consent });
      return;
    }

    const { response, error } = await consentRequest.request(
      'POST',
      Constants.API.CUSTOMER_CONSENT(userInfo.id),
      consent,
    );
    if (error || !response?.data) {
      appAlert('Unable to Continue', error || 'Please try again.');
      return;
    }
    const user = toStoredUser(response.data);
    dispatch(setUserInfo(user));
    navigation.reset(signedInRoutes(user));
  };

  const handleBack = () => {
    navigation.replace('LandingScreen');
  };

  return (
    <Container style={styles.container}>
      {/* Back button (registering only: a signed-in passenger has nowhere to
          go back to until the terms are accepted) */}
      <View style={styles.backWrapper}>
        {!acceptOnly && (
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Image
              source={require('@/Assets/Common/Back.png')}
              style={styles.backIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Logo */}
      <View style={styles.logoContainer}>
        <Image
          source={require('@/Assets/Common/GeneralTerms/Accept_Terms.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Text & Checkbox */}
      <View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Accept Our Terms</Text>
          <Text style={styles.subtitle}>
            {acceptOnly ? 'To continue' : 'To start booking'}, please review and
            accept our Terms and Conditions and our Privacy Policy. Your safety
            and privacy matter to us.
          </Text>
        </View>

        <View style={styles.consents}>
          <ConsentCheck
            checked={acceptedTerms}
            onToggle={() => setAcceptedTerms(v => !v)}
            label="I accept the"
            linkText="Terms and Conditions"
            onOpen={() => navigation.navigate('TAC')}
          />
          <ConsentCheck
            checked={acceptedPrivacy}
            onToggle={() => setAcceptedPrivacy(v => !v)}
            label="I have read and agree to the"
            linkText="Privacy Policy"
            onOpen={() => navigation.navigate('PrivacyPolicyScreen')}
            style={styles.secondConsent}
          />
        </View>

        <AppButton
          title="Submit"
          onPress={handleNext}
          isBold
          disabled={!checked || consentRequest.loading}
        />
      </View>
    </Container>
  );
};

export default GeneralTermsScreen;

const getStyles = ({ colors }) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 15,
    },
    backButton: {
      marginTop: 10,
    },
    backIcon: {
      width: 23,
      height: 23,
    },
    logoContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    logo: {
      width: 450,
      height: 450,
    },
    textContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 50,
    },
    title: {
      color: colors.text,
      fontFamily: 'Poppins SemiBold',
      fontSize: 25,
      textAlign: 'center',
      letterSpacing: -0.45,
    },
    subtitle: {
      color: colors.text,
      fontFamily: 'Poppins Regular',
      fontWeight: '400',
      fontSize: 16,
      textAlign: 'center',
      letterSpacing: -0.45,
    },
    consents: {
      alignSelf: 'center',
      marginBottom: 4,
    },
    secondConsent: {
      marginTop: 14,
    },
    customCheckbox: {
      width: 20,
      height: 20,
      borderWidth: 2,
      borderRadius: 4,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 10,
      backgroundColor: 'transparent',
    },
    checkedCheckbox: {
      backgroundColor: colors.primary,
    },
    label: {
      fontSize: 14,
      fontFamily: 'Poppins Regular',
      color: colors.primary,
      lineHeight: 20,
      maxWidth: 250,
    },
  });
