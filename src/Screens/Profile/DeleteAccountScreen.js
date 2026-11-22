import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { CommonActions, useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { AppButton, AppTextInput, Container } from '@/Components';
import useApiRequest from '@/Services/ApiV2';
import { deletePushToken } from '@/Services/Push/pushPlatform';
import { Constants } from '@/Utils';
import { CONFIRM_WORD, canDelete, stage } from '@/Utils/accountDeletion';
import CodeChannelPicker from '@/Components/CodeChannelPicker/CodeChannelPicker';
import { EMAIL, SMS, maskedMobile } from '@/Utils/codeChannel';
import { handedCode } from '@/Utils/handedCode';
import {
  clearBookingState,
  clearSavedPlaces,
  clearUserInfo,
  selectUserInfo,
} from '@/Redux/Slices/userSlice';

// Deleting one's own account, as strictly as the Admin Portal deletes one
// (the owner, 2026-11-22). First what stands in the way (a booking not
// finished, a wallet not at zero); the code is sent only when nothing does,
// by text or to the account's email. Then the code and DELETE typed out.
// Trips stay on record without the passenger; everything else of theirs is
// removed for good.
const DeleteAccountScreen = () => {
  const { colors } = useTheme();
  const styles = getStyles({ colors });
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const userInfo = useSelector(selectUserInfo);

  const checkRequest = useApiRequest();
  const codeRequest = useApiRequest();
  const deleteRequest = useApiRequest();

  const [check, setCheck] = useState(null);
  const [channel, setChannel] = useState(SMS); // where the code is to go
  const [sentBy, setSentBy] = useState(null); // 'sms' | 'email' once a code went out
  const [code, setCode] = useState('');
  const [confirm, setConfirm] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    (async () => {
      const { response, error } = await checkRequest.request(
        'POST',
        Constants.API.CUSTOMER_DELETION_CHECK(userInfo.id),
        {},
      );
      if (error || !response?.data) {
        Alert.alert('Unable to Continue', error || 'Please try again.');
        navigation.goBack();
        return;
      }
      setCheck(response.data);
    })();
  }, []);

  const sendCode = async how => {
    const { response, error } = await codeRequest.request(
      'POST',
      Constants.API.CUSTOMER_DELETION_CODE(userInfo.id),
      { channel: how },
    );
    if (error || !response?.data) {
      Alert.alert('Code Not Sent', error || 'Please try again.');
      return;
    }
    setSentBy(how);
    // a test environment that hands a texted code to the app
    const handed = handedCode(response.data);
    if (handed) {
      setCode(handed);
    }
  };

  const deleteAccount = async () => {
    const { response, error } = await deleteRequest.request(
      'POST',
      Constants.API.CUSTOMER_DELETION(userInfo.id),
      { code: code.trim(), confirm: confirm.trim(), reason: reason.trim() },
    );
    if (error || !response) {
      Alert.alert('Account Not Deleted', error || 'Please try again.');
      return;
    }
    await deletePushToken();
    dispatch(clearUserInfo());
    dispatch(clearBookingState());
    dispatch(clearSavedPlaces());
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'LandingScreen' }] }),
    );
    Alert.alert('Account Deleted', 'Your Pinoy Ride account has been deleted.');
  };

  const sentTo =
    sentBy === EMAIL ? check?.emailHint : maskedMobile(userInfo?.mobile);

  const body = () => {
    if (!check) {
      return (
        <ActivityIndicator color={colors.primary} style={styles.spinner} />
      );
    }
    if (stage(check) === 'blocked') {
      return (
        <View>
          <Text style={styles.title}>You can't delete your account yet</Text>
          {check.blockers.map(blocker => (
            <Text key={blocker} style={styles.blocker}>
              {blocker}
            </Text>
          ))}
        </View>
      );
    }
    return (
      <View>
        <Text style={styles.title}>Delete your account for good</Text>
        <Text style={styles.text}>
          Your account, saved places, wallet and its history, and your identity
          checks are removed. Your past trips stay on record for the riders and
          for payments, without your name on them. This cannot be undone.
        </Text>

        {!sentBy ? (
          <View style={styles.actions}>
            <Text style={styles.subtitle}>
              First we send you a code to confirm it is you. Where should it go?
            </Text>
            <CodeChannelPicker
              mobileNumber={userInfo?.mobile}
              options={check}
              selected={channel}
              onSelect={setChannel}
              disabled={codeRequest.loading}
            />
            <View style={styles.sendButton}>
              <AppButton
                title={codeRequest.loading ? 'Sending…' : 'Send code'}
                onPress={() => sendCode(channel)}
                disabled={codeRequest.loading}
                isBold
                noSpacing
              />
            </View>
          </View>
        ) : (
          <View style={styles.actions}>
            <Text style={styles.subtitle}>A code was sent to {sentTo}.</Text>
            <AppTextInput
              label="Code"
              value={code}
              onChangeText={setCode}
              inputMode="numeric"
              placeholder="6 digits"
            />
            <AppTextInput
              label={`Type ${CONFIRM_WORD} to confirm`}
              value={confirm}
              onChangeText={setConfirm}
              autoCapitalize="characters"
              placeholder={CONFIRM_WORD}
            />
            <AppTextInput
              label="Why are you leaving? (optional)"
              value={reason}
              onChangeText={setReason}
              placeholder="Optional"
            />
            <AppButton
              title={deleteRequest.loading ? 'Deleting…' : 'Delete my account'}
              onPress={deleteAccount}
              buttonColor={colors.error}
              disabled={deleteRequest.loading || !canDelete({ code, confirm })}
              isBold
            />
            <TouchableOpacity
              onPress={() => sendCode(sentBy)}
              disabled={codeRequest.loading}
              style={styles.resend}>
              <Text style={styles.resendText}>Send a new code</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <Container style={styles.container}>
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
          <Text style={styles.headerTitle}>Delete Account</Text>
        </View>
      </View>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {body()}
        </ScrollView>
      </TouchableWithoutFeedback>
    </Container>
  );
};

export default DeleteAccountScreen;

const getStyles = ({ colors }) =>
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
      color: colors.shadow,
    },
    scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 },
    spinner: { marginTop: 48 },
    title: {
      fontSize: 20,
      fontFamily: 'Poppins Medium',
      color: colors.shadow,
      marginBottom: 12,
    },
    text: {
      fontSize: 14,
      fontFamily: 'Poppins Regular',
      color: colors.grey4,
      lineHeight: 21,
      marginBottom: 20,
    },
    blocker: {
      fontSize: 14,
      fontFamily: 'Poppins Regular',
      color: colors.shadow,
      lineHeight: 21,
      marginBottom: 12,
    },
    subtitle: {
      fontSize: 13,
      fontFamily: 'Poppins Medium',
      color: colors.shadow,
      marginBottom: 4,
    },
    actions: { gap: 4 },
    sendButton: { marginTop: 16 },
    resend: { alignSelf: 'center', paddingVertical: 12 },
    resendText: {
      fontSize: 13,
      fontFamily: 'Poppins Medium',
      color: colors.grey4,
    },
  });
