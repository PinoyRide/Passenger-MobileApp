import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { modern } from '@/Theme/modern';

// "Finding your rider" with a bar that keeps sliding (docs/booking-redesign-
// spec.md, "Searching"): a hairline track, a gold fill 42% wide on a looped
// slide; still for anyone who turned motion down. Used by the booking sheet
// while a booking waits for a rider, and by the trip sheet while a rider's
// details load.
const FindingRider = ({ caption = 'Usually under a minute' }) => {
  const look = modern(useTheme());
  const styles = getStyles(look);
  const [width, setWidth] = useState(0);
  const [still, setStill] = useState(false);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(reduce => alive && setStill(Boolean(reduce)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (still) {
      return undefined;
    }
    const loop = Animated.loop(
      Animated.timing(slide, {
        toValue: 1,
        duration: 1500,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [slide, still]);

  const fill = width * 0.42;
  const translateX = still
    ? (width - fill) / 2
    : slide.interpolate({ inputRange: [0, 1], outputRange: [-fill, width] });

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Finding your rider">
      <Text style={styles.title} maxFontSizeMultiplier={1.3}>
        Finding your rider
      </Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      <View
        style={styles.track}
        onLayout={e => setWidth(e.nativeEvent.layout.width)}>
        {width ? (
          <Animated.View
            style={[styles.fill, { width: fill, transform: [{ translateX }] }]}
          />
        ) : null}
      </View>
    </View>
  );
};

export default FindingRider;

const getStyles = look =>
  StyleSheet.create({
    // Title role
    title: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 22,
      lineHeight: 27,
      letterSpacing: -0.5,
      color: look.ink,
    },
    caption: {
      marginTop: 2,
      fontFamily: 'Poppins Regular',
      fontSize: 13,
      lineHeight: 18,
      color: look.muted,
    },
    track: {
      marginTop: 16,
      height: 6,
      borderRadius: look.radiusPill,
      overflow: 'hidden',
      backgroundColor: look.hairline,
    },
    fill: {
      height: 6,
      borderRadius: look.radiusPill,
      backgroundColor: look.accent,
    },
  });
