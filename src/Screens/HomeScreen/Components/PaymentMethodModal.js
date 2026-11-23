import React, { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { AlertBox, AppButton } from '@/Components';
import TopUpAmountModal from './TopUpAmountModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomSpace } from '@/Utils/bottomSpace';
import useApiRequest from '@/Services/ApiV2';
import { toLegacyCustomer } from '@/Utils/customerMapper';
import { AppUtil, Constants } from '@/Utils';
import { selectUserInfo } from '@/Redux/Slices/userSlice';

// Cash, or the Pinoy Ride Wallet with its balance (back at the owner's request,
// 2026-11-22; hidden since the TOP PH days). The server checks the balance when
// the ride is booked and takes the fare when the trip ends. Advance bookings
// stay cash (the app switches them to cash). Top up opens the top-up page,
// which works once PayCools is switched on.
const PaymentMethodModal = ({
  visible,
  onClose,
  onSelect,
  selectedPayment = 'cash',
  cashOnly = false,
}) => {
  // The navigation bar may cover the bottom of the screen: keep the bottom content clear of it
  const { bottom: bottomInset } = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = getStyles({ colors });
  const userInfo = useSelector(selectUserInfo);
  const getCustomer = useApiRequest();

  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const [balance, setBalance] = useState(null);

  // the wallet's balance, read again each time the sheet opens
  useEffect(() => {
    if (!visible || !userInfo?.id) {
      return;
    }
    let cancelled = false;
    (async () => {
      const { response } = await getCustomer.request(
        'GET',
        Constants.API.CUSTOMER(userInfo.id),
      );
      const wallet = toLegacyCustomer(response?.data)?.wallet_details;
      if (!cancelled && wallet?.avail_balance !== undefined) {
        setBalance(wallet.avail_balance);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, userInfo?.id]);

  let walletNote = 'Balance …';
  if (cashOnly) {
    walletNote = 'Advance bookings are paid in cash';
  } else if (balance !== null) {
    walletNote = `Balance ₱${AppUtil.fn(balance)}`;
  }

  const handleTopUpError = errorMessage => {
    setAlertMessage(errorMessage);
    setShowAlert(true);
  };

  const handleTopUpSuccess = () => {
    onClose();
  };

  return (
    <>
      {/* alert for api errors */}
      {alertMessage ? (
        <AlertBox
          title="Error"
          message={alertMessage}
          visible={showAlert}
          setVisible={setShowAlert}
        />
      ) : null}

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View
          style={[
            styles.modalContainer,
            { paddingBottom: bottomSpace(bottomInset, 20) },
          ]}>
          <Text style={styles.title}>Select Payment</Text>

          {/* cash option */}
          <TouchableOpacity
            style={[
              styles.option,
              selectedPayment === 'cash' && styles.optionSelected,
            ]}
            onPress={() => {
              onSelect?.('cash');
              onClose();
            }}>
            <Image
              source={require('@/Assets/Common/HomeScreen/PaymentMethodModal/Cash.png')}
              style={styles.icon}
            />
            <Text style={styles.optionText}>Cash</Text>

            {selectedPayment === 'cash' && (
              <View style={styles.radioCircle}>
                <View style={styles.radioInner} />
              </View>
            )}
          </TouchableOpacity>

          {/* wallet option */}
          <TouchableOpacity
            disabled={cashOnly}
            accessibilityState={{
              disabled: cashOnly,
              selected: selectedPayment === 'wallet',
            }}
            style={[
              styles.option,
              selectedPayment === 'wallet' && styles.optionSelected,
              cashOnly && styles.optionDisabled,
            ]}
            onPress={() => {
              onSelect?.('wallet');
              onClose();
            }}>
            <Image
              source={require('@/Assets/Common/HomeScreen/PaymentMethodModal/Wallet.png')}
              style={styles.icon}
            />
            <View style={styles.optionBody}>
              <Text style={styles.optionName}>Pinoy Ride Wallet</Text>
              <Text style={styles.optionNote}>{walletNote}</Text>
            </View>
            {selectedPayment === 'wallet' && (
              <View style={styles.radioCircle}>
                <View style={styles.radioInner} />
              </View>
            )}
          </TouchableOpacity>

          <AppButton
            title="Top up the wallet"
            mode="outlined"
            noSpacing
            onPress={() => setShowTopUpModal(true)}
          />
        </View>
      </Modal>

      {/* top up amount modal */}
      <TopUpAmountModal
        visible={showTopUpModal}
        onClose={() => setShowTopUpModal(false)}
        onError={handleTopUpError}
        onSuccess={handleTopUpSuccess}
      />
    </>
  );
};

export default PaymentMethodModal;

const getStyles = ({ colors }) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.3)',
    },
    modalContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.lightGrey,
      padding: 20,
    },
    title: {
      fontFamily: 'Poppins Medium',
      fontSize: 20,
      marginBottom: 10,
      color: colors.text,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      padding: 12,
      borderRadius: 5,
      marginBottom: 12,
    },
    optionSelected: {
      backgroundColor: '#FEC10733',
    },
    icon: {
      width: 24,
      height: 24,
      resizeMode: 'contain',
      marginRight: 12,
    },
    optionText: {
      flex: 1,
      fontSize: 15,
      fontFamily: 'Poppins Regular',
      color: colors.text,
    },
    optionDisabled: {
      opacity: 0.5,
    },
    optionBody: {
      flex: 1,
    },
    optionName: {
      fontSize: 15,
      fontFamily: 'Poppins Regular',
      color: colors.text,
    },
    optionNote: {
      fontSize: 12,
      lineHeight: 16,
      fontFamily: 'Poppins Regular',
      color: colors.grey4 ?? colors.text,
    },
    radioCircle: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioInner: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    manageText: {
      fontSize: 16,
      fontFamily: 'Poppins Light',
      color: colors.primary,
      textAlign: 'center',
      marginTop: 12,
      marginBottom: 20,
    },
  });
