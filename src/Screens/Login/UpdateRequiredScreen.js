import React, { useCallback, useState } from 'react';
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
import { displayVersion } from '@/Utils/displayVersion';

const UpdateRequiredScreen = ({ route }) => {
  // The backend also names a "current version". It is not shown: the person
  // is told they are on an older version, not which number. The minimum
  // comes from the API as the real version (2.0.103) and is shown as people
  // count it (2.1.04), as on every other screen: Utils/displayVersion.js.
  const { updateLink, minimumVersion } = route.params || {};
  const { colors } = useTheme();
  const styles = getStyles({ colors });

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

  // Off to the download, still signed in (the owner, 2026-11-23: reduce
  // cost): installing the new APK keeps the app's data, so no new sign-in,
  // no paid code text. Should the sign-in be lost all the same, the backend
  // lets a newer version take over the old session (LoginSession).
  const handleUpdatePress = async () => {
    if (isProcessing) {
      return;
    }
    setIsProcessing(true);
    try {
      if (updateLink) {
        await Linking.openURL(updateLink);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Update Required</Text>
      <Text style={styles.message}>
        You're using an older version, but the minimum supported version is now{' '}
        {displayVersion(minimumVersion) || '—'}. Please update the app to
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
