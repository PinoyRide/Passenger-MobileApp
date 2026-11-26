import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AppTextInput from '@/Components/AppTextInput/AppTextInput';
import useAutoClose, { NOTICE_READ_MS } from '@/Hooks/useAutoClose';
import { modern } from '@/Theme/modern';
import { boxState } from '@/Utils/alertShape';
import { busyView, startBusyTimeout } from '@/Utils/busyTimeout';

// A short message the person has to answer before going on: a title, one
// or two sentences, and one or two buttons. With one button that only closes
// it, it is a notice, and it closes itself once read (Utils/alertShape.js
// isNotice, Hooks/useAutoClose NOTICE_READ_MS).
//   icon           a MaterialCommunityIcons name, shown above the title
//   confirmText    the filled button. Give it the SAFE answer when the other
//                  one carries a risk the person cannot undo.
//   secondaryText  an optional quiet button under it, for the answer that
//                  needs more intent than a tap on the obvious one
//   note           an optional line under the buttons: what the risky answer
//                  costs, or what is recorded
//   dismissable    false when the back button must not close it
// The states (A-184, design/A-184/SPEC.md section 4; what each one does is
// Utils/alertShape.js boxState):
//   points         [{ icon, text }]: short lines with an icon under the
//                  message. They scroll with the title and message; the
//                  buttons stay in view (A-199's tips).
//   errorText      a red line under the message: what went wrong. The caller
//                  clears it.
//   field          { label, placeholder, value, onChangeText, required }: a
//                  text box above the buttons (a reason). A required one left
//                  blank holds the filled button.
//   busy           a spinner on the filled button, which cannot be tapped;
//                  the quiet one can, and Back does what it does. With no
//                  answer after 15 s the box goes to its error state
//                  (Utils/busyTimeout.js): onBusyTimeout runs, and the spinner
//                  gives way to the error line (errorText, or "No answer yet")
//   onBusyTimeout  the caller's own error state for a busy spell that hangs
//   keepOpen       a tap runs the answer but does not close the box: the
//                  caller closes it or changes it
const AlertBox = ({
  title,
  message,
  onConfirm,
  visible,
  setVisible,
  confirmText = 'Confirm',
  secondaryText,
  onSecondary,
  note,
  dismissable = true,
  icon,
  points,
  errorText,
  field,
  busy = false,
  onBusyTimeout,
  keepOpen = false,
}) => {
  const look = modern(useTheme());
  const styles = getStyles(look);

  // one busy spell: 15 s without an answer is the error state
  const [timedOut, setTimedOut] = useState(false);
  const busyTimeoutRef = useRef(onBusyTimeout);
  busyTimeoutRef.current = onBusyTimeout;
  useEffect(() => {
    setTimedOut(false);
    if (!visible || !busy) {
      return undefined;
    }
    return startBusyTimeout(() => {
      setTimedOut(true);
      busyTimeoutRef.current?.();
    });
  }, [visible, busy]);
  const shown = busyView({ busy, errorText, timedOut });
  const state = boxState({
    onConfirm,
    secondaryText,
    dismissable,
    busy: shown.busy,
    keepOpen,
    field,
  });

  // a notice closes itself once read; a box that asks waits for the person,
  // and a busy one for its answer
  useAutoClose(
    visible && state.autoClose === 'read',
    () => setVisible(false),
    NOTICE_READ_MS,
  );

  const handleConfirm = () => {
    if (!state.confirmEnabled) {
      return;
    }
    if (state.closeOnAnswer) {
      setVisible(false);
    }
    if (onConfirm) {
      onConfirm();
    }
  };

  const handleSecondary = () => {
    if (state.closeOnAnswer) {
      setVisible(false);
    }
    if (onSecondary) {
      onSecondary();
    }
  };

  const handleBack = () => {
    if (state.back === 'secondary') {
      handleSecondary();
    } else if (state.back === 'close') {
      setVisible(false);
    }
  };

  const lines = Array.isArray(points)
    ? points.filter(point => point && point.text)
    : [];

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleBack}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <ScrollView
            style={styles.scroll}
            bounces={false}
            keyboardShouldPersistTaps="handled">
            {icon ? (
              <View style={styles.iconPatch}>
                <Icon name={icon} size={28} color={look.chipInk} />
              </View>
            ) : null}
            {title ? <Text style={styles.title}>{title}</Text> : null}
            <Text style={styles.message}>{message}</Text>
            {lines.length ? (
              <View style={styles.points}>
                {lines.map((point, at) => (
                  <View key={`${at}-${point.text}`} style={styles.point}>
                    <View style={styles.pointPatch}>
                      {point.icon ? (
                        <Icon
                          name={point.icon}
                          size={18}
                          color={look.chipInk}
                        />
                      ) : null}
                    </View>
                    <Text style={styles.pointText}>{point.text}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
          {shown.errorText ? (
            <Text style={styles.error} numberOfLines={3}>
              {shown.errorText}
            </Text>
          ) : null}
          {field ? (
            <AppTextInput
              label={field.label}
              placeholder={field.placeholder}
              value={field.value}
              onChangeText={field.onChangeText}
              inputMode="comment"
              containerStyle={styles.field}
              inputStyle={styles.fieldBox}
            />
          ) : null}
          <TouchableOpacity
            onPress={handleConfirm}
            disabled={!state.confirmEnabled}
            style={[
              styles.confirmButton,
              !state.confirmEnabled && !state.spinner && styles.confirmHeld,
            ]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={confirmText}
            accessibilityState={{
              disabled: !state.confirmEnabled,
              busy: state.spinner,
            }}>
            {state.spinner ? (
              <ActivityIndicator
                color={look.onAccent}
                size={Platform.OS === 'android' ? 18 : 'small'}
              />
            ) : (
              <Text
                style={[
                  styles.confirmText,
                  !state.confirmEnabled && styles.confirmHeldText,
                ]}>
                {confirmText}
              </Text>
            )}
          </TouchableOpacity>
          {secondaryText ? (
            <TouchableOpacity
              onPress={handleSecondary}
              style={styles.secondaryButton}
              activeOpacity={0.7}
              accessibilityRole="button">
              <Text style={styles.secondaryLabel}>{secondaryText}</Text>
            </TouchableOpacity>
          ) : null}
          {note ? <Text style={styles.note}>{note}</Text> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default AlertBox;

const getStyles = look =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: look.scrim,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 28,
      // a box taller than the screen keeps 24 dp above and below it
      paddingVertical: 24,
    },
    container: {
      width: '100%',
      maxWidth: 360,
      maxHeight: '100%',
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
    // the icon, title, message and points: as tall as they are, scrolling
    // when the box would not fit, so the buttons below stay in view
    scroll: {
      flexGrow: 0,
      flexShrink: 1,
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
    // A-199's tips: rows 10 dp apart, a 32 dp gold patch 12 dp from words
    // that wrap
    points: {
      gap: 10,
      marginTop: -6,
      marginBottom: 20,
    },
    point: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    pointPatch: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      backgroundColor: look.chip,
    },
    pointText: {
      flex: 1,
      fontFamily: 'Poppins Regular',
      fontSize: 14,
      lineHeight: 20,
      color: look.inkSoft,
    },
    // under the message, up to three lines
    error: {
      fontFamily: 'Poppins Regular',
      fontSize: 13,
      lineHeight: 19,
      color: look.red,
      textAlign: 'center',
      marginTop: -12,
      marginBottom: 16,
    },
    field: {
      marginBottom: 16,
    },
    // three lines, with an edge that shows (C-5)
    fieldBox: {
      minHeight: 84,
      borderColor: look.fieldEdge,
      fontSize: 15,
    },
    confirmButton: {
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: look.accent,
    },
    // held while a required field is blank: quiet, so it does not look
    // tappable (busy keeps the gold, with the spinner)
    confirmHeld: {
      backgroundColor: look.soft,
    },
    confirmText: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 15,
      lineHeight: 21,
      color: look.onAccent,
    },
    confirmHeldText: {
      color: look.muted,
    },
    // 48 dp, as every tap target (SPEC section 5; was 46)
    secondaryButton: {
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    secondaryLabel: {
      fontFamily: 'Poppins Medium',
      fontSize: 14.5,
      lineHeight: 21,
      color: look.muted,
    },
    note: {
      fontFamily: 'Poppins Regular',
      fontSize: 12,
      lineHeight: 17,
      color: look.muted,
      textAlign: 'center',
      marginTop: 10,
    },
  });
