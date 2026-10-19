import { registerRootComponent } from 'expo';

import App from './App';
import { registerBackgroundPushHandler } from '@/Services/Push/pushPlatform';

// FCM background handler must be registered outside React (no-op on web).
registerBackgroundPushHandler();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
