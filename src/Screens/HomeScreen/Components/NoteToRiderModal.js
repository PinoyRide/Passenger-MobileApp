import React, { useEffect, useState } from 'react';
import { ON_PRIMARY_BUTTON_TEXT } from '@/Theme';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { AppButton, AppTextInput } from '@/Components';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomSpace } from '@/Utils/bottomSpace';

const NoteToRiderModal = ({ visible, onClose, onSave, initialNote = '' }) => {
  // The navigation bar may cover the bottom of the screen: keep the bottom content clear of it
  const { bottom: bottomInset } = useSafeAreaInsets();
  const theme = useTheme();
  const { colors } = theme;
  const styles = getStyles({ colors, dark: theme.dark });
  const [note, setNote] = useState(initialNote);

  useEffect(() => {
    setNote(initialNote);
  }, [initialNote, visible]);

  const handleSave = () => {
    const cleanedNote = note.trimStart();
    onSave?.(cleanedNote);
    onClose();
  };

  const handleClose = () => {
    setNote(initialNote);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View
            style={[
              styles.modalContainer,
              { paddingBottom: bottomSpace(bottomInset, 40) },
            ]}>
            <Text style={styles.title}>Note To Rider</Text>

            <AppTextInput
              value={note}
              onChangeText={setNote}
              placeholder="Message"
              inputMode="comment"
              multiline
            />

            <AppButton
              title="Send"
              textColor={ON_PRIMARY_BUTTON_TEXT}
              onPress={handleSave}
              isBold
              buttonColor={colors.primary}
            />
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default NoteToRiderModal;

const getStyles = ({ colors, dark }) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.3)',
    },
    keyboardContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
    },
    // the Figma grey sheet; the page colour in the dark look (Settings > Dark mode)
    modalContainer: {
      backgroundColor: dark ? colors.background : '#D9D9D9',
      padding: 20,
      paddingBottom: 40,
    },
    title: {
      fontFamily: 'Poppins Medium',
      fontSize: 20,
      marginBottom: 15,
      color: colors.text,
    },
  });
