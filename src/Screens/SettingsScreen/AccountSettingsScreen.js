import React from 'react';
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { useTheme } from 'react-native-paper';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import Container from '@/Components/Container/Container';
import { MenuGroup, MenuRow } from '@/Components/Menu/Menu';
import useApiRequest from '@/Services/ApiV2';
import { deletePushToken } from '@/Services/Push/pushPlatform';
import { Constants as AppConstants } from '@/Utils';
import { checkIsOnline } from '@/Utils/Network';
import { runningUpdateLabel } from '@/Utils/selfUpdate';
import { modern } from '@/Theme/modern';
import {
  clearBookingState,
  clearSavedPlaces,
  clearUserInfo,
  selectActiveBooking,
  selectBookingStatus,
  selectUserInfo,
} from '@/Redux/Slices/userSlice';

// Settings (the owner, 2026-11-22: "in my profile or profile page put the
// logout and delete account in settings menu, do this for rider and
// passenger"). Opened from the profile page. The same screen in the Rider
// app. Deleting the account is as strict as in the Admin Portal:
// DeleteAccountScreen.
const AccountSettingsScreen = () => {
  const look = modern(useTheme());
  const styles = getStyles(look);
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const userInfo = useSelector(selectUserInfo);
  const activeBooking = useSelector(selectActiveBooking);
  const bookingStatus = useSelector(selectBookingStatus);
  const { request: logoutRequest, loading: loggingOut } = useApiRequest();

  const appVersion = Constants.expoConfig?.version ?? '';
  const environment = AppConstants.IS_DEV ? ' · Develop' : '';
  const update = runningUpdateLabel();

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
          <Text style={styles.headerTitle}>Settings</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <MenuGroup>
          <MenuRow
            icon="logout"
            title="Log out"
            note="Sign out on this phone"
            onPress={confirmLogOut}
            busy={loggingOut}
          />
        </MenuGroup>

        <MenuGroup style={styles.secondGroup}>
          <MenuRow
            icon="account-remove-outline"
            title="Delete account"
            note="Remove your account for good. We send you a code first."
            tone="danger"
            onPress={() => navigation.navigate('DeleteAccountScreen')}
            disabled={loggingOut}
          />
        </MenuGroup>

        <Text style={styles.version}>
          Pinoy Ride v{appVersion}
          {environment}
          {update ? ` · ${update}` : ''}
        </Text>
      </ScrollView>
    </Container>
  );
};

export default AccountSettingsScreen;

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
    scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
    secondGroup: { marginTop: 20 },
    version: {
      marginTop: 28,
      textAlign: 'center',
      fontSize: 12,
      fontFamily: 'Poppins Regular',
      color: look.muted,
    },
  });
