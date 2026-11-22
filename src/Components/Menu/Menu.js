import React, { Children } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { modern } from '@/Theme/modern';

// A group of menu lines on a settings-style page, and one line of it, as the
// owner's Account design draws them (2026-11-22): a white card on the warm
// page, a small label over it, and lines parted by a hairline that starts
// where the words do. A line has a small square tile with its icon, what it
// does, a short note under it, a value or a badge, and a chevron. The tile is
// gold; "quiet" makes it grey, and "danger" (help in an emergency, deleting
// the account) makes the line red. The same file in both apps.

export const MenuGroup = ({ children, label, style }) => {
  const look = modern(useTheme());
  const styles = getStyles(look);
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={style}>
      {label ? (
        <Text style={styles.label} accessibilityRole="header">
          {label.toUpperCase()}
        </Text>
      ) : null}
      <View style={styles.group}>
        {rows.map((row, index) => (
          <View key={row.key ?? index}>
            {index > 0 ? <View style={styles.divider} /> : null}
            {row}
          </View>
        ))}
      </View>
    </View>
  );
};

export const MenuRow = ({
  icon,
  title,
  note,
  value,
  badge,
  onPress,
  tone = 'normal', // 'normal' | 'quiet' | 'danger'
  busy = false,
  disabled = false,
}) => {
  const look = modern(useTheme());
  const styles = getStyles(look);
  const danger = tone === 'danger';
  const quiet = tone === 'quiet';
  let iconColor = look.chipInk;
  if (danger) {
    iconColor = look.red;
  } else if (quiet) {
    iconColor = look.inkSoft;
  }

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={disabled || busy}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={[title, badge || value].filter(Boolean).join(', ')}
      accessibilityHint={note || undefined}
      accessibilityState={{ disabled: disabled || busy, busy }}>
      <View
        style={[
          styles.tile,
          quiet && styles.tileQuiet,
          danger && styles.tileDanger,
        ]}>
        <Icon name={icon} size={19} color={iconColor} />
      </View>
      <View style={styles.words}>
        <Text style={[styles.title, danger && styles.titleDanger]}>
          {title}
        </Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {busy ? (
        <ActivityIndicator color={look.muted} />
      ) : (
        <Icon name="chevron-right" size={20} color={look.faint} />
      )}
    </TouchableOpacity>
  );
};

// the hairline between two lines starts where the words do
const ROW_SIDE = 15;
const TILE = 35;
const GAP = 14;

const getStyles = look =>
  StyleSheet.create({
    label: {
      marginBottom: 12,
      marginLeft: 2,
      fontFamily: 'Poppins SemiBold',
      fontSize: 11.5,
      lineHeight: 15,
      letterSpacing: 1.2,
      color: look.muted,
    },
    group: {
      borderRadius: look.radiusCard,
      backgroundColor: look.card,
      overflow: 'hidden',
    },
    divider: {
      height: 1,
      marginLeft: ROW_SIDE + TILE + GAP,
      backgroundColor: look.hairline,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: GAP,
      minHeight: 56,
      paddingVertical: 10,
      paddingHorizontal: ROW_SIDE,
    },
    tile: {
      width: TILE,
      height: TILE,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: look.chip,
    },
    tileQuiet: { backgroundColor: look.tile },
    tileDanger: { backgroundColor: look.redSoft },
    words: { flex: 1, gap: 1 },
    title: {
      fontFamily: 'Poppins Medium',
      fontSize: 15.5,
      lineHeight: 21,
      color: look.ink,
    },
    titleDanger: { color: look.red },
    note: {
      fontFamily: 'Poppins Regular',
      fontSize: 12.5,
      lineHeight: 17,
      color: look.muted,
    },
    value: {
      maxWidth: 120,
      fontFamily: 'Poppins Regular',
      fontSize: 14,
      lineHeight: 20,
      color: look.muted,
    },
    badge: {
      height: 22,
      paddingHorizontal: 9,
      borderRadius: 7,
      justifyContent: 'center',
      backgroundColor: look.onSuccess,
    },
    badgeText: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 11,
      lineHeight: 14,
      letterSpacing: 0.6,
      color: look.success,
    },
  });
