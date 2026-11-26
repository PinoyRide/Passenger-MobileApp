// first: release builds keep personal data out of the system log
import './src/Utils/quietLogs';
// second: a crash summary (error type and place in the code only) reaches the API (A-211)
import './src/Services/crashSummaryStart';
import { registerRootComponent } from 'expo';

import App from './App';
import { registerBackgroundPushHandler } from '@/Services/Push/pushPlatform';

// FCM background handler must be registered outside React (no-op on web).
registerBackgroundPushHandler();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
