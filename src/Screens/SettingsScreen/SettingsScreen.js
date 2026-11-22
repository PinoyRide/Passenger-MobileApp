import React, { useEffect } from 'react';
import { deletePushToken } from '@/Services/Push/pushPlatform';
import {
  Alert,
  BackHandler,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Container from '@/Components/Container/Container';
import ProfileAvatar from '@/Components/ProfileAvatar/ProfileAvatar';
import { useTheme } from 'react-native-paper';
import { CommonActions, useNavigation } from '@react-navigation/native';
import {
  clearBookingState,
  clearSavedPlaces,
  clearUserInfo,
  selectActiveBooking,
  selectBookingStatus,
  selectUserInfo,
} from '@/Redux/Slices/userSlice';
import { useDispatch, useSelector } from 'react-redux';
import useApiRequest from '@/Services/ApiV2';
import { AppUtil, Constants } from '@/Utils';
import { checkIsOnline } from '@/Utils/Network';

const SettingsScreen = () => {
  const { colors } = useTheme();
  const styles = getStyles({ colors });
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const userInfo = useSelector(selectUserInfo);
  const activeBooking = useSelector(selectActiveBooking);
  const bookingStatus = useSelector(selectBookingStatus);
  const { request: logoutRequest, loading: loggingOut } = useApiRequest();

  useEffect(() => {
    AppUtil.debugDeep(userInfo);
  });

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        navigation.popToTop();
        return true;
      },
    );

    return () => backHandler.remove();
  }, [navigation]);

  const toTitleCase = str =>
    String(str || '')
      .toLowerCase()
      .split(' ')
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

  // A new account has no name or photo yet: say what to do instead of
  // showing a blank name beside somebody else's picture.
  const profileComplete = !!userInfo?.profile_complete;
  const displayName =
    [
      toTitleCase(userInfo?.ekyc_details?.first_name || userInfo?.fname),
      toTitleCase(userInfo?.ekyc_details?.last_name || userInfo?.lname),
    ]
      .filter(Boolean)
      .join(' ') || (profileComplete ? 'User' : 'Complete your profile');
  const photo = userInfo?.selfie || userInfo?.ekyc_details?.selfie || '';

  const buttonList = [
    {
      id: 'booking_history',
      label: 'Booking History',
      onPress: () => navigation.navigate('BookingHistoryScreen'),
    },
    {
      id: 'promo_and_referrals',
      label: 'Promo & Referrals',
      onPress: () => navigation.navigate('PromoReferralsScreen'),
    },
    {
      id: 'payment_option',
      label: 'Payment Option',
      onPress: () => navigation.navigate('PaymentOptionScreen'),
    },
    {
      id: 'wallet',
      label: 'Wallet',
      onPress: () => navigation.navigate('WalletScreen'),
    },
  ];

  const handleBack = () => {
    navigation.popToTop();
  };

  const performLogout = async () => {
    const online = await checkIsOnline();
    if (!online) {
      Alert.alert(
        'No Internet Connection',
        'Logging out requires an internet connection. Please reconnect and try again.',
      );
      return;
    }

    const { response, error, offline } = await logoutRequest(
      'POST',
      Constants.API.CUSTOMER_LOGOUT(userInfo.id),
    );

    if (error || !response || response?.code !== 200) {
      Alert.alert(
        offline ? 'No Internet Connection' : 'Ongoing Booking',
        error || response?.message || 'Failed to log out. Please try again.',
      );
      return;
    }

    await clearSessionAndGoToLanding();
  };

  const clearSessionAndGoToLanding = async () => {
    // stop pushes to this phone (backend also clears the saved token)
    await deletePushToken();
    dispatch(clearUserInfo());
    dispatch(clearBookingState());
    dispatch(clearSavedPlaces());

    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'LandingScreen' }],
      }),
    );
  };

  // Google Play requires apps that create accounts to let users delete them in
  // the app. Deleting is as strict as in the Admin Portal: DeleteAccountScreen.
  const handleDeleteAccount = () => navigation.navigate('DeleteAccountScreen');

  const handleLogout = async () => {
    if (activeBooking?.id && [1, 2].includes(Number(bookingStatus))) {
      Alert.alert(
        'Ongoing Booking',
        'You have an ongoing booking. Please complete your current booking first.',
      );
      return;
    }
    const online = await checkIsOnline();
    if (!online) {
      Alert.alert(
        'No Internet Connection',
        'Logging out requires an internet connection. Please reconnect and try again.',
      );
      return;
    }
    if (Platform.OS === 'web') {
      // Alert.alert buttons are no-ops on react-native-web.
      if (window.confirm('Are you sure you want to log out?')) {
        performLogout();
      }
      return;
    }
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: performLogout,
      },
    ]);
  };

  return (
    <Container style={styles.container}>
      <View>
        <TouchableOpacity onPress={handleBack}>
          <Image
            source={require('@/Assets/Common/Back.png')}
            style={styles.backIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.profileButton}
          onPress={() =>
            navigation.navigate(
              profileComplete ? 'ProfileScreen' : 'CompleteProfileScreen',
            )
          }>
          <ProfileAvatar uri={photo} size={46} />
          <View style={styles.profileTextContainer}>
            <Text style={styles.name}>{displayName}</Text>
          </View>
          <Text style={styles.profileLabel}>
            {profileComplete ? 'Profile' : 'Set up'}
          </Text>
        </TouchableOpacity>

        {buttonList.map(button => (
          <TouchableOpacity
            key={button.id}
            style={styles.buttons}
            onPress={button.onPress}>
            <Text style={styles.label}>{button.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.buttons, styles.logoutButton]}
          onPress={handleLogout}
          disabled={loggingOut}>
          <Text style={[styles.label, styles.logoutLabel]}>
            {loggingOut ? 'Logging Out...' : 'Log Out'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteAccountButton}
          onPress={handleDeleteAccount}
          disabled={loggingOut}>
          <Text style={styles.deleteAccountLabel}>Delete Account</Text>
        </TouchableOpacity>
      </View>
    </Container>
  );
};

export default SettingsScreen;

const getStyles = ({ colors }) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 15,
    },
    backIcon: {
      width: 23,
      height: 23,
      marginBottom: 20,
    },
    profileButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 18,
      paddingHorizontal: 20,
      borderRadius: 10,
      marginBottom: 17,
      shadowColor: colors.shadow,
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 3,
      backgroundColor: colors.onPrimary,
    },
    profileTextContainer: {
      flex: 1,
      marginLeft: 10,
    },
    profileLabel: {
      backgroundColor: colors.lightBlue,
      color: colors.shadow,
      paddingHorizontal: 10,
      paddingVertical: 2,
      borderRadius: 10,
      fontSize: 10,
      fontFamily: 'Poppins Regular',
    },
    profile: {
      width: 46,
      height: 46,
      borderRadius: 23,
    },
    name: {
      fontFamily: 'Poppins Medium',
      fontWeight: 500,
      fontSize: 14,
      color: colors.grey3,
    },
    buttons: {
      height: 40,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 33,
      borderRadius: 10,
      marginVertical: 5,
      shadowColor: colors.shadow,
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 3,
      backgroundColor: colors.onPrimary,
    },
    label: {
      fontFamily: 'Poppins Regular',
      fontWeight: 400,
      fontSize: 16,
      color: colors.grey3,
    },
    deleteAccountButton: {
      alignSelf: 'center',
      marginTop: 24,
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    deleteAccountLabel: {
      fontFamily: 'Poppins Regular',
      fontSize: 14,
      color: colors.error,
      textDecorationLine: 'underline',
    },
  });
