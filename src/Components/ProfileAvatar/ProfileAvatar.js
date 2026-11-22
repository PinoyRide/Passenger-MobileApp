import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { modern } from '@/Theme/modern';
import { initialsOf } from '@/Utils/personName';

// A person's profile photo. Without one: their initials on gold when `name`
// is given and known (the owner's Account design, 2026-11-22: "JR"), else a
// plain "no photo yet" figure. Never a sample photo of somebody else: a new
// account must not look like it already has a picture.
const ProfileAvatar = ({ uri, size = 60, style, name }) => {
  const look = modern(useTheme());
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return <Image source={{ uri }} style={[round, style]} />;
  }
  const initials = initialsOf(name);
  if (initials) {
    return (
      <View
        style={[styles.initials, round, { backgroundColor: look.gold }, style]}
        accessibilityLabel={name}>
        <Text
          style={[
            styles.initialsText,
            { fontSize: size * 0.32, color: look.onGold },
          ]}
          maxFontSizeMultiplier={1}>
          {initials}
        </Text>
      </View>
    );
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
  initials: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontFamily: 'Poppins SemiBold',
    includeFontPadding: false,
  },
});
