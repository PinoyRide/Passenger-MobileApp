import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { modern } from '@/Theme/modern';

// A short message the person has to answer before going on: a title, one
// or two sentences, one button.
//   icon         a MaterialCommunityIcons name, shown above the title
//   dismissable  false when the back button must not close it
const AlertBox = ({
  title,
  message,
  onConfirm,
  visible,
  setVisible,
  confirmText = 'Confirm',
  dismissable = true,
  icon,
}) => {
  const look = modern(useTheme());
  const styles = getStyles(look);

  const handleConfirm = () => {
    setVisible(false);
    if (onConfirm) {
      onConfirm();
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (dismissable) {
          setVisible(false);
        }
      }}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {icon ? (
            <View style={styles.iconPatch}>
              <Icon name={icon} size={28} color={look.chipInk} />
            </View>
          ) : null}
          {title ? <Text style={styles.title}>{title}</Text> : null}
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity
            onPress={handleConfirm}
            style={styles.confirmButton}
            activeOpacity={0.85}
            accessibilityRole="button">
            <Text style={styles.confirmText}>{confirmText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default AlertBox;

const getStyles = look =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 28,
    },
    container: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: look.surface,
      borderRadius: 22,
      paddingHorizontal: 22,
      paddingTop: 24,
      paddingBottom: 18,
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
    },
    iconPatch: {
      alignSelf: 'center',
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
      backgroundColor: look.chip,
    },
    title: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 18,
      lineHeight: 25,
      color: look.text,
      textAlign: 'center',
      marginBottom: 6,
    },
    message: {
      fontFamily: 'Poppins Regular',
      fontSize: 14,
      lineHeight: 21,
      color: look.muted,
      textAlign: 'center',
      marginBottom: 20,
    },
    confirmButton: {
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: look.accent,
    },
    confirmText: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 15,
      lineHeight: 21,
      color: look.onAccent,
    },
  });
