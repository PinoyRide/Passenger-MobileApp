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

    try {
      // Best-effort logout — a force-update gate shouldn't get stuck
      // waiting on (or blocked by) the network. Whatever happens, we
      // still want to clear local session state and send the person
      // to the update link.
      const { response, error } = await makePostRequest(
        Constants.ENDPOINT.LOGOUT,
        {},
      );

      if (error || !response) {
        console.warn('Logout before force-update failed (continuing):', error);
      } else {
        console.log('Logged out before force-update redirect:', response);
      }
    } catch (err) {
      console.warn('Logout before force-update threw (continuing):', err);
    } finally {
      await deletePushToken();
      dispatch(clearUserInfo());
      dispatch(clearBookingState());
      dispatch(clearSavedPlaces());

      if (updateLink) {
        await Linking.openURL(updateLink);
      }
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Update Required</Text>
      <Text style={styles.message}>
        You're using version {currentVersion || '—'}, but the minimum supported
        version is now {minimumVersion || '—'}. Please update the app to
        continue.
      </Text>
      <TouchableOpacity
        style={[styles.button, isProcessing && styles.buttonDisabled]}
        onPress={handleUpdatePress}
        disabled={isProcessing}>
        {isProcessing ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Update Now</Text>
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
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      fontSize: 14,
      fontFamily: 'Poppins Medium',
      color: '#fff',
    },
  });
