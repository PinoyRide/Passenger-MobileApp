import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Icon } from 'react-native-paper';
import {
  EMERGENCY_NUMBER,
  dialEmergency,
} from '@/Components/EmergencyCall/emergencyCall';
import appAlert from '@/Utils/appAlert';

export { EMERGENCY_NUMBER };

const CONFIRM_TITLE = 'Call Emergency?';
const CONFIRM_MESSAGE = `This will call ${EMERGENCY_NUMBER} (Philippine emergency hotline).`;

// Figma frame 51: red pill, top-right over the map, while in transit. The same
// file in both apps (sharedUi.test.mjs): the rider has it over the map for the
// whole trip.
const EmergencyButton = ({ style }) => {
  const onPress = () => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${CONFIRM_TITLE}\n${CONFIRM_MESSAGE}`)) {
        dialEmergency();
      }
      return;
    }
    appAlert(
      CONFIRM_TITLE,
      CONFIRM_MESSAGE,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Call ${EMERGENCY_NUMBER}`,
          style: 'destructive',
          onPress: dialEmergency,
        },
      ],
      { icon: 'phone' },
    );
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
