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
import { startBusyTimeout } from '@/Utils/busyTimeout';

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
// The states (A-184, design/A-184/SPEC.md section 4; the rules are
// Utils/alertShape.js boxState):
//   points         [{ icon, text }]: short lines with an icon under the
//                  message. They scroll with the title and message; the
//                  buttons stay in view (A-199's tips).
//   errorText      a red line under the message: what went wrong. The caller
//                  clears it.
//   field          { label, placeholder, hint, value, onChangeText, required }:
//                  a text box above the buttons (a reason). A required one
//                  left blank holds the filled button, with a hint under it
//                  saying why, for as long as it is blank.
//   busy           a spinner on the filled button, which cannot be tapped
//                  for as long as busy is true; the quiet one can, and Back
//                  does what it does. It never closes by itself while busy.
//                  After 15 s with no answer (Utils/busyTimeout.js) the
//                  spinner gives way to the error line (errorText, or "No
//                  answer yet. Check your signal and try again.", which stays
//                  until busy turns on again or a button is tapped) and
//                  onBusyTimeout runs. The filled button stays held until the
//                  caller clears busy: its answer never runs twice. A busy box
//                  that is not dismissable and has no quiet answer closes on
//                  Back once the 15 s are over, unless onBusyTimeout is given:
//                  then that caller must give the way out.
//   onBusyTimeout  the caller's own error state for a busy spell that hangs
//   keepOpen       the filled button runs its answer but does not close the
//                  box: the caller closes it or changes it. The quiet answer
//                  and Back still close it; a caller ignores a late answer
//                  that comes after that (no fee box after "Keep booking").
// A box a screen draws itself closes by itself only as a notice; the
// three-minute close of a question is AlertHost's, and each old box takes it
// as it moves onto this one (A-184 pieces c1 and c2).
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

  // the last busy spell ran past 15 s: kept until busy turns on again, a
  // button is tapped or the box closes
  const [timedOut, setTimedOut] = useState(false);
  const busyTimeoutRef = useRef(onBusyTimeout);
  busyTimeoutRef.current = onBusyTimeout;
  useEffect(() => {
    if (!visible) {
      setTimedOut(false);
      return undefined;
    }
    if (!busy) {
      return undefined;
    }
    // a new spell, a new countdown
    setTimedOut(false);
    return startBusyTimeout(() => {
      setTimedOut(true);
      busyTimeoutRef.current?.();
    });
  }, [visible, busy]);
  const state = boxState({
    onConfirm,
    secondaryText,
    dismissable,
    busy,
    timedOut,
    onBusyTimeout,
    keepOpen,
    field,
    errorText,
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
    setTimedOut(false);
    if (state.closeOnConfirm) {
      setVisible(false);
    }
    if (onConfirm) {
      onConfirm();
    }
  };

  // the quiet answer always closes the box, keepOpen or not
  const handleSecondary = () => {
    setTimedOut(false);
    setVisible(false);
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
  // the space under the scrolled words: less when the error line follows
  const tail = { marginBottom: state.errorText ? 8 : 20 };

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
                <Icon name={icon} size={26} color={look.chipInk} />
              </View>
            ) : null}
            {title ? <Text style={styles.title}>{title}</Text> : null}
            <Text
              style={[
                styles.message,
                lines.length ? styles.messageBeforePoints : tail,
              ]}>
              {message}
            </Text>
            {lines.length ? (
              <View style={[styles.points, tail]}>
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
          {state.errorText ? (
            <Text
              style={styles.error}
              numberOfLines={3}
              accessibilityLiveRegion="polite">
              {state.errorText}
            </Text>
          ) : null}
          {field ? (
            <View style={styles.field}>
              <AppTextInput
                label={field.label}
                placeholder={field.placeholder}
                value={field.value}
                onChangeText={field.onChangeText}
                inputMode="comment"
                containerStyle={styles.fieldInput}
                inputStyle={styles.fieldBox}
              />
              {state.fieldHint ? (
                <Text style={styles.fieldHint}>{state.fieldHint}</Text>
              ) : null}
            </View>
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
    // a card on the scrim, no shadow (C-6: shadows only over the map)
    container: {
      width: '100%',
      maxWidth: 360,
      maxHeight: '100%',
      backgroundColor: look.card,
      borderRadius: look.radiusCard,
      paddingHorizontal: 20,
      paddingTop: 22,
      paddingBottom: 16,
    },
    // the icon, title, message and points: as tall as they are, scrolling
    // when the box would not fit, so the buttons below stay in view
    scroll: {
      flexGrow: 0,
      flexShrink: 1,
    },
    iconPatch: {
      alignSelf: 'flex-start',
      width: 52,
      height: 52,
      borderRadius: look.radiusTile,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
      backgroundColor: look.chip,
    },
    title: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 18,
      lineHeight: 25,
      color: look.ink,
      textAlign: 'left',
      marginBottom: 6,
    },
    message: {
      fontFamily: 'Poppins Regular',
      fontSize: 14,
      lineHeight: 21,
      color: look.inkSoft,
      textAlign: 'left',
      marginBottom: 20,
    },
    messageBeforePoints: {
      marginBottom: 14,
    },
    // A-199's tips: rows 10 dp apart, a 32 dp gold patch 12 dp from words
    // that wrap
    points: {
      gap: 10,
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
      textAlign: 'left',
    },
    // under the scrolled words, never over them; up to three lines
    error: {
      fontFamily: 'Poppins Regular',
      fontSize: 13,
      lineHeight: 19,
      color: look.red,
      textAlign: 'left',
      marginBottom: 16,
    },
    field: {
      marginBottom: 16,
    },
    fieldInput: {
      marginBottom: 0,
    },
    // three lines, with an edge that shows (C-5)
    fieldBox: {
      minHeight: 84,
      borderColor: look.fieldEdge,
      fontSize: 15,
    },
    // why the filled button is held: the field is needed
    fieldHint: {
      fontFamily: 'Poppins Regular',
      fontSize: 12,
      lineHeight: 17,
      color: look.muted,
      textAlign: 'left',
      marginTop: 6,
    },
    // 48 dp or more: the words wrap to a second line at large text instead
    // of being cut (SPEC section 5)
    confirmButton: {
      minHeight: 48,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: look.radiusButton,
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
      textAlign: 'center',
    },
    confirmHeldText: {
      color: look.muted,
    },
    // 48 dp or more, as every tap target (SPEC section 5; was 46)
    secondaryButton: {
      minHeight: 48,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: look.radiusButton,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    // full strength: on a `safe` box it is the costly answer, which must
    // read clearly (SPEC section 3, "Second button")
    secondaryLabel: {
      fontFamily: 'Poppins Medium',
      fontSize: 14.5,
      lineHeight: 21,
      color: look.ink,
      textAlign: 'center',
    },
    // centred under the buttons
    note: {
      fontFamily: 'Poppins Regular',
      fontSize: 12,
      lineHeight: 17,
      color: look.muted,
      textAlign: 'center',
      marginTop: 10,
    },
  });
