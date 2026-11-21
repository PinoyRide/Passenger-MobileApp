import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  useIsFocused,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { File } from 'expo-file-system';
import FaceDetection from '@react-native-ml-kit/face-detection';
import {
  STEPS,
  advance,
  describeFace,
  isGoodPortrait,
  pickPictureSize,
  start,
  stepsPassed,
} from '@/Utils/livenessCheck';

// Takes the passenger's profile photo, and makes sure a real person is taking
// it of themselves: they are asked to look straight, turn their head a little
// one way, then the other, then look straight again (see livenessCheck.js).
// The camera is sampled about once a second and each sample is scanned for a
// face on the phone itself; nothing leaves the phone until the final photo is
// saved with the profile.
//
// Hands the photo back to the screen named in route.params.returnTo
// (CompleteProfileScreen by default) as params.capturedSelfie.

const PROMPTS = {
  straight: 'Look straight at the camera',
  firstTurn: 'Slowly turn your head a little to the right',
  otherTurn: 'Now turn your head a little to the left',
  finish: 'Look straight at the camera again',
  done: 'Hold still…',
};

const PROBLEMS = {
  no_face: "We can't see your face. Hold the phone in front of you.",
  many_faces: 'Only one person should be in the picture.',
  too_far: 'Bring the phone a little closer.',
  off_center: 'Keep your face inside the oval.',
  eyes_closed: 'Keep your eyes open.',
  restarted: "Let's start again. Keep your face in view the whole time.",
};

// Samples used only for checking: small and quick.
const SAMPLE_QUALITY = 0.35;
// The photo that is kept.
const PHOTO_QUALITY = 0.85;
const PAUSE_BETWEEN_SAMPLES_MS = 150;
// Still on the second turn after this long: they may be turning the same way.
const OTHER_SIDE_HINT_MS = 5000;
// This many camera or scanner failures in a row and we stop and say so.
const MAX_FAILURES = 4;
// How long to wait for the camera's "ready" signal before starting anyway.
const CAMERA_START_GRACE_MS = 3000;

const DETECTOR_OPTIONS = {
  performanceMode: 'fast',
  classificationMode: 'all', // eyes open
  minFaceSize: 0.15,
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const discard = uri => {
  try {
    new File(uri).delete();
  } catch (e) {
    // A leftover sample in the cache folder is harmless.
  }
};

const LivenessSelfieScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const isFocused = useIsFocused();
  const returnTo = route.params?.returnTo || 'CompleteProfileScreen';

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [pictureSize, setPictureSize] = useState(undefined);

  const checkRef = useRef(start(Date.now()));
  const [step, setStep] = useState('straight');
  const [problem, setProblem] = useState(null);
  const [showOtherSideHint, setShowOtherSideHint] = useState(false);
  const [finished, setFinished] = useState(false);
  const [failure, setFailure] = useState('');
  const [attempt, setAttempt] = useState(0);
  // Development builds only (see skipInDevelopment).
  const devSkipRef = useRef(false);
  const [skipping, setSkipping] = useState(false);

  const handBack = useCallback(
    photo => {
      navigation.popTo(
        returnTo,
        {
          capturedSelfie: {
            uri: photo.uri,
            type: 'image/jpeg',
            fileName: 'selfie.jpg',
          },
        },
        { merge: true },
      );
    },
    [navigation, returnTo],
  );

  // The camera is usable as soon as it says so. Choosing a picture size is a
  // refinement and must never hold that up: on some phones the size query
  // does not answer when the camera is opened a second time.
  const onCameraReady = useCallback(() => {
    setCameraReady(true);
    const query = cameraRef.current?.getAvailablePictureSizesAsync?.();
    if (query && typeof query.then === 'function') {
      query
        .then(sizes => setPictureSize(pickPictureSize(sizes)))
        .catch(() => {});
    }
  }, []);

  // Some phones never send the "ready" signal on a later visit either. If
  // the preview has had time to start, begin anyway: a camera that really is
  // not ready shows up as failed samples, and those are retried.
  useEffect(() => {
    if (!isFocused || cameraReady || !permission?.granted) {
      return undefined;
    }
    const timer = setTimeout(() => setCameraReady(true), CAMERA_START_GRACE_MS);
    return () => clearTimeout(timer);
  }, [isFocused, cameraReady, permission?.granted]);

  // The check: sample, scan, advance, repeat, until every step is passed and
  // a good final photo is taken.
  useEffect(() => {
    if (!cameraReady || !isFocused || finished || failure) {
      return undefined;
    }
    let stopped = false;
    let failures = 0;
    checkRef.current = start(Date.now());
    setStep('straight');
    setProblem(null);

    const scan = async quality => {
      const photo = await cameraRef.current.takePictureAsync({
        quality,
        shutterSound: false,
        exif: false,
      });
      const found = await FaceDetection.detect(photo.uri, DETECTOR_OPTIONS);
      return {
        photo,
        faces: found.map(f => describeFace(f, photo.width, photo.height)),
      };
    };

    const run = async () => {
      while (!stopped) {
        try {
          const { photo, faces } = await scan(
            devSkipRef.current ? PHOTO_QUALITY : SAMPLE_QUALITY,
          );
          if (stopped) {
            discard(photo.uri);
            return;
          }
          if (devSkipRef.current) {
            // Development builds only (see the Skip button below).
            setFinished(true);
            handBack(photo);
            return;
          }
          discard(photo.uri);
          failures = 0;
          const now = Date.now();
          const result = advance(checkRef.current, faces, now);
          checkRef.current = result.state;
          setStep(result.state.step);
          setProblem(result.problem);
          setShowOtherSideHint(
            result.state.step === 'otherTurn' &&
              now - result.state.stepStartedAt > OTHER_SIDE_HINT_MS,
          );

          if (result.done) {
            // Every step passed: take the photo that is kept, and make sure
            // it too shows the one face, looking at the camera.
            const final = await scan(PHOTO_QUALITY);
            if (stopped) {
              discard(final.photo.uri);
              return;
            }
            if (isGoodPortrait(final.faces)) {
              setFinished(true);
              handBack(final.photo);
              return;
            }
            discard(final.photo.uri);
            checkRef.current = {
              ...checkRef.current,
              step: 'finish',
              stepStartedAt: Date.now(),
            };
            setStep('finish');
          }
        } catch (e) {
          failures += 1;
          if (failures >= MAX_FAILURES) {
            if (!stopped) {
              setFailure(
                "The camera isn't responding. Close other apps using the camera and try again.",
              );
            }
            return;
          }
        }
        await sleep(PAUSE_BETWEEN_SAMPLES_MS);
      }
    };

    run();
    return () => {
      stopped = true;
    };
  }, [cameraReady, isFocused, finished, failure, attempt, handBack]);

  // Development builds only: the emulator's front camera has no face in it,
  // so the check can never pass there. This keeps the next camera sample as
  // the photo, without the check, so the rest of the profile flow can be
  // tried. The button is not part of release builds.
  const skipInDevelopment = () => {
    devSkipRef.current = true;
    setSkipping(true);
  };

  const retry = () => {
    setFailure('');
    setAttempt(n => n + 1);
  };

  const header = (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
        accessibilityLabel="Back">
        <Image
          source={require('@/Assets/Common/Back.png')}
          style={styles.backIcon}
          resizeMode="contain"
        />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Take Your Photo</Text>
    </View>
  );

  if (!permission) {
    return <View style={styles.screen}>{header}</View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.centered}>
          <Text style={styles.messageTitle}>Camera access is needed</Text>
          <Text style={styles.messageText}>
            Your profile photo is taken with the camera so riders can recognise
            you at pickup.
          </Text>
          <TouchableOpacity style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>Allow Camera</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const passed = stepsPassed({ step });
  const message = problem ? PROBLEMS[problem] : null;

  return (
    <View style={styles.screen}>
      {/* The camera fills a 3:4 box, not the whole screen: the photo comes
          out with the proportions of a portrait instead of a tall strip. */}
      <View style={styles.cameraBox}>
        {isFocused && (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="front"
            animateShutter={false}
            pictureSize={pictureSize}
            onCameraReady={onCameraReady}
            onMountError={() =>
              setFailure('The camera could not be opened on this phone.')
            }
          />
        )}
        {/* Oval guide */}
        <View style={styles.guideLayer} pointerEvents="none">
          <View
            style={[
              styles.oval,
              passed >= STEPS.length && styles.ovalDone,
              message && styles.ovalProblem,
            ]}
          />
        </View>
      </View>

      {header}

      <View style={styles.panel}>
        {failure ? (
          <>
            <Text style={styles.prompt}>{failure}</Text>
            <TouchableOpacity style={styles.button} onPress={retry}>
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
          </>
        ) : !cameraReady ? (
          <>
            <ActivityIndicator color="#FFFFFF" />
            <Text style={styles.hint}>Starting the camera…</Text>
          </>
        ) : (
          <>
            <View style={styles.steps} accessibilityLabel="Progress">
              {STEPS.map((name, index) => (
                <View
                  key={name}
                  style={[styles.stepDot, index < passed && styles.stepDotDone]}
                />
              ))}
            </View>
            <Text style={styles.prompt} accessibilityLiveRegion="polite">
              {PROMPTS[step]}
            </Text>
            <Text style={[styles.hint, message && styles.hintProblem]}>
              {message ||
                (showOtherSideHint
                  ? 'Turn to the other side from before.'
                  : 'This checks that the photo is really you.')}
            </Text>
          </>
        )}

        {__DEV__ && cameraReady && !failure ? (
          <TouchableOpacity
            onPress={skipInDevelopment}
            style={styles.devSkip}
            accessibilityLabel="Skip check, development build only">
            <Text style={styles.devSkipText}>
              {skipping
                ? 'Taking the photo…'
                : 'Skip check (development build only)'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

export default LivenessSelfieScreen;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 44,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backButton: {
    position: 'absolute',
    left: 10,
    top: 44,
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: { width: 23, height: 23, tintColor: '#FFFFFF' },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Poppins Medium',
    color: '#FFFFFF',
  },
  cameraBox: {
    width: '100%',
    aspectRatio: 3 / 4,
    marginTop: 44,
    overflow: 'hidden',
    backgroundColor: '#111111',
  },
  guideLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  oval: {
    width: 230,
    height: 300,
    borderRadius: 150,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  ovalProblem: { borderColor: '#FFC107' },
  ovalDone: { borderColor: '#4CAF50' },
  panel: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  steps: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  stepDot: {
    width: 28,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  stepDotDone: { backgroundColor: '#FFC107' },
  prompt: {
    fontSize: 20,
    lineHeight: 28,
    fontFamily: 'Poppins Medium',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  hint: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Poppins Regular',
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  hintProblem: { color: '#FFC107' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  messageTitle: {
    fontSize: 18,
    fontFamily: 'Poppins Medium',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Poppins Regular',
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
    backgroundColor: '#FFC107',
  },
  buttonText: {
    fontSize: 15,
    fontFamily: 'Poppins Medium',
    color: '#1A1A1A',
  },
  devSkip: { marginTop: 14, padding: 8 },
  devSkipText: {
    fontSize: 12,
    fontFamily: 'Poppins Regular',
    color: 'rgba(255,255,255,0.7)',
    textDecorationLine: 'underline',
  },
});
