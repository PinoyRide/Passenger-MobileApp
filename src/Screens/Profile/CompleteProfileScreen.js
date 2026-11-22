import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { launchImageLibrary } from 'react-native-image-picker';
import { AppButton, AppTextInput, Container } from '@/Components';
import useApiRequest from '@/Services/ApiV2';
import { Constants } from '@/Utils';
import { toStoredUser } from '@/Utils/customerMapper';
import { withCameraPermission } from '@/Utils/Permissions';
import { selectUserInfo, setUserInfo } from '@/Redux/Slices/userSlice';

// Name: what a passenger must have before booking (the backend refuses bookings otherwise).
// Shown right after registering, and it can be skipped for now (the owner, 2026-11-22):
// booking asks for the name later. The photo is optional, and so is the check on it: taken on
// LivenessSelfieScreen, which checks a real person is taking it of themselves (it comes back
// here as route.params.capturedSelfie), or uploaded from the phone's photos without a check.
const CompleteProfileScreen = () => {
  const { colors } = useTheme();
  const styles = getStyles({ colors });
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const userInfo = useSelector(selectUserInfo);
  const ekyc = userInfo?.ekyc_details || {};

  const [fname, setFname] = useState(userInfo?.fname || ekyc.first_name || '');
  const [mname, setMname] = useState(userInfo?.mname || ekyc.middle_name || '');
  const [lname, setLname] = useState(userInfo?.lname || ekyc.last_name || '');
  const [email, setEmail] = useState(userInfo?.email || '');
  const [newSelfie, setNewSelfie] = useState(null); // { uri, type, fileName } from the camera
  const [errors, setErrors] = useState({});

  const profileRequest = useApiRequest();
  const selfieRequest = useApiRequest();
  const saving = profileRequest.loading || selfieRequest.loading;

  const currentSelfie = newSelfie?.uri || userInfo?.selfie || ekyc.selfie || '';
  // Just registered (no name yet): "Skip for now" goes on to Home
  const firstTime = !userInfo?.profile_complete;

  const capturedSelfie = route.params?.capturedSelfie;
  useEffect(() => {
    if (capturedSelfie?.uri) {
      setNewSelfie(capturedSelfie);
      setErrors(prev => ({ ...prev, selfie: '' }));
    }
  }, [capturedSelfie]);

  const takeSelfie = () =>
    withCameraPermission(
      () =>
        navigation.navigate('LivenessSelfieScreen', {
          returnTo: 'CompleteProfileScreen',
        }),
      'Camera access is needed to take your profile photo.',
    );

  // A photo from the phone instead of the camera: no check that it is really them.
  const uploadPhoto = () =>
    launchImageLibrary(
      { mediaType: 'photo', quality: 0.8, maxWidth: 1080, maxHeight: 1080 },
      response => {
        if (response.didCancel || response.errorCode) {
          return;
        }
        const asset = response.assets?.[0];
        if (asset?.uri) {
          setNewSelfie({
            uri: asset.uri,
            type: asset.type || 'image/jpeg',
            fileName: asset.fileName || 'photo.jpg',
          });
        }
      },
    );

  const validate = () => {
    const next = {};
    if (!fname.trim()) {
      next.fname = 'First name is required';
    }
    if (!lname.trim()) {
      next.lname = 'Last name is required';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    const { response, error } = await profileRequest.request(
      'PUT',
      Constants.API.CUSTOMER_PROFILE(userInfo.id),
      {
        fname: fname.trim(),
        mname: mname.trim() || null,
        lname: lname.trim(),
        email: email.trim() || null,
      },
    );
    if (error || !response) {
      Alert.alert('Unable to Save', error || 'Please try again.');
      return;
    }

    let latest = response.data;
    if (newSelfie) {
      const form = new FormData();
      form.append('selfie', {
        uri: newSelfie.uri,
        name: newSelfie.fileName || 'selfie.jpg',
        type: newSelfie.type || 'image/jpeg',
      });
      const upload = await selfieRequest.request(
        'POST',
        Constants.API.CUSTOMER_SELFIE(userInfo.id),
        form,
      );
      if (upload.error || !upload.response) {
        dispatch(setUserInfo(toStoredUser(latest)));
        Alert.alert('Selfie Not Saved', upload.error || 'Please try again.');
        return;
      }
      latest = upload.response.data;
    }

    dispatch(setUserInfo(toStoredUser(latest)));
    navigation.goBack();
  };

  return (
    <Container style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}>
          <Image
            source={require('@/Assets/Common/Back.png')}
            style={styles.backIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            {userInfo?.profile_complete
              ? 'Edit Your Profile'
              : 'Complete Your Profile'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.pageContainer}>
          <Text style={styles.sectionSubtitle}>
            Riders see your name so they can find you at pickup; you can book
            once it is filled in. A photo of you is optional and helps them
            more: take one with the camera (you will be asked to turn your head
            a little, so we know it is really you), or upload one.
          </Text>

          <TouchableOpacity
            style={styles.selfieFrame}
            onPress={takeSelfie}
            activeOpacity={0.75}>
            {currentSelfie ? (
              <Image
                source={{ uri: currentSelfie }}
                style={styles.selfieImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.selfiePlaceholder}>
                <Text style={styles.selfieIcon}>🤳</Text>
                <Text style={styles.selfieHint}>
                  Tap to add your photo (optional)
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.photoActions}>
            <TouchableOpacity onPress={takeSelfie} style={styles.retakeButton}>
              <Text style={styles.retakeText}>
                {currentSelfie ? 'Take a new photo' : 'Take a photo'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={uploadPhoto} style={styles.retakeButton}>
              <Text style={styles.retakeText}>Upload a photo</Text>
            </TouchableOpacity>
          </View>
          {errors.selfie ? (
            <Text style={styles.errorText}>{errors.selfie}</Text>
          ) : null}

          <AppTextInput
            label="First Name"
            value={fname}
            onChangeText={setFname}
            placeholder="e.g. Juan"
            error={errors.fname}
          />
          <AppTextInput
            label="Middle Name"
            value={mname}
            onChangeText={setMname}
            placeholder="Optional"
          />
          <AppTextInput
            label="Last Name"
            value={lname}
            onChangeText={setLname}
            placeholder="e.g. Dela Cruz"
            error={errors.lname}
          />
          <AppTextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="Optional"
            inputMode="email"
          />
        </View>

        <View style={styles.footer}>
          <AppButton
            title={saving ? 'Saving…' : 'Save'}
            onPress={handleSave}
            isBold
            disabled={saving}
          />
          {firstTime ? (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              disabled={saving}
              style={styles.skipButton}>
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
    </Container>
  );
};

export default CompleteProfileScreen;

const getStyles = ({ colors }) =>
  StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 10 },
    header: { height: 52, justifyContent: 'center', marginBottom: 12 },
    backButton: {
      position: 'absolute',
      width: 52,
      height: 52,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2,
    },
    backIcon: { width: 23, height: 23 },
    headerTitleContainer: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 16,
      fontFamily: 'Poppins Medium',
      color: colors.text,
    },
    scrollContent: { flexGrow: 1, justifyContent: 'space-between' },
    pageContainer: { paddingHorizontal: 20 },
    sectionSubtitle: {
      fontSize: 13,
      fontFamily: 'Poppins Regular',
      color: colors.onSurfaceGrey || '#888',
      marginBottom: 20,
      lineHeight: 20,
    },
    selfieFrame: {
      width: 160,
      height: 160,
      borderRadius: 80,
      alignSelf: 'center',
      overflow: 'hidden',
      borderWidth: 3,
      borderColor: colors.primary,
      backgroundColor: colors.surface || '#FAFAFA',
      marginBottom: 4,
    },
    selfieImage: { width: '100%', height: '100%' },
    selfiePlaceholder: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
    },
    selfieIcon: { fontSize: 32 },
    selfieHint: {
      fontSize: 12,
      fontFamily: 'Poppins Regular',
      color: colors.onSurfaceGrey || '#888',
    },
    retakeButton: {
      alignSelf: 'center',
      paddingVertical: 6,
      paddingHorizontal: 16,
    },
    retakeText: {
      fontSize: 13,
      fontFamily: 'Poppins Medium',
      color: colors.primary,
    },
    errorText: {
      fontSize: 12,
      fontFamily: 'Poppins Regular',
      color: colors.error || '#D32F2F',
      textAlign: 'center',
      marginBottom: 8,
    },
    footer: { paddingHorizontal: 20, paddingVertical: 20 },
    photoActions: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 8,
    },
    skipButton: {
      alignSelf: 'center',
      paddingVertical: 12,
      paddingHorizontal: 24,
    },
    skipText: {
      fontSize: 14,
      fontFamily: 'Poppins Medium',
      color: colors.onSurfaceGrey || '#888',
    },
  });
