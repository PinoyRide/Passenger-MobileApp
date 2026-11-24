import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { modern } from '@/Theme/modern';
import { activeBox, boxesOf, typedCode } from '@/Utils/codeBoxes';

/**
 * OTPInput component
 * - Calls `onOTPComplete` when the user has entered `length` digits
 * - Handles pasting multiple digits
 * - Prevents crashes for all 6-digit inputs including "000000"
 * - Responsive to screen size
 * - `autoFillCode`: a code the screen already has (a test environment that
 *   hands the code to the app instead of texting it). It is shown in the
 *   boxes and submitted like a typed one, once per code.
 *
 * The code is typed into ONE hidden text field and the boxes only show it
 * (Utils/codeBoxes.js says why): every Backspace, from the on-screen keyboard
 * or a hardware one, removes the last digit. A tap on the boxes opens the
 * keyboard; the box the next digit goes into has the gold edge.
 *
 * NOTE: Sizing is now based on the ACTUAL measured width of the row
 * (via onLayout) instead of Dimensions.get('window').width combined with
 * a manually-passed `parentPaddingHorizontal`. That old approach required
 * every parent to correctly report its own horizontal padding, and broke
 * silently when a screen had multiple nested padded containers (like
 * OTPScreen's `container` + `pageContainer`), causing the boxes to
 * overflow past the visible card. Measuring the real rendered width fixes
 * this regardless of how deeply the component is nested.
 */
const OTPInput = ({ length = 6, onOTPChange, onOTPComplete, autoFillCode }) => {
  const look = modern(useTheme());
  const input = useRef(null);
  const [code, setCode] = useState('');
  const [focused, setFocused] = useState(false);

  // Width of the row, filled in once the container actually renders.
  const [containerWidth, setContainerWidth] = useState(null);

  const onContainerLayout = useCallback(e => {
    const { width } = e.nativeEvent.layout;
    setContainerWidth(width);
  }, []);

  const styles = getStyles({ look, length, containerWidth });

  const update = nextCode => {
    setCode(nextCode);
    onOTPChange?.(nextCode);

    // If all boxes are filled, call onOTPComplete
    if (nextCode.length === length) {
      try {
        onOTPComplete?.(nextCode);
      } catch (err) {
        console.error('Error in onOTPComplete:', err);
      }
    }
  };

  const filledIn = useRef(null);
  useEffect(() => {
    const handed = `${autoFillCode ?? ''}`;
    if (!new RegExp(`^\\d{${length}}$`).test(handed)) {
      return;
    }
    if (filledIn.current === handed) {
      return;
    }
    filledIn.current = handed;
    update(handed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFillCode]);

  const handleChange = text => {
    const next = typedCode(text, length);
    if (next !== code) {
      update(next);
    }
  };

  const active = activeBox(code, length);

  return (
    <View style={styles.wrapper}>
      <Pressable
        style={styles.container}
        onLayout={onContainerLayout}
        onPress={() => input.current?.focus()}
        accessible={false}>
        {boxesOf(code, length).map((value, i) => (
          <View
            key={i}
            style={[
              styles.input,
              value ? styles.inputFilled : null,
              focused && i === active ? styles.inputActive : null,
            ]}>
            <Text style={styles.digit}>{value}</Text>
          </View>
        ))}
        <TextInput
          ref={input}
          style={styles.field}
          keyboardType="number-pad"
          value={code}
          onChangeText={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          caretHidden
          contextMenuHidden
          returnKeyType="done"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          accessibilityLabel="One-time PIN"
        />
      </Pressable>
    </View>
  );
};

export default OTPInput;

const getStyles = ({ look, length, containerWidth }) => {
  const minGap = 2;
  const maxGap = 8;
  let gap = maxGap;

  // Sensible default for the single frame before onLayout fires, so
  // nothing flashes oversized/overflowing before the real width is known.
  let inputWidth = 40;

  if (containerWidth) {
    const totalGapWidth = (length - 1) * maxGap;
    inputWidth = (containerWidth - totalGapWidth) / length;

    // If inputs would be too small, reduce the gap instead
    if (inputWidth < 35) {
      gap = minGap;
      inputWidth = (containerWidth - (length - 1) * gap) / length;
    }

    // Ensure minimum and maximum sizes (also keeps things sane on tablets)
    inputWidth = Math.max(Math.min(inputWidth, 50), 32);
  }

  const inputHeight = Math.max(Math.min(inputWidth * 1.2, 58), 40);

  return StyleSheet.create({
    wrapper: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 20,
      paddingHorizontal: 20,
    },
    container: {
      flexDirection: 'row',
      gap,
      justifyContent: 'center',
      // width: '100%' (instead of maxWidth + alignSelf) so onLayout reports
      // the true available width of this row, regardless of how much
      // padding exists in parent containers above it.
      width: '100%',
      maxWidth: 400,
      alignSelf: 'center',
    },
    // One digit: a quiet box, with a gold edge once it holds its digit
    input: {
      width: inputWidth,
      height: inputHeight,
      borderWidth: 1,
      borderRadius: 14,
      borderColor: look.hairline,
      backgroundColor: look.soft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    digit: {
      color: look.text,
      textAlign: 'center',
      fontSize: Math.min(inputWidth * 0.5, 22),
      fontFamily: 'Poppins SemiBold',
    },
    inputFilled: {
      borderColor: look.accent,
      backgroundColor: look.surface,
    },
    // where the next digit goes, while the keyboard is up
    inputActive: {
      borderColor: look.accent,
      borderWidth: 2,
    },
    // the one field the code is typed into: there, out of sight
    field: {
      position: 'absolute',
      width: 1,
      height: 1,
      opacity: 0,
    },
  });
};
