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

// A group of menu lines on a settings-style screen, and one line of it: a
// small icon, what it does, a short note under it, and a chevron. A "danger"
// line (deleting the account) is red. The same file in both apps.

export const MenuGroup = ({ children, style }) => {
  const look = modern(useTheme());
  const styles = getStyles(look);
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.group, style]}>
      {rows.map((row, index) => (
        <View key={row.key ?? index} style={index > 0 && styles.divided}>
          {row}
        </View>
      ))}
    </View>
  );
};

export const MenuRow = ({
  icon,
  title,
  note,
  onPress,
  tone = 'normal', // 'normal' | 'danger'
  busy = false,
  disabled = false,
}) => {
  const theme = useTheme();
  const look = modern(theme);
  const styles = getStyles(look);
  const danger = tone === 'danger';
  const red = theme.colors.error || '#D32F2F';

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={disabled || busy}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy, busy }}>
      <View style={[styles.chip, danger && styles.chipDanger]}>
        <Icon name={icon} size={20} color={danger ? red : look.chipInk} />
      </View>
      <View style={styles.words}>
        <Text style={[styles.title, danger && { color: red }]}>{title}</Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}
      </View>
      {busy ? (
        <ActivityIndicator color={look.muted} />
      ) : (
        <Icon name="chevron-right" size={22} color={look.muted} />
      )}
    </TouchableOpacity>
  );
};

const getStyles = look =>
  StyleSheet.create({
    group: {
      borderRadius: look.radius,
      borderWidth: 1,
      borderColor: look.hairline,
      backgroundColor: look.surface,
      overflow: 'hidden',
    },
    divided: { borderTopWidth: 1, borderTopColor: look.hairline },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    chip: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: look.chip,
    },
    chipDanger: { backgroundColor: look.soft },
    words: { flex: 1, gap: 2 },
    title: { fontSize: 15, fontFamily: 'Poppins Medium', color: look.text },
    note: { fontSize: 12.5, fontFamily: 'Poppins Regular', color: look.muted },
  });
