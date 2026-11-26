// Makes the pods build with Xcode 27. A step in the Podfile's post_install, put
// there every time the ios/ folder is made again (npx expo prebuild --platform
// ios). The same file in both apps.
//
// - Every target of the Pods project gets at least the app's iOS version
//   (ios.deploymentTarget, set by expo-build-properties). Xcode 27 builds for
//   iOS 15.0 and later only, and refuses a target set lower. React Native's
//   post_install raises each library, but not the small resource bundles some
//   ship beside their code (FirebaseCore_Privacy, GoogleMapsResources, ...),
//   which keep the iOS 9 to 14 their podspecs name.
// - fmt (11.0, the text formatting library React Native builds with) is
//   compiled as C++17. As C++20 it checks format strings with consteval, and
//   Xcode 27's compiler refuses fmt's own source ("call to consteval function
//   ... is not a constant expression"). C++17 turns that check off, nothing
//   else.
//
// The step goes after React Native's own post_install, which sets every pod
// to C++20.
const { withPodfile } = require('@expo/config-plugins');
const {
  mergeContents,
} = require('@expo/config-plugins/build/utils/generateCode');

const STEP = [
  "    app_ios = podfile_properties['ios.deploymentTarget'] || '15.1'",
  '    installer.pods_project.targets.each do |target|',
  '      target.build_configurations.each do |build|',
  "        pod_ios = build.build_settings['IPHONEOS_DEPLOYMENT_TARGET']",
  '        if pod_ios && Gem::Version.new(pod_ios) < Gem::Version.new(app_ios)',
  "          build.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = app_ios",
  '        end',
  "        if target.name == 'fmt'",
  "          build.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'",
  '        end',
  '      end',
  '    end',
].join('\n');

const CALL = /^\s*react_native_post_install\(/;

const withPodsForXcode27 = config =>
  withPodfile(config, cfg => {
    const src = cfg.modResults.contents;
    const lines = src.split('\n');
    const start = lines.findIndex(line => CALL.test(line));
    const end = lines.findIndex(
      (line, i) => i > start && /^\s*\)\s*$/.test(line),
    );
    if (start < 0 || end < 0) {
      throw new Error(
        'withPodsForXcode27: no react_native_post_install(...) call in the Podfile',
      );
    }
    cfg.modResults.contents = mergeContents({
      tag: 'pinoyride-pods-for-xcode-27',
      src,
      newSrc: STEP,
      anchor: CALL,
      // the line after the call's closing parenthesis
      offset: end - start + 1,
      comment: '#',
    }).contents;
    return cfg;
  });

module.exports = withPodsForXcode27;
