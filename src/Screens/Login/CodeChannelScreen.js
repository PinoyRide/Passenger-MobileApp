import React, { useRef, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AlertBox, AppButton, Container } from '@/Components';
import CodeChannelPicker from '@/Components/CodeChannelPicker/CodeChannelPicker';
import useApiRequest from '@/Services/ApiV2';
import { Constants } from '@/Utils';
import { modern } from '@/Theme/modern';
import { handedCode } from '@/Utils/handedCode';
import { SMS } from '@/Utils/codeChannel';

// The step after "Get Started" (the owner, 2026-11-22: "the passenger choosing
// where to send should be the same as the rider"; the same screen in the Rider
// app): where the sign-in code goes, a text message or an email. LoginScreen
// has already asked the backend whether this passenger may sign in and which
// ways the account has (otp/login/options, which sends nothing). Email can be
// chosen only when the account has an email address; otherwise it is shown
// greyed out. "Send code" sends it the chosen way and opens the code screen.
const CodeChannelScreen = () => {
  const look = modern(useTheme());
  const styles = getStyles(look);
  const navigation = useNavigation();
  const { mobileNumber, channels, emailHint } = useRoute().params;
  const options = { channels, emailHint };

  const sendCode = useApiRequest();
  const asking = useRef(false);
  const [channel, setChannel] = useState(SMS);
  const [alertMessage, setAlertMessage] = useState('');
  const [showAlert, setShowAlert] = useState(false);

  const send = async () => {
    // One request at a time: a second one inside the same minute is refused
    if (asking.current) {
      return;
    }
    asking.current = true;
    try {
      const { response, error, offline } = await sendCode.request(
        'POST',
        Constants.API.OTP_LOGIN,
        { mobileNo: mobileNumber, userType: 'customer', channel },
      );
      if (offline) {
        Alert.alert(
          'No Internet Connection',
          'This action needs an internet connection. Please reconnect and try again.',
        );
        return;
      }
      if (error || !response) {
        // the email could not be sent, a code went out a minute ago, the account changed
        setAlertMessage(error || 'Unable to send the code. Please try again.');
        setShowAlert(true);
        return;
      }
      navigation.navigate('OTPScreen', {
        mobileNumber,
        otpSent: true,
        // a test environment that hands a texted code to the app instead of texting it
        handedCode: handedCode(response.data),
        mode: 'login',
        channel,
        emailHint,
      });
    } finally {
      asking.current = false;
    }
  };

  return (
    <Container style={styles.container}>
      {alertMessage ? (
        <AlertBox
          title="Code Not Sent"
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
          <Text style={styles.headerTitle}>Get Started</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Where should we send your code?</Text>
        <Text style={styles.subtitle}>
          We will send you a 6-digit code to log in.
        </Text>
        <CodeChannelPicker
          mobileNumber={mobileNumber}
          options={options}
          selected={channel}
          onSelect={setChannel}
          disabled={sendCode.loading}
        />
      </ScrollView>

      <View style={styles.footer}>
        <AppButton
          title={sendCode.loading ? 'Sending…' : 'Send code'}
          onPress={send}
          disabled={sendCode.loading}
          isBold
          noSpacing
        />
        <Text style={styles.note}>The code works once, for 5 minutes.</Text>
      </View>
    </Container>
  );
};

export default CodeChannelScreen;

const getStyles = look =>
  StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 10 },
    header: { height: 52, justifyContent: 'center', marginBottom: 12 },
    backButton: {
      position: 'absolute',
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
    },
    headerTitle: {
      fontSize: 16,
      fontFamily: 'Poppins Medium',
      color: look.text,
    },
    scrollContent: { paddingHorizontal: 20, paddingTop: 12 },
    title: {
      fontSize: 22,
      lineHeight: 30,
      fontFamily: 'Poppins Medium',
      color: look.text,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 14,
      fontFamily: 'Poppins Regular',
      color: look.muted,
      marginBottom: 28,
    },
    footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
    note: {
      fontSize: 12,
      fontFamily: 'Poppins Regular',
      color: look.muted,
      textAlign: 'center',
      marginTop: 12,
    },
  });
