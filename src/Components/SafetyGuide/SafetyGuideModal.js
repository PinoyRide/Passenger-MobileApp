import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';

// PLACEHOLDER COPY: Figma has no Safety Guide content yet. Replace these tips
// with the approved text from Mark / the client before release.
export const SAFETY_TIPS_PLACEHOLDER = [
  'Check that the rider name, photo and plate number match the app before you get on.',
  'Always wear the helmet the rider gives you, and keep it fastened for the whole trip.',
  'Share your trip details with a friend or family member.',
  'Keep your phone away while in transit and hold on securely.',
  'If you feel unsafe, ask the rider to stop in a well-lit public place.',
  'In an emergency, tap the red Emergency button to call 911.',
];

const SafetyGuideModal = ({ visible, onClose }) => (
  <Modal
    transparent
    visible={visible}
    animationType="slide"
    onRequestClose={onClose}>
    <Pressable style={styles.overlay} onPress={onClose}>
      <Pressable
        style={styles.sheet}
        onPress={e => e.stopPropagation()}
        testID="safety-guide-sheet">
        <Text style={styles.title}>Safety Guide</Text>
        <ScrollView style={styles.list}>
          {SAFETY_TIPS_PLACEHOLDER.map((tip, i) => (
            <Text key={i} style={styles.tip}>
              {i + 1}. {tip}
            </Text>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>Got it</Text>
        </TouchableOpacity>
      </Pressable>
    </Pressable>
  </Modal>
);

export default SafetyGuideModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
    maxHeight: '75%',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  title: {
    fontFamily: 'Poppins SemiBold',
    fontWeight: '600',
    fontSize: 18,
    color: '#084CF7',
    marginBottom: 12,
  },
  list: { marginBottom: 16 },
  tip: {
    fontFamily: 'Poppins Regular',
    fontSize: 14,
    lineHeight: 21,
    color: '#333333',
    marginBottom: 10,
  },
  button: {
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFC107',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontFamily: 'Poppins Medium', fontSize: 15, color: '#FFFFFF' },
});
