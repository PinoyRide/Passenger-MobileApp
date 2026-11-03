import React, { useCallback, useState } from 'react';
import { deletePushToken } from '@/Services/Push/pushPlatform';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch } from 'react-redux';

import usePostRequest from '@/Services/Api';
import { Constants } from '@/Utils';
import {
  clearBookingState,
  clearSavedPlaces,
  clearUserInfo,
} from '@/Redux/Slices/userSlice';

const UpdateRequiredScreen = ({ route }) => {
  const { updateLink, currentVersion, minimumVersion } = route.params || {};
  const { colors } = useTheme();
  const styles = getStyles({ colors });
  const dispatch = useDispatch();

  const { makePostRequest } = usePostRequest();
  const [isProcessing, setIsProcessing] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  // Block the hardware back button — nowhere to go back to, the app is outdated.
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => true;
      const sub = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress,
      );
      return () => sub.remove();
    }, []),
  );

  const handleUpdatePress = async () => {
    if (isProcessing) {
      return;
    }
    setIsProcessing(true);
    setLogoutError('');

    let loggedOut = false;
    try {
      // Logout must succeed before we open the store. If it fails, the
      // server keeps is_login=1 and the account gets stuck after the
      // update, so stay here and let the passenger retry.
      const { response, error } = await makePostRequest(
        Constants.ENDPOINT.LOGOUT,
        {},
      );
      loggedOut = !error && !!response;
    } catch (err) {
      loggedOut = false;
    }

    if (!loggedOut) {
      setLogoutError('Walang internet o may problema sa server. Subukan ulit.');
      setIsProcessing(false);
      return;
    }

    await deletePushToken();
    dispatch(clearUserInfo());
    dispatch(clearBookingState());
    dispatch(clearSavedPlaces());
    if (updateLink) {
      await Linking.openURL(updateLink);
    }
    setIsProcessing(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Update Required</Text>
      <Text style={styles.message}>
        You're using version {currentVersion || '—'}, but the minimum supported
        version is now {minimumVersion || '—'}. Please update the app to
        continue.
      </Text>
      {logoutError ? <Text style={styles.errorText}>{logoutError}</Text> : null}
      <TouchableOpacity
        style={[styles.button, isProcessing && styles.buttonDisabled]}
        onPress={handleUpdatePress}
        disabled={isProcessing}>
        {isProcessing ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {logoutError ? 'Retry' : 'Update Now'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

export default UpdateRequiredScreen;

const getStyles = ({ colors }) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
      backgroundColor: '#fff',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      fontFamily: 'Poppins SemiBold',
      color: colors.primary,
      marginBottom: 12,
      textAlign: 'center',
    },
    message: {
      fontSize: 14,
      fontFamily: 'Poppins Regular',
      color: '#333',
      textAlign: 'center',
      marginBottom: 24,
    },
    button: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
      minWidth: 140,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorText: {
      fontSize: 12,
      fontFamily: 'Poppins Regular',
      color: '#D32F2F',
      textAlign: 'center',
      marginBottom: 12,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      fontSize: 14,
      fontFamily: 'Poppins Medium',
      color: '#fff',
    },
  });
