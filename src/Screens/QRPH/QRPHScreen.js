import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import InAppBrowser from 'react-native-inappbrowser-reborn';

import { AlertBox } from '@/Components';
import usePostRequest from '@/Services/Api';
import { AppUtil, Constants } from '@/Utils';
import { CHECK_EVERY_MS, paymentOutcome } from '@/Utils/paymentWait';

const FLOW = {
  INIT: 'INIT',
  CHECKING: 'CHECKING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
};

const QRPHScreen = () => {
  const { colors } = useTheme();
  const styles = getStyles({ colors });
  const navigation = useNavigation();
  const route = useRoute();

  const { paymentData } = route.params || {};
  const paymentUrl = paymentData?.paymentUrl || paymentData?.payment_url;
  const referenceId = paymentData?.referenceId || paymentData?.reference_id;

  const [flowState, setFlowState] = useState(FLOW.INIT);
  const [alertMessage, setAlertMessage] = useState('');

  const checkPaymentStatus = usePostRequest();
  const intervalRef = useRef(null);
  const referenceIdRef = useRef(referenceId);

  useEffect(() => {
    referenceIdRef.current = referenceId;
  }, [referenceId]);

  // Asks the backend where the payment stands (qrph/check_status/). Kept in a
  // ref, so the timer and the listener below always call the latest one.
  const checkNowRef = useRef(() => {});
  checkNowRef.current = () => {
    if (!referenceIdRef.current) {
      return;
    }
    checkPaymentStatus.makePostRequest(
      Constants.ENDPOINT.QRPH_CHECK_STATUS,
      { reference_id: referenceIdRef.current },
      {},
      'json',
    );
  };

  // Opens PayCools' payment page. When the person closes it, the screen goes
  // on waiting and asks at once (until 2026-11-23 it went blank instead).
  const openPayment = async url => {
    try {
      if (await InAppBrowser.isAvailable()) {
        await InAppBrowser.open(url, {
          showTitle: true,
          enableUrlBarHiding: true,
          enableDefaultShare: false,
          modalEnabled: true,
        });
      } else {
        await Linking.openURL(url);
      }
    } catch {
      Linking.openURL(url);
    }
    checkNowRef.current();
  };

  useEffect(() => {
    if (paymentUrl && referenceId) {
      setFlowState(FLOW.CHECKING);
      openPayment(paymentUrl);
    }
  }, [paymentUrl, referenceId]);

  useEffect(() => {
    if (flowState !== FLOW.CHECKING) {
      return;
    }

    intervalRef.current = setInterval(
      () => checkNowRef.current(),
      CHECK_EVERY_MS,
    );

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [flowState]);

  useEffect(() => {
    const result = checkPaymentStatus.response?.data;
    AppUtil.debugDeep(result);
    const outcome = paymentOutcome(result?.status);
    if (outcome === 'waiting') {
      return; // not paid yet: keep asking
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (outcome === 'success') {
      setFlowState(FLOW.SUCCESS);

      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'AppTransactionComplete',
            params: {
              referenceData: {
                amount: paymentData?.amount || '0.00',
                referenceId: result?.referenceId || referenceId,
                status: result.status,
                timestamp: result?.ts || new Date().toISOString(),
                paymentMethod: 'QRPH',
              },
            },
          },
        ],
      });
      return;
    }

    if (outcome === 'failed') {
      setFlowState(FLOW.FAILED);
      setAlertMessage('Payment failed. Please try again.');
      return;
    }

    if (outcome === 'expired') {
      setFlowState(FLOW.EXPIRED);
      setAlertMessage('Payment expired. Please restart the payment.');
    }
  }, [checkPaymentStatus.response]);

  // Timers do not run while the browser or the banking app is in front: ask
  // at once when the person comes back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && flowState === FLOW.CHECKING) {
        checkNowRef.current();
      }
    });

    return () => sub.remove();
  }, [flowState]);

  const handleBack = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    navigation.goBack();
  };

  if (!paymentUrl) {
    return (
      <View style={styles.container}>
        <Text style={{ color: colors.text }}>No payment URL provided</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={handleBack} style={styles.iconButton}>
            <Image
              source={require('@/Assets/Common/Back_2.png')}
              style={styles.backIcon}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>QRPH</Text>
          <View style={styles.spacing} />
        </View>
      </View>

      {!!alertMessage && (
        <AlertBox
          title="Payment Status"
          message={alertMessage}
          visible={true}
          setVisible={() => setAlertMessage('')}
        />
      )}

      <View style={styles.center}>
        {flowState === FLOW.CHECKING && (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.text}>Complete payment in your browser</Text>
            <Text style={styles.subText}>
              This screen will update automatically
            </Text>
            <TouchableOpacity onPress={() => openPayment(paymentUrl)}>
              <Text style={[styles.text, { color: colors.primary }]}>
                Open the payment page again
              </Text>
            </TouchableOpacity>
          </>
        )}

        {(flowState === FLOW.FAILED || flowState === FLOW.EXPIRED) && (
          <TouchableOpacity onPress={handleBack}>
            <Text style={[styles.text, { color: colors.primary }]}>
              Start a new payment
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default QRPHScreen;

const getStyles = ({ colors }) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    headerContainer: {
      backgroundColor: colors.primary,
      paddingTop: 60,
      paddingBottom: 20,
      paddingHorizontal: 20,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconButton: { width: 25 },
    spacing: { width: 25 },
    backIcon: { width: 23, height: 23 },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      color: colors.onPrimary,
      fontSize: 16,
      fontFamily: 'Poppins Regular',
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 30,
    },
    text: {
      marginTop: 16,
      fontSize: 16,
      fontFamily: 'Poppins Regular',
      color: colors.text,
      textAlign: 'center',
    },
    subText: {
      marginTop: 8,
      fontSize: 13,
      color: colors.grey4,
      textAlign: 'center',
    },
  });
