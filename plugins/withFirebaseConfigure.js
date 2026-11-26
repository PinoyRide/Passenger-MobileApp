// Starts Firebase in the iOS app, so push notifications work there.
//
// @react-native-firebase/app's own config plugin adds `import FirebaseCore`
// to the AppDelegate, but cannot find where to call FirebaseApp.configure()
// in Expo 54's AppDelegate.swift ("Unable to determine correct Firebase
// insertion point"), and skips it. This plugin puts the call first thing in
// didFinishLaunchingWithOptions, before React Native starts, every time the
// ios/ folder is made again (npx expo prebuild --platform ios). The same file
// in both apps.
const { withAppDelegate } = require('@expo/config-plugins');
const {
  mergeContents,
} = require('@expo/config-plugins/build/utils/generateCode');

const withFirebaseConfigure = config =>
  withAppDelegate(config, cfg => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error(
        'withFirebaseConfigure: expected a Swift AppDelegate (Expo 54)',
      );
    }
    let src = cfg.modResults.contents;
    if (!/^import FirebaseCore$/m.test(src)) {
      src = src.replace(/^import Expo$/m, 'import Expo\nimport FirebaseCore');
    }
    const merged = mergeContents({
      tag: 'pinoyride-firebase-configure',
      src,
      newSrc: '    FirebaseApp.configure()',
      // the first line of didFinishLaunchingWithOptions in Expo 54's template
      anchor: /let delegate = ReactNativeDelegate\(\)/,
      offset: 0,
      comment: '//',
    });
    if (
      !merged.didMerge &&
      !merged.didClear &&
      !src.includes('FirebaseApp.configure()')
    ) {
      throw new Error(
        'withFirebaseConfigure: no place for FirebaseApp.configure()',
      );
    }
    cfg.modResults.contents = merged.contents;
    return cfg;
  });

module.exports = withFirebaseConfigure;
