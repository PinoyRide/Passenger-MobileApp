import React, { useCallback } from 'react';
import {
  BackHandler,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Container from '@/Components/Container/Container';
import ProfileAvatar from '@/Components/ProfileAvatar/ProfileAvatar';
import { useTheme } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { selectUserInfo } from '@/Redux/Slices/userSlice';
import { useSelector } from 'react-redux';
import { displayMobile, fullNameOf, titleCase } from '@/Utils/personName';
import { genderOf } from '@/Utils/gender';

const ProfileScreen = () => {
  const { colors } = useTheme();
  const styles = getStyles({ colors });
  const navigation = useNavigation();
  const userInfo = useSelector(selectUserInfo);
  const ekyc = userInfo?.ekyc_details;
  // the gender the passenger chose (registration or Edit), and its badge on
  // the photo (the owner, 2026-11-23: "display in profile also having a badge")
  const gender = genderOf(userInfo?.gender);

  // Back while this page is on screen only: registered for good, it also
  // answered Back on Edit profile and removed this page from under it
  // (overnight review 2026-11-23).
  useFocusEffect(
    useCallback(() => {
      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          navigation.goBack();
          return true;
        },
      );
      return () => backHandler.remove();
    }, [navigation]),
  );

  // What the account holds, as the Account page and the edit form read it:
  // the number it signs in with and the email given at registration or in
  // Edit (the old TOP PH identity check's email, gender and address never
  // reach the app, so those rows only ever said N/A; the owner, 2026-11-23:
  // "check why it is N/A even when we have it").
  const fields = [
    {
      label: 'Name',
      value:
        [
          titleCase(ekyc?.first_name || userInfo?.fname),
          titleCase(ekyc?.middle_name || userInfo?.mname),
          titleCase(ekyc?.last_name || userInfo?.lname),
        ]
          .filter(Boolean)
          .join(' ') || 'Not set yet',
    },
    {
      label: 'Mobile Number',
      // "+63 966 852 7271" (Utils/personName.js)
      value:
        displayMobile(userInfo?.mobile || ekyc?.mobile_no) || 'Not set yet',
    },
    {
      label: 'Email Address',
      value: userInfo?.email?.trim() || 'Not added yet',
    },
    {
      label: 'Gender',
      value: gender?.label || 'Not set yet',
    },
  ];

  return (
    <Container style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Image
          source={require('@/Assets/Common/Back.png')}
          style={styles.backIcon}
          resizeMode="contain"
        />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Photo */}
        <View style={styles.avatarContainer}>
          <ProfileAvatar
            uri={userInfo?.selfie || ekyc?.selfie}
            name={fullNameOf(userInfo)}
            size={90}
            badge={gender?.icon}
            badgeLabel={gender?.label}
          />
          {/* <TouchableOpacity style={styles.cameraButton} onPress={() => {}}>
            <Image
              source={require('@/Assets/Common/Camera.png')}
              style={styles.cameraIcon}
              resizeMode="contain"
            />
          </TouchableOpacity> */}
        </View>

        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('CompleteProfileScreen')}>
          <Text style={styles.editButtonText}>
            {userInfo?.profile_complete
              ? 'Edit profile'
              : 'Complete your profile'}
          </Text>
        </TouchableOpacity>

        {/* Profile Fields */}
        <View style={styles.fieldsContainer}>
          {fields.map((field, index) => (
            <View key={index} style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <Text style={styles.fieldValue}>{field.value}</Text>
              <View style={styles.divider} />
            </View>
          ))}
        </View>
      </ScrollView>
    </Container>
  );
};

export default ProfileScreen;

const getStyles = ({ colors }) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 15,
    },
    backIcon: {
      width: 23,
      height: 23,
      marginBottom: 20,
    },
    avatarContainer: {
      alignItems: 'center',
      marginBottom: 12,
    },
    editButton: {
      alignSelf: 'center',
      paddingVertical: 8,
      paddingHorizontal: 18,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.primary,
      marginBottom: 24,
    },
    editButtonText: {
      fontSize: 13,
      fontFamily: 'Poppins Medium',
      color: colors.text,
    },
    cameraButton: {
      position: 'absolute',
      bottom: 0,
      right: '35%',
      backgroundColor: colors.primary,
      borderRadius: 14,
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cameraIcon: {
      width: 14,
      height: 14,
      tintColor: '#FFFFFF',
    },
    fieldsContainer: {
      paddingBottom: 30,
    },
    fieldRow: {
      marginBottom: 4,
    },
    fieldLabel: {
      fontFamily: 'Poppins Regular',
      fontSize: 11,
      color: colors.grey4,
      marginBottom: 2,
    },
    fieldValue: {
      fontFamily: 'Poppins Regular',
      fontSize: 14,
      color: colors.grey3,
      paddingBottom: 10,
    },
    divider: {
      height: 1,
      backgroundColor: colors.grey5,
      marginBottom: 14,
    },
  });
