import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Platform,
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
import { Constants as AppConstants } from '@/Utils';
import {
  PICTURE_SIZE,
  advance,
  describeFace,
  faceProblem,
  isGoodPortrait,
  start,
  stepsFor,
  stepsPassed,
} from '@/Utils/livenessCheck';
import { GOLD } from '@/Theme/modern';

// Takes the passenger's profile photo, and makes sure a real person is taking
// it of themselves: they are asked to look straight, turn their head a little
// one way, then the other, to shut their eyes and open them again (riders,
// FACE_CHECK_BLINK), then look straight again (see livenessCheck.js).
// The camera is sampled a few times a second and each sample is scanned for a
// face on the phone itself; nothing leaves the phone until the final photo is
// saved with the profile. Nothing has to be pressed: the oval turns gold when
// the face is where it should be, every sample answers with progress or a
// hint, and the photo is taken when the last step is passed.
//
// Hands the photo back to the screen named in route.params.returnTo
// (CompleteProfileScreen by default) as params.capturedSelfie.

// Sides are not named: either side may come first, and the second turn is
// simply the other one.
const PROMPTS = {
  straight: 'Look straight at the camera',
  firstTurn: 'Slowly turn your head to one side',
  otherTurn: 'Now slowly turn to the other side',
  blink: 'Close your eyes for a second, then open them',
  finish: 'Look straight at the camera again',
  // after the blink: the photo that goes on the profile
  portrait: 'Now look at the camera for your profile photo',
  done: 'Hold still…',
};

// Riders also blink (Constants.FACE_CHECK_BLINK: the owner, 2026-11-23; see
// livenessCheck.js). The same screen in both apps.
const CHECK = { blink: Boolean(AppConstants.FACE_CHECK_BLINK) };
const CHECK_STEPS = stepsFor(CHECK);
const promptFor = step =>
  PROMPTS[step === 'finish' && CHECK.blink ? 'portrait' : step];

const PROBLEMS = {
  no_face: "We can't see your face. Hold the phone in front of you.",
  many_faces: 'Only one person should be in the picture.',
  too_far: 'Bring the phone a little closer.',
  off_center: 'Keep your face inside the oval.',
  turned: 'Face the camera directly.',
  same_side: 'Turn the other way.',
  turned_too_far: 'Not so far. Turn back a little.',
  eyes_closed: 'Keep your eyes open.',
  restarted: "Let's start again. Keep your face in view the whole time.",
};

// Samples used only for checking: small and quick.
const SAMPLE_QUALITY = 0.4;
// The photo that is kept.
const PHOTO_QUALITY = 0.85;
const PAUSE_BETWEEN_SAMPLES_MS = 80;
// This many camera or scanner failures in a row and we stop and say so.
const MAX_FAILURES = 4;
// How long to wait for the camera's "ready" signal before starting anyway.
const CAMERA_START_GRACE_MS = 3000;
// A sample that has not come back after this long never will: the camera
// library has ways of not answering at all (a picture asked for while the
// camera is being set up is dropped without a word). The camera is then
// closed and opened again, and the check starts over.
const SAMPLE_TIMEOUT_MS = 7000;
// After this many such restarts in a row the person is told, with a way to
// try again.
const MAX_CAMERA_RESTARTS = 2;
const NO_ANSWER = new Error('The camera did not hand over a picture.');

// The camera's picture size is fixed before it first opens and never
// changed: changing it re-opens the camera, and a picture being taken at
// that moment may never arrive. iOS names its sizes differently and is left
// at its default.
const CAMERA_PICTURE_SIZE =
  Platform.OS === 'android' ? PICTURE_SIZE : undefined;

const DETECTOR_OPTIONS = {
  performanceMode: 'fast',
  classificationMode: 'all', // eyes open
  minFaceSize: 0.15,
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Builds that talk to the Develop backend say in small print what each
// sample saw, so that a phone on which the check does not get through can
// be understood from a screenshot.
const sampleNote = (count, took, faces) => {
  const one =
    faces.length === 1
      ? ` · turn ${Math.round(faces[0].yaw)}° · width ${Math.round(
          faces[0].widthRatio * 100,
        )}%`
      : '';
  return `sample ${count} · ${took} ms · ${faces.length} face${
    faces.length === 1 ? '' : 's'
  }${one}`;
};

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
  // A new key closes the camera and opens it again.
  const [cameraKey, setCameraKey] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const restartsRef = useRef(0);

  const checkRef = useRef(start(Date.now(), CHECK));
  const [step, setStep] = useState('straight');
  const [problem, setProblem] = useState(null);
  // One face, the right size, inside the oval: the oval turns gold.
  const [faceInPlace, setFaceInPlace] = useState(false);
  const [note, setNote] = useState('');
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

  const onCameraReady = useCallback(() => setCameraReady(true), []);

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
    let samples = 0;
    checkRef.current = start(Date.now(), CHECK);
    setStep('straight');
    setProblem(null);
    setFaceInPlace(false);

    const scan = async quality => {
      const camera = cameraRef.current;
      if (!camera) {
        throw new Error('The camera is not on the screen.');
      }
      const startedAt = Date.now();
      const photo = await camera.takePictureAsync({
        quality,
        shutterSound: false,
        exif: false,
      });
      const found = await FaceDetection.detect(photo.uri, DETECTOR_OPTIONS);
      return {
        photo,
        faces: found.map(f => describeFace(f, photo.width, photo.height)),
        took: Date.now() - startedAt,
      };
    };

    // A sample, but not for ever (see SAMPLE_TIMEOUT_MS).
    const scanInTime = quality =>
      new Promise((resolve, reject) => {
        const work = scan(quality);
        const timer = setTimeout(() => {
          // whatever still arrives is thrown away
          work.then(late => discard(late.photo.uri)).catch(() => {});
          reject(NO_ANSWER);
        }, SAMPLE_TIMEOUT_MS);
        work.then(
          result => {
            clearTimeout(timer);
            resolve(result);
          },
          error => {
            clearTimeout(timer);
            reject(error);
          },
        );
      });

    const run = async () => {
      while (!stopped) {
        try {
          const { photo, faces, took } = await scanInTime(
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
          restartsRef.current = 0;
          samples += 1;
          const now = Date.now();
          const result = advance(checkRef.current, faces, now);
          checkRef.current = result.state;
          setStep(result.state.step);
          setProblem(result.problem);
          setFaceInPlace(faceProblem(faces) === null);
          if (AppConstants.IS_DEV) {
            setNote(sampleNote(samples, took, faces));
          }

          if (result.done) {
            // Every step passed: take the photo that is kept, and make sure
            // it too shows the one face, looking at the camera.
            const final = await scanInTime(PHOTO_QUALITY);
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
              held: 0,
              stepStartedAt: Date.now(),
            };
            setStep('finish');
          }
        } catch (e) {
          if (stopped) {
            return;
          }
          if (e === NO_ANSWER) {
            if (AppConstants.IS_DEV) {
              setNote(`no picture after ${SAMPLE_TIMEOUT_MS / 1000} s`);
            }
            if (restartsRef.current >= MAX_CAMERA_RESTARTS) {
              setFailure(
                "The camera isn't responding. Close other apps using the camera and try again.",
              );
              return;
            }
            // Close the camera and open it again. This loop ends here; a new
            // one starts when the camera says it is ready.
            restartsRef.current += 1;
            setCameraReady(false);
            setCameraKey(key => key + 1);
            return;
          }
          failures += 1;
          if (AppConstants.IS_DEV) {
            setNote(`sample failed: ${e?.message || e}`);
          }
          if (failures >= MAX_FAILURES) {
            setFailure(
              "The camera isn't responding. Close other apps using the camera and try again.",
            );
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

  // Try Again: a fresh camera and a fresh check.
  const retry = () => {
    restartsRef.current = 0;
    setFailure('');
    setCameraReady(false);
    setCameraKey(key => key + 1);
    setAttempt(n => n + 1);
  };

  // The oval breathes while the app is still looking for the face or waiting
  // for it to be put right, and holds still once the face is in place.
  const breath = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath]);

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

  const passed = stepsPassed({ step, steps: CHECK_STEPS });
  const message = problem ? PROBLEMS[problem] : null;
  const allPassed = finished || passed >= CHECK_STEPS.length;
  // gold: the face is in place and doing what was asked
  const settled = faceInPlace && !message;

  return (
    <View style={styles.screen}>
      {/* The camera fills a 3:4 box, not the whole screen: the photo comes
          out with the proportions of a portrait instead of a tall strip. */}
      <View style={styles.cameraBox}>
        {isFocused && (
          <CameraView
            key={cameraKey}
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="front"
            animateShutter={false}
            pictureSize={CAMERA_PICTURE_SIZE}
            onCameraReady={onCameraReady}
            onMountError={() =>
              setFailure('The camera could not be opened on this phone.')
            }
          />
        )}
        {/* Oval guide */}
        <View style={styles.guideLayer} pointerEvents="none">
          <Animated.View
            style={[
              styles.oval,
              settled && styles.ovalSettled,
              allPassed && styles.ovalDone,
              { opacity: settled || allPassed ? 1 : breath },
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
              {CHECK_STEPS.map((name, index) => (
                <View
                  key={name}
                  style={[
                    styles.stepDot,
                    index === passed && styles.stepDotCurrent,
                    index < passed && styles.stepDotDone,
                  ]}
                />
              ))}
            </View>
            <Text style={styles.prompt} accessibilityLiveRegion="polite">
              {promptFor(step)}
            </Text>
            <Text style={[styles.hint, message && styles.hintProblem]}>
              {message || 'This checks that the photo is really you.'}
            </Text>
            {AppConstants.IS_DEV && note ? (
              <Text style={styles.note}>{note}</Text>
            ) : null}
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
  ovalSettled: { borderColor: GOLD },
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
  stepDotCurrent: { backgroundColor: '#FFFFFF' },
  stepDotDone: { backgroundColor: GOLD },
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
  hintProblem: { color: GOLD },
  note: {
    marginTop: 10,
    fontSize: 11,
    fontFamily: 'Poppins Regular',
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
  },
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
    backgroundColor: GOLD,
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
