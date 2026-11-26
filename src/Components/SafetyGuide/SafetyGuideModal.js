import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon, useTheme } from 'react-native-paper';
import { modern } from '@/Theme/modern';
import {
  EMERGENCY_NUMBER,
  dialEmergency,
} from '@/Components/EmergencyCall/emergencyCall';

// Figma: Safety Guide chip opens the emergency call dialog (frame w/ 911 + Call).
// The same file in both apps (sharedUi.test.mjs): Emergency assistance on the
// Account page, and the rider's and the passenger's way to 911 during a trip.
const SafetyGuideModal = ({ visible, onClose }) => {
  const look = modern(useTheme());
  const styles = getStyles(look);
  const handleCall = () => {
    dialEmergency();
    onClose();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={styles.card}
          onPress={e => e.stopPropagation()}
          testID="safety-guide-emergency-dialog">
          <View style={styles.iconCircle}>
            <Icon source="phone" size={20} color="#FFFFFF" />
          </View>
          <Text style={styles.number}>{EMERGENCY_NUMBER}</Text>
          <TouchableOpacity
            style={styles.callButton}
            onPress={handleCall}
            accessibilityRole="button"
            accessibilityLabel={`Call ${EMERGENCY_NUMBER}`}
            testID="safety-guide-call-button">
            <Text style={styles.callButtonText}>Call</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default SafetyGuideModal;

// white with black words in the light look, the dark look's card and words in
// the dark one (Settings > Dark mode)
const getStyles = look =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: look.card,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      width: '100%',
      maxWidth: 340,
      gap: 12,
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: look.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    number: {
      flex: 1,
      fontFamily: 'Poppins SemiBold',
      fontSize: 22,
      color: look.ink,
      letterSpacing: 0.5,
    },
    callButton: {
      backgroundColor: look.accent,
      borderRadius: 8,
      paddingHorizontal: 20,
      paddingVertical: 10,
      minWidth: 72,
      alignItems: 'center',
    },
    callButtonText: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 15,
      color: look.onAccent,
    },
  });
