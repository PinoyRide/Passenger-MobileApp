import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { modern } from '@/Theme/modern';
import { initialsOf } from '@/Utils/personName';

// A person's profile photo. Without one: their initials on gold when `name`
// is given and known (the owner's Account design, 2026-11-22: "JR"), else a
// plain "no photo yet" figure. Never a sample photo of somebody else: a new
// account must not look like it already has a picture.
//   badge       a MaterialCommunityIcons name, drawn in a small round badge
//               on the photo's lower right (the passenger's gender, the
//               owner, 2026-11-23: "display in profile also having a badge")
//   badgeLabel  what a screen reader says for it
//   tint        the initials' circle instead of gold, with tintInk for the
//               letters (the rider on the trip sheet: blue, the owner's design
//               "8 · Rider found", 2026-11-23)
const ProfileAvatar = ({
  uri,
  size = 60,
  style,
  name,
  badge,
  badgeLabel,
  tint,
  tintInk,
}) => {
  const look = modern(useTheme());
  const colours = { fill: tint || look.gold, ink: tintInk || look.onGold };
  if (!badge) {
    return (
      <Face uri={uri} size={size} style={style} name={name} colours={colours} />
    );
  }
  const dot = Math.max(20, Math.round(size * 0.34));
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Face uri={uri} size={size} name={name} colours={colours} />
      <View
        style={[
          styles.badge,
          {
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: look.card,
            borderColor: look.surface,
          },
        ]}
        accessible
        accessibilityLabel={badgeLabel}>
        <Icon name={badge} size={Math.round(dot * 0.6)} color={look.chipInk} />
      </View>
    </View>
  );
};

const Face = ({ uri, size, style, name, colours }) => {
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return <Image source={{ uri }} style={[round, style]} />;
  }
  const initials = initialsOf(name);
  if (initials) {
    return (
      <View
        style={[
          styles.initials,
          round,
          { backgroundColor: colours.fill },
          style,
        ]}
        accessibilityLabel={name}>
        <Text
          style={[
            styles.initialsText,
            { fontSize: size * 0.32, color: colours.ink },
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
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
});
