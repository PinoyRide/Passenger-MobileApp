import React, { useEffect, useState } from 'react';
import {
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
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppButton, AppTextInput, Container } from '@/Components';
import useApiRequest from '@/Services/ApiV2';
import { Constants } from '@/Utils';
import { toStoredUser } from '@/Utils/customerMapper';
import { withCameraPermission } from '@/Utils/Permissions';
import { selectUserInfo, setUserInfo } from '@/Redux/Slices/userSlice';
import { modern } from '@/Theme/modern';
import appAlert from '@/Utils/appAlert';
import GenderChoice from '@/Components/GenderChoice/GenderChoice';
import { genderOf } from '@/Utils/gender';

// Name: what a passenger must have before booking (the backend refuses bookings otherwise).
// Shown right after registering, and it can be skipped for now (the owner, 2026-11-22):
// booking asks for the name later. The photo is optional, and so is the check on it: taken on
// LivenessSelfieScreen, which checks a real person is taking it of themselves (it comes back
// here as route.params.capturedSelfie), or uploaded from the phone's photos without a check.
// The page fits one screen and Save stays in view (the owner, 2026-11-22: "this can fit in one
// screen so i dont need to scroll to see the whole button"): the photo is a small circle with
// its two actions beside it, and the button is pinned under the fields.
const CompleteProfileScreen = () => {
  const look = modern(useTheme());
  const styles = getStyles(look);
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const userInfo = useSelector(selectUserInfo);
  const ekyc = userInfo?.ekyc_details || {};

  const [fname, setFname] = useState(userInfo?.fname || ekyc.first_name || '');
  const [mname, setMname] = useState(userInfo?.mname || ekyc.middle_name || '');
  const [lname, setLname] = useState(userInfo?.lname || ekyc.last_name || '');
  const [email, setEmail] = useState(userInfo?.email || '');
  // required (the owner, 2026-11-23: "Require gender so we can display in
  // profile"); accounts made before have none until saved here
  const [gender, setGender] = useState(genderOf(userInfo?.gender)?.value || '');
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
    if (!genderOf(gender)) {
      next.gender = 'Choose your gender';
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
        gender,
      },
    );
    if (error || !response) {
      appAlert('Unable to Save', error || 'Please try again.');
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
        appAlert('Selfie Not Saved', upload.error || 'Please try again.');
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
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          {firstTime
            ? 'Riders see your name so they can find you at pickup. You can book once it is filled in.'
            : 'Riders see your name so they can find you at pickup.'}
        </Text>

        <View style={styles.photoRow}>
          <TouchableOpacity
            style={styles.photo}
            onPress={takeSelfie}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={
              currentSelfie ? 'Take a new photo' : 'Take a photo'
            }>
            {currentSelfie ? (
              <Image
                source={{ uri: currentSelfie }}
                style={styles.photoImage}
                resizeMode="cover"
              />
            ) : (
              <Icon name="account" size={48} color={look.faint} />
            )}
          </TouchableOpacity>
          <View style={styles.photoSide}>
            <Text style={styles.photoTitle}>Your photo</Text>
            <Text style={styles.photoNote}>
              Optional. It helps riders find you.
            </Text>
            <View style={styles.photoActions}>
              <TouchableOpacity
                onPress={takeSelfie}
                hitSlop={6}
                style={styles.photoAction}>
                <Text style={styles.photoActionText}>
                  {currentSelfie ? 'Take a new one' : 'Take a photo'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={uploadPhoto}
                hitSlop={6}
                style={styles.photoAction}>
                <Text style={styles.photoActionText}>Upload</Text>
              </TouchableOpacity>
            </View>
          </View>
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
        <GenderChoice
          value={gender}
          onChange={value => {
            setGender(value);
            setErrors(prev => ({ ...prev, gender: '' }));
          }}
          error={errors.gender}
        />
        <AppTextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="Optional"
          inputMode="email"
        />
      </ScrollView>

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
    </Container>
  );
};

export default CompleteProfileScreen;

const getStyles = look =>
  StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 10 },
    header: { height: 52, justifyContent: 'center', marginBottom: 4 },
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
      color: look.ink,
    },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 4 },
    intro: {
      fontSize: 13,
      fontFamily: 'Poppins Regular',
      color: look.muted,
      lineHeight: 20,
      marginBottom: 16,
    },
    photoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      marginBottom: 20,
    },
    photo: {
      width: 84,
      height: 84,
      borderRadius: 42,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: look.accent,
      backgroundColor: look.soft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoImage: { width: '100%', height: '100%' },
    photoSide: { flex: 1 },
    photoTitle: {
      fontSize: 14,
      fontFamily: 'Poppins Medium',
      color: look.ink,
    },
    photoNote: {
      fontSize: 12,
      fontFamily: 'Poppins Regular',
      color: look.muted,
      marginTop: 2,
    },
    photoActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 10,
    },
    photoAction: {
      backgroundColor: look.chip,
      borderRadius: look.radiusPill,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    photoActionText: {
      fontSize: 13,
      fontFamily: 'Poppins Medium',
      color: look.chipInk,
    },
    errorText: {
      fontSize: 12,
      fontFamily: 'Poppins Regular',
      color: look.danger,
      marginTop: -8,
      marginBottom: 12,
    },
    // pinned under the fields, so Save is always in view
    footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
    skipButton: {
      alignSelf: 'center',
      paddingTop: 12,
      paddingBottom: 4,
      paddingHorizontal: 24,
    },
    skipText: {
      fontSize: 14,
      fontFamily: 'Poppins Medium',
      color: look.muted,
    },
  });
