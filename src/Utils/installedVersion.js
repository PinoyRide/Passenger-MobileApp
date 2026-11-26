import DeviceInfo from 'react-native-device-info';
import { realVersion } from '@/Utils/displayVersion';

// The version of the APK that is installed, as the API counts it: what
// Android's App info shows (the APK's versionName), not the version of a
// self-update taken since. Since 2026-11-25 the versionName is the version
// people see (2.1.12), and the API's build check, its "Update Required"
// minimum and the sign-in compare real versions (2.0.111): realVersion turns
// it back. An APK built before keeps its real versionName (2.0.106), which
// comes back as it is. Everything that sends the installed version reads it
// here, never DeviceInfo.getVersion() itself (displayVersion.test.mjs). The
// same file in both apps (sharedUi.test.mjs).
export const installedVersion = () => realVersion(DeviceInfo.getVersion());
