import React, { useEffect, useState } from 'react';
import { ON_PRIMARY_BUTTON_TEXT } from '@/Theme';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import TypingLayer from '@/Components/TypingLayer/TypingLayer';

// `initialMessage`: what the box opens with, for the person to add to (the
// rating page's "My trip ended 5 km from my drop-off."). A layer of the screen
// that draws it, not a Modal (Components/TypingLayer): the keyboard lifts the
// whole card, and lowering the keyboard no longer closes it (the owner,
// 2026-11-23).
const ReportIssueModal = ({
  visible,
  onClose,
  onSubmit,
  loading,
  initialMessage = '',
}) => {
  const { colors } = useTheme();
  const styles = getStyles({ colors });
  const [message, setMessage] = useState('');
  // the picture steps aside while the keyboard is up, so the card fits above it
  const [typing, setTyping] = useState(false);

  // Opens with initialMessage; cleared whenever hidden (after success or close)
  useEffect(() => {
    setMessage(visible ? initialMessage : '');
  }, [visible, initialMessage]);

  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () =>
      setTyping(true),
    );
    const hidden = Keyboard.addListener('keyboardDidHide', () =>
      setTyping(false),
    );
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  const handleSend = () => {
    if (!message.trim()) {
      return;
    }
    onSubmit(message.trim());
  };

  return (
    <TypingLayer visible={visible} onClose={onClose} placement="center">
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.container}>
          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close">
            <Icon name="close" size={20} color={colors.grey4} />
          </TouchableOpacity>

          {typing ? null : (
            <Image
              source={require('@/Assets/Common/BookingDetails/ReportIssue.png')}
              style={styles.icon}
              resizeMode="contain"
            />
          )}

          <Text style={styles.title}>Report an Issue</Text>

          <TextInput
            style={styles.textInput}
            placeholder="Message"
            placeholderTextColor={colors.grey4}
            autoCorrect={false}
            multiline
            value={message}
            onChangeText={setMessage}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!message.trim() || loading) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!message.trim() || loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.sendText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </TypingLayer>
  );
};

export default ReportIssueModal;

const getStyles = ({ colors }) =>
  StyleSheet.create({
    overlay: {
      width: '100%',
      alignItems: 'center',
      paddingHorizontal: 30,
    },
    container: {
      width: '100%',
      backgroundColor: colors.card,
      borderRadius: 20,
      paddingTop: 16,
      paddingBottom: 30,
      paddingHorizontal: 24,
      alignItems: 'center',
    },
    closeButton: {
      alignSelf: 'flex-end',
      padding: 4,
      marginBottom: 8,
    },
    icon: {
      width: 55,
      height: 55,
      marginBottom: 16,
    },
    title: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 18,
      color: colors.text,
      marginBottom: 20,
    },
    textInput: {
      width: '100%',
      minHeight: 120,
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 14,
      fontFamily: 'Poppins Regular',
      fontSize: 13,
      color: colors.text,
      marginBottom: 24,
      shadowColor: colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 2,
    },
    sendButton: {
      width: '100%',
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 50,
      alignItems: 'center',
    },
    sendButtonDisabled: {
      opacity: 0.5,
    },
    sendText: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 15,
      color: ON_PRIMARY_BUTTON_TEXT,
    },
  });
