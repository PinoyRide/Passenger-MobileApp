import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

// A person's profile photo, or a plain "no photo yet" figure when they have
// none. Never a sample photo of somebody else: a new account must not look
// like it already has a picture.
const ProfileAvatar = ({ uri, size = 60, style }) => {
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return <Image source={{ uri }} style={[round, style]} />;
  }
  const head = size * 0.36;
  return (
    <View
      style={[styles.empty, round, style]}
      accessibilityLabel="No profile photo yet">
      <View
        style={[
          styles.figure,
          {
            width: head,
            height: head,
            borderRadius: head / 2,
            marginTop: size * 0.2,
          },
        ]}
      />
      <View
        style={[
          styles.figure,
          {
            width: size * 0.72,
            height: size * 0.72,
            borderRadius: size * 0.36,
            marginTop: size * 0.07,
          },
        ]}
      />
    </View>
  );
};

export default ProfileAvatar;

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: '#E3E5EA',
  },
  figure: { backgroundColor: '#B4B9C4' },
});
