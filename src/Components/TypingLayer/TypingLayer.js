import React, { useEffect, useRef } from 'react';
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

// A box to type in, drawn over the screen it belongs to (the owner,
// 2026-11-23: "i cant see the whole when keyboard pop, when i minimized my
// keyboard the card also closes").
//
// Not a <Modal>. On Android a Modal is a window of its own: drawn edge to
// edge, the keyboard does not lift it, and React Native's keyboard events
// come from the screen's window only, so a KeyboardAvoidingView in it never
// moves. Its back handler also took the Back that only lowered the keyboard,
// and closed the box with it. As a layer of the screen the keyboard lifts the
// box (KeyboardAvoidingView, padding), and Android lowers the keyboard on
// Back before Back reaches the box. A tap outside does the same: while the
// keyboard is up it only lowers the keyboard, so nothing typed is lost.
//   visible
//   onClose     Back, when the keyboard is down
//   placement   'center' (a card) or 'bottom' (a sheet)
//   onBackdrop  a tap outside the box once the keyboard is down
// The screen draws it at its top level, and the screen has no header
// (headerShown: false): it covers the whole window.
const TypingLayer = ({
  visible,
  onClose,
  placement = 'center',
  onBackdrop,
  dim = 'rgba(0,0,0,0.5)',
  children,
}) => {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      closeRef.current?.();
      return true;
    });
    return () => back.remove();
  }, [visible]);

  if (!visible) {
    return null;
  }
  const tapOutside = () => {
    if (Keyboard.isVisible()) {
      Keyboard.dismiss();
      return;
    }
    onBackdrop?.();
  };
  return (
    <View style={styles.layer}>
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: dim }]}
        onPress={tapOutside}
        accessible={false}
      />
      <KeyboardAvoidingView
        behavior="padding"
        style={[
          styles.place,
          placement === 'bottom' ? styles.bottom : styles.center,
        ]}
        pointerEvents="box-none">
        {children}
      </KeyboardAvoidingView>
    </View>
  );
};

export default TypingLayer;

const styles = StyleSheet.create({
  // over everything the screen draws (its map, sheets and banners)
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
  place: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
  },
  bottom: {
    justifyContent: 'flex-end',
  },
});
