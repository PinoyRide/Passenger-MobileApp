import React from 'react';
import { ON_PRIMARY_BUTTON_TEXT } from '@/Theme';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon } from 'react-native-paper';
import {
  EMERGENCY_NUMBER,
  dialEmergency,
} from '@/Components/EmergencyCall/emergencyCall';

// Figma: Safety Guide chip opens the emergency call dialog (frame w/ 911 + Call).
const SafetyGuideModal = ({ visible, onClose }) => {
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

const styles = StyleSheet.create({
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
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#FEC107',
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {
    flex: 1,
    fontFamily: 'Poppins SemiBold',
    fontSize: 22,
    color: '#000000',
    letterSpacing: 0.5,
  },
  callButton: {
    backgroundColor: '#FEC107',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minWidth: 72,
    alignItems: 'center',
  },
  callButtonText: {
    fontFamily: 'Poppins SemiBold',
    fontSize: 15,
    color: ON_PRIMARY_BUTTON_TEXT,
  },
});
