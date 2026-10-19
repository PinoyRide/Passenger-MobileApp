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
import { useTheme } from 'react-native-paper';
import { CommonActions, useNavigation } from '@react-navigation/native';
import {
  clearBookingState,
  clearSavedPlaces,
  clearUserInfo,
  selectUserInfo,
} from '@/Redux/Slices/userSlice';
import { useDispatch, useSelector } from 'react-redux';
import usePostRequest from '@/Services/Api';
import { AppUtil, Constants } from '@/Utils';
import { checkIsOnline } from '@/Utils/Network';

const SettingsScreen = () => {
  const { colors } = useTheme();
  const styles = getStyles({ colors });
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const userInfo = useSelector(selectUserInfo);
  const { makePostRequest, loading: loggingOut } = usePostRequest();

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

  const getDisplayName = () => {
    if (userInfo?.ekyc_details) {
      const { first_name, last_name } = userInfo.ekyc_details;

      const toTitleCase = str => {
        return str
          .toLowerCase()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      };

      return `${toTitleCase(first_name)} ${toTitleCase(last_name)}`;
    }
    return 'User';
  };

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

    const { response, error, offline } = await makePostRequest(
      Constants.ENDPOINT.LOGOUT,
      {},
    );

    if (error && offline) {
      Alert.alert('No Internet Connection', error);
      return;
    }
    // Any server refusal (e.g. "ongoing booking", often from a stale saved
    // booking) must not trap the user: log out locally regardless.
    if (error) {
      console.warn('Logout API refused; logging out locally:', error);
    }

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

  const handleLogout = () => {
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
          onPress={() => navigation.navigate('ProfileScreen')}>
          <Image
            source={
              userInfo?.ekyc_details?.selfie
                ? { uri: userInfo.ekyc_details.selfie }
                : require('@/Assets/Common/Sample_Profile.png')
            }
            style={styles.profile}
          />
          <View style={styles.profileTextContainer}>
            <Text style={styles.name}>{getDisplayName()}</Text>
          </View>
          <Text style={styles.profileLabel}>Profile</Text>
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
  });
