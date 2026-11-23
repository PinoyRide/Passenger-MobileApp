// What the app does when the API says its account was signed out or deleted
// (see Utils/signedOut.js): what Log Out in Settings does, without asking the
// server (it has signed the account out already), then the start screen and a
// message saying why. Imported once, by App.js.

import { CommonActions } from '@react-navigation/native';
import { store } from '@/Redux/store';
import {
  clearBookingState,
  clearSavedPlaces,
  clearUserInfo,
} from '@/Redux/Slices/userSlice';
import { navigationRef } from '@/Utils/NavigationService';
import { deletePushToken } from '@/Services/Push/pushPlatform';
import { setSignedOutHandler, signedOutNotice } from '@/Utils/signedOut';
import appAlert from '@/Utils/appAlert';

setSignedOutHandler(async reason => {
  // Nobody is signed in any more: this is the answer to a request that was
  // sent before the app signed out.
  if (!store.getState().user?.userInfo) {
    return;
  }
  try {
    // stop pushes to this phone (the server has cleared the saved token)
    await deletePushToken();
  } catch (e) {
    // There was none.
  }
  store.dispatch(clearUserInfo());
  store.dispatch(clearBookingState());
  store.dispatch(clearSavedPlaces());
  if (navigationRef.isReady()) {
    navigationRef.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'LandingScreen' }] }),
    );
  }

  const { title, message } = signedOutNotice(reason);
  appAlert(title, message);
});
