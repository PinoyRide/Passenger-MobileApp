import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import { READY_SHOWN_MS, updateNotice } from '@/Utils/updateNotice';

// A small line over the bottom of the app while an update that did not make
// it into this start is downloading, and for a few seconds once it is ready.
// It takes no touches: whatever is under it keeps working.
const UpdateNotice = () => {
  const { isDownloading, isUpdatePending } = Updates.useUpdates();
  const notice = updateNotice({ isDownloading, isUpdatePending });
  const kind = notice?.kind ?? null;

  // "Update ready" has been on the screen long enough.
  const [readyWasShown, setReadyWasShown] = useState(false);
  useEffect(() => {
    if (kind !== 'ready') {
      return undefined;
    }
    const timer = setTimeout(() => setReadyWasShown(true), READY_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [kind]);

  const visible = !!notice && !(kind === 'ready' && readyWasShown);
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  // The words stay while the line fades out.
  const words = useRef(null);
  if (notice) {
    words.current = notice.text;
  }
  if (!words.current) {
    return null;
  }

  return (
    <Animated.View pointerEvents="none" style={[styles.place, { opacity }]}>
      <View style={styles.line}>
        <View style={styles.dot} />
        <Text style={styles.words}>{words.current}</Text>
      </View>
    </Animated.View>
  );
};

export default UpdateNotice;

const styles = StyleSheet.create({
  place: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 44,
    alignItems: 'center',
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '86%',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(28, 27, 30, 0.94)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 9,
    backgroundColor: '#FEC107',
  },
  words: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontFamily: 'Poppins Regular',
    fontSize: 12.5,
    lineHeight: 18,
  },
});
