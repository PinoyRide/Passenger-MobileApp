import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { en, registerTranslation } from 'react-native-paper-dates';

registerTranslation('en', en);
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import ApplicationNavigator from '@/Navigators/Application';
import PushNotificationManager from '@/Services/Push/PushNotificationManager';
import { persistor, store } from '@/Redux/store';
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

const App = () => {
  const [fontsLoaded] = useFonts({
    'AvenirLTStd-Roman': require('./src/Assets/Fonts/AvenirLTStd-Roman.ttf'),
    'AvenirLTStd-Medium': require('./src/Assets/Fonts/AvenirLTStd-Medium.ttf'),
    'AvenirLTStd-Black': require('./src/Assets/Fonts/AvenirLTStd-Black.ttf'),
    'Poppins Regular': require('./src/Assets/Fonts/Poppins/Poppins-Regular.ttf'),
    'Poppins Medium': require('./src/Assets/Fonts/Poppins/Poppins-Medium.ttf'),
    'Poppins SemiBold': require('./src/Assets/Fonts/Poppins/Poppins-SemiBold.ttf'),
    'Poppins Light': require('./src/Assets/Fonts/Poppins/Poppins-Light.ttf'),
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: 'white' }} />;
  }

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        {/* nativeID: how the screen shown while the app starts (android LaunchScreen.kt)
            learns that the app has drawn its first screen, and leaves. */}
        <View style={styles.container} nativeID="app-ready">
          {/* Edge to edge (Android 15+, required at target 36): the status bar is transparent over the
              app's light screens, so its icons must be dark or they disappear on dark-mode phones. */}
          <StatusBar style="dark" />
          <ApplicationNavigator />
          <PushNotificationManager />
          <UpdateWhenReady />
        </View>
      </PersistGate>
    </Provider>
  );
};

export default App;

const styles = StyleSheet.create({
  container: { flex: 1 },
});
