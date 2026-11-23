import React, { useEffect, useState } from 'react';
import { ON_PRIMARY_BUTTON_TEXT } from '@/Theme';
import {
  Keyboard,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import AppButton from '@/Components/AppButton/AppButton';
import AppTextInput from '@/Components/AppTextInput/AppTextInput';
import TypingLayer from '@/Components/TypingLayer/TypingLayer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomSpace } from '@/Utils/bottomSpace';

// A sheet over Home to type the note in: a layer of the screen, not a Modal
// (Components/TypingLayer), so the keyboard lifts it and lowering the keyboard
// does not close it (the owner, 2026-11-23).
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
    <TypingLayer
      visible={visible}
      onClose={handleClose}
      onBackdrop={handleClose}
      placement="bottom"
      dim="rgba(0,0,0,0.3)">
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
    </TypingLayer>
  );
};

export default NoteToRiderModal;

const getStyles = ({ colors, dark }) =>
  StyleSheet.create({
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
