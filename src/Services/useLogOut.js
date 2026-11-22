import { Alert, Platform } from 'react-native';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import useApiRequest from '@/Services/ApiV2';
import { deletePushToken } from '@/Services/Push/pushPlatform';
import { Constants as AppConstants } from '@/Utils';
import { checkIsOnline } from '@/Utils/Network';
import {
  clearBookingState,
  clearSavedPlaces,
  clearUserInfo,
  selectActiveBooking,
  selectBookingStatus,
  selectUserInfo,
} from '@/Redux/Slices/userSlice';

// Logging out, from Settings and from the bottom of the Account page (the
// owner, 2026-11-22): refused while a booking is under way, asked to confirm,
// then the server, this phone's push token and the stored account go, and the
// app returns to its landing page.
const useLogOut = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const userInfo = useSelector(selectUserInfo);
  const activeBooking = useSelector(selectActiveBooking);
  const bookingStatus = useSelector(selectBookingStatus);
  const { request: logoutRequest, loading: loggingOut } = useApiRequest();

  const logOut = async () => {
    if (!(await checkIsOnline())) {
      Alert.alert(
        'No Internet Connection',
        'Logging out requires an internet connection. Please reconnect and try again.',
      );
      return;
    }
    const { response, error, offline } = await logoutRequest(
      'POST',
      AppConstants.API.CUSTOMER_LOGOUT(userInfo.id),
    );
    if (error || !response || response?.code !== 200) {
      Alert.alert(
        offline ? 'No Internet Connection' : 'Ongoing Booking',
        error || response?.message || 'Failed to log out. Please try again.',
      );
      return;
    }
    // stop pushes to this phone (backend also clears the saved token)
    await deletePushToken();
    dispatch(clearUserInfo());
    dispatch(clearBookingState());
    dispatch(clearSavedPlaces());
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'LandingScreen' }] }),
    );
  };

  const confirmLogOut = async () => {
    if (activeBooking?.id && [1, 2].includes(Number(bookingStatus))) {
      Alert.alert(
        'Ongoing Booking',
        'You have an ongoing booking. Please complete your current booking first.',
      );
      return;
    }
    if (Platform.OS === 'web') {
      // Alert.alert buttons are no-ops on react-native-web.
      if (window.confirm('Are you sure you want to log out?')) {
        logOut();
      }
      return;
    }
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logOut },
    ]);
  };

  return { confirmLogOut, loggingOut };
};

export default useLogOut;
