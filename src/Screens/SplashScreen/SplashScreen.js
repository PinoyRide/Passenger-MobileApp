import { Image, StyleSheet, View } from 'react-native';
import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearBookingState,
  clearSavedPlaces,
  clearUserInfo,
  selectActiveBooking,
  selectUserInfo,
} from '@/Redux/Slices/userSlice';
import { askBuildCheck } from '@/Utils/askBuildCheck';
import { deletePushToken } from '@/Services/Push/pushPlatform';
import AppUtil from '@/Utils/AppUtil';
import { needsConsent } from '@/Utils/consent';
import {
  LAST_RUN_VERSION_KEY,
  isUpdatedSinceLastRun,
} from '@/Utils/appVersionChange';

// First launch after an app update: drop the old login and push token so
// the passenger logs in fresh (the backend lets a newer version replace
// the stale session). Returns true when the session was cleared.
const clearSessionIfUpdated = async dispatch => {
  try {
    const current = AppUtil.getAppVersionNo();
    const lastRun = await AsyncStorage.getItem(LAST_RUN_VERSION_KEY);
    await AsyncStorage.setItem(LAST_RUN_VERSION_KEY, String(current));
    if (isUpdatedSinceLastRun(lastRun, current)) {
      await deletePushToken();
      dispatch(clearUserInfo());
      dispatch(clearBookingState());
      dispatch(clearSavedPlaces());
      return true;
    }
  } catch (err) {
    console.warn('Version check on launch failed:', err);
  }
  return false;
};

const SplashScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const userInfo = useSelector(selectUserInfo); // persisted value from redux-persist
  const activeBooking = useSelector(selectActiveBooking);

  useEffect(() => {
    const init = async () => {
      const [cleared, newerBuild] = await Promise.all([
        clearSessionIfUpdated(dispatch),
        // Is this build still accepted? Asked here, on the first screen, so
        // an outdated install is sent to the download at once, signed in or
        // not. A trip under way is left to finish.
        askBuildCheck('passenger', { tripUnderWay: !!activeBooking }),
        new Promise(resolve => setTimeout(resolve, 1000)),
      ]);

      if (newerBuild) {
        navigation.replace('UpdateRequiredScreen', newerBuild);
        return;
      }

      if (userInfo && !cleared) {
        // already logged in; the Terms and Privacy Policy come first when the
        // current ones have not been accepted yet
        if (needsConsent(userInfo)) {
          navigation.replace('GeneralTermsScreen', { mode: 'accept' });
        } else {
          navigation.replace('HomeScreen');
        }
      } else {
        navigation.replace('OnboardingScreen'); // first time or logged out
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Image
          source={require('@/Assets/Common/Pinoy_Ride.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
    </View>
  );
};

export default SplashScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 243,
    height: 175,
  },
});
