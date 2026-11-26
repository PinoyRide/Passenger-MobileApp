import React, {
  createContext,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Keyboard, ScrollView, StyleSheet, TextInput } from 'react-native';
import { ERROR_LINE, keyboardPad, revealScroll } from '@/Utils/keyboardRoom';

// A form's ScrollView that keeps the field being typed in above the keyboard
// (A-326, the owner 2026-11-26: "the keyboard covers the text box").
//
// Both apps draw edge to edge, so Android leaves the window full height under
// the keyboard (Utils/keyboardRoom.js says more). While the keyboard is up this
// view adds room at the end of the form, as much as the keyboard covers of it,
// and scrolls the focused field's whole block (label, box, error line) to 16 dp
// above the keyboard top, Gboard's suggestion bar included. A field already in
// view does not move. It takes ScrollView's props and its ref is the
// ScrollView's, so it replaces one as it is.
//
// AppTextInput tells it which field took the focus (KeyboardRoom below), so a
// field focused while the keyboard is already up is brought into view too, with
// its label. A plain TextInput is brought into view when the keyboard comes up.

// What AppTextInput uses: focus({ block, input, reserve }) when it takes the
// focus. Nothing outside a KeyboardScroll.
export const KeyboardRoom = createContext(null);

// the second look catches the room added at the end, and a window that moved
const SETTLE_MS = [60, 320];

const KeyboardScroll = forwardRef(
  (
    {
      children,
      contentContainerStyle,
      onScroll,
      onTouchStart,
      onTouchEnd,
      scrollEventThrottle,
      keyboardShouldPersistTaps = 'handled',
      ...rest
    },
    ref,
  ) => {
    const scrollRef = useRef(null);
    useImperativeHandle(ref, () => scrollRef.current, []);
    const [pad, setPad] = useState(0);
    const keyboardTop = useRef(null);
    const scrollY = useRef(0);
    const focused = useRef(null);
    const timers = useRef([]);

    const reveal = useCallback(() => {
      const view = scrollRef.current;
      const inner = view?.getInnerViewRef?.();
      const top = keyboardTop.current;
      if (!view || !inner || top == null) {
        return;
      }
      // the field that said it took the focus, or a plain TextInput that has it
      let target = focused.current;
      if (!target?.input?.isFocused?.()) {
        const input = TextInput.State.currentlyFocusedInput?.();
        if (!input) {
          return;
        }
        target = { block: input, reserve: ERROR_LINE };
      }
      if (!target.block?.measureLayout) {
        return;
      }
      // fails when the field is not in this form (a box over the screen)
      target.block.measureLayout(
        inner,
        (x, y, width, height) => {
          view.measure((vx, vy, vWidth, vHeight, pageX, pageY) => {
            const blockTop = pageY + y - scrollY.current;
            const next = revealScroll({
              scrollY: scrollY.current,
              viewTop: pageY,
              viewBottom: pageY + vHeight,
              keyboardTop: top,
              blockTop,
              blockBottom: blockTop + height + (target.reserve || 0),
            });
            if (next != null) {
              view.scrollTo({ y: next, animated: true });
            }
          });
        },
        () => {},
      );
    }, []);

    const settle = useCallback(() => {
      timers.current.forEach(clearTimeout);
      timers.current = SETTLE_MS.map(ms => setTimeout(reveal, ms));
    }, [reveal]);

    useEffect(() => {
      const shown = Keyboard.addListener('keyboardDidShow', e => {
        const top = e?.endCoordinates?.screenY;
        if (!Number.isFinite(top)) {
          return;
        }
        keyboardTop.current = top;
        scrollRef.current?.measure?.((x, y, width, height, pageX, pageY) => {
          setPad(keyboardPad({ viewBottom: pageY + height, keyboardTop: top }));
          settle();
        });
      });
      const hidden = Keyboard.addListener('keyboardDidHide', () => {
        keyboardTop.current = null;
        setPad(0);
      });
      return () => {
        shown.remove();
        hidden.remove();
        timers.current.forEach(clearTimeout);
      };
    }, [settle]);

    const room = useMemo(
      () => ({
        focus: target => {
          focused.current = target;
          if (keyboardTop.current != null) {
            settle();
          }
        },
      }),
      [settle],
    );

    const handleScroll = e => {
      scrollY.current = e.nativeEvent.contentOffset.y;
      onScroll?.(e);
    };

    // a tap on another field while the keyboard is up (a plain TextInput
    // tells nobody it took the focus). Only a change of field: a scroll with
    // the keyboard up is left where the finger put it.
    const touchedFrom = useRef(null);
    const focusedNow = () => TextInput.State.currentlyFocusedInput?.() ?? null;
    const handleTouchStart = e => {
      touchedFrom.current = focusedNow();
      onTouchStart?.(e);
    };
    const handleTouchEnd = e => {
      if (keyboardTop.current != null) {
        const from = touchedFrom.current;
        timers.current.push(
          setTimeout(() => {
            const now = focusedNow();
            if (now && now !== from) {
              settle();
            }
          }, 80),
        );
      }
      onTouchEnd?.(e);
    };

    // the room goes on top of the form's own bottom padding
    const own = StyleSheet.flatten(contentContainerStyle) || {};
    const ownBottom =
      own.paddingBottom ?? own.paddingVertical ?? own.padding ?? 0;

    return (
      <KeyboardRoom.Provider value={room}>
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          scrollEventThrottle={scrollEventThrottle ?? 16}
          onScroll={handleScroll}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          contentContainerStyle={[
            contentContainerStyle,
            pad ? { paddingBottom: ownBottom + pad } : null,
          ]}
          {...rest}>
          {children}
        </ScrollView>
      </KeyboardRoom.Provider>
    );
  },
);

export default KeyboardScroll;
