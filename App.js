import React from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { en, registerTranslation } from 'react-native-paper-dates';

registerTranslation('en', en);
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import ApplicationNavigator from '@/Navigators/Application';
import PushNotificationManager from '@/Services/Push/PushNotificationManager';
import { persistor, store } from '@/Redux/store';
import { ThemeProvider, useAppTheme } from '@/Contexts/ThemeContext';
// Signs the app out when the API says its account was signed out or deleted.
import '@/Services/signedOutHandler';
import useUpdateWhenReady from '@/Services/useUpdateWhenReady';
import { passengerBusy } from '@/Services/updateBusy';

// Restarts into an update as soon as it is downloaded and nothing would be cut
// off (the owner, 2026-11-22): Services/useUpdateWhenReady.js.
const UpdateWhenReady = () => {
  useUpdateWhenReady(passengerBusy);
  return null;
};

// The app in the light or the dark look (Settings > Dark mode).
const ThemedApp = () => {
  const { theme, isDark } = useAppTheme();

  return (
    // nativeID: how the screen shown while the app starts (android LaunchScreen.kt)
    // learns that the app has drawn its first screen, and leaves.
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      nativeID="app-ready">
      {/* Edge to edge (Android 15+, required at target 36): the status bar is see-through over
          the app, so its icons take the look's opposite or they disappear (dark on the light look,
          light on the dark one), whatever the phone's own setting. */}
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ApplicationNavigator />
      <PushNotificationManager />
      <UpdateWhenReady />
    </View>
  );
};

const App = () => {
  const phone = useColorScheme();
  const [fontsLoaded] = useFonts({
    'AvenirLTStd-Roman': require('./src/Assets/Fonts/AvenirLTStd-Roman.ttf'),
    'AvenirLTStd-Medium': require('./src/Assets/Fonts/AvenirLTStd-Medium.ttf'),
    'AvenirLTStd-Black': require('./src/Assets/Fonts/AvenirLTStd-Black.ttf'),
    'Poppins Regular': require('./src/Assets/Fonts/Poppins/Poppins-Regular.ttf'),
    'Poppins Medium': require('./src/Assets/Fonts/Poppins/Poppins-Medium.ttf'),
    'Poppins SemiBold': require('./src/Assets/Fonts/Poppins/Poppins-SemiBold.ttf'),
  });

  if (!fontsLoaded) {
    // in the phone's look: the theme is not there yet (QA UPD-14: no white
    // screen on a dark phone); the colours of LightTheme/DarkTheme.js
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: phone === 'dark' ? 'rgb(28, 27, 30)' : '#FFFFFF',
        }}
      />
    );
  }

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ThemeProvider>
          <ThemedApp />
        </ThemeProvider>
      </PersistGate>
    </Provider>
  );
};

export default App;

const styles = StyleSheet.create({
  container: { flex: 1 },
});
