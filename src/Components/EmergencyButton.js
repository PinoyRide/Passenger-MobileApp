import React from 'react';
import {
  Alert,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import { Icon } from 'react-native-paper';

export const EMERGENCY_NUMBER = '911'; // Philippines national emergency hotline

const CONFIRM_TITLE = 'Call Emergency?';
const CONFIRM_MESSAGE = `This will call ${EMERGENCY_NUMBER} (Philippine emergency hotline).`;

const dial = () => {
  Linking.openURL(`tel:${EMERGENCY_NUMBER}`).catch(() => {
    if (Platform.OS !== 'web') {
      Alert.alert(
        'Unable to call',
        `Please dial ${EMERGENCY_NUMBER} manually.`,
      );
    }
  });
};

// Figma frame 51: red pill, top-right over the map, while in transit.
const EmergencyButton = ({ style }) => {
  const onPress = () => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${CONFIRM_TITLE}\n${CONFIRM_MESSAGE}`)) {
        dial();
      }
      return;
    }
    Alert.alert(CONFIRM_TITLE, CONFIRM_MESSAGE, [
      { text: 'Cancel', style: 'cancel' },
      { text: `Call ${EMERGENCY_NUMBER}`, style: 'destructive', onPress: dial },
    ]);
  };

  return (
    <TouchableOpacity
      style={[styles.pill, style]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Emergency"
      testID="emergency-button">
      <Icon source="phone" size={14} color="#FFFFFF" />
      <Text style={styles.label}>Emergency</Text>
    </TouchableOpacity>
  );
};

export default EmergencyButton;

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E4423F',
    borderRadius: 6,
    paddingHorizontal: 10,
    height: 32,
    gap: 6,
  },
  label: {
    fontFamily: 'Poppins Medium',
    fontSize: 13,
    color: '#FFFFFF',
  },
});
