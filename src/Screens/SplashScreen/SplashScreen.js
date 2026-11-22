import { Image, StyleSheet, View } from 'react-native';
import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { selectActiveBooking, selectUserInfo } from '@/Redux/Slices/userSlice';
import { askBuildCheck } from '@/Utils/askBuildCheck';
import { needsConsent } from '@/Utils/consent';

// A new APK keeps the sign-in (the owner, 2026-11-23: reduce cost; every new
// sign-in is a paid code text): Android keeps the app's data on an update,
// and the backend lets a newer version take over its session anyway
// (LoginSession), so nothing is cleared here.

const SplashScreen = () => {
  const navigation = useNavigation();
  const userInfo = useSelector(selectUserInfo); // persisted value from redux-persist
  const activeBooking = useSelector(selectActiveBooking);

  useEffect(() => {
    const init = async () => {
      const [newerBuild] = await Promise.all([
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

      if (userInfo) {
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
