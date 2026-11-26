import React from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { modern } from '@/Theme/modern';

// One line of a group of settings: a small icon, what the setting is (and,
// under it, what its present state means), and its switch. The whole line
// can be pressed, not only the switch.
const SettingRow = ({
  icon,
  title,
  note,
  value,
  onToggle,
  disabled = false,
}) => {
  const look = modern(useTheme());
  const styles = getStyles(look);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onToggle}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityState={{ checked: !!value, disabled }}>
      <View style={styles.chip}>
        <Icon name={icon} size={19} color={look.chipInk} />
      </View>

      <View style={styles.words}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {note ? (
          <Text style={styles.note} numberOfLines={1}>
            {note}
          </Text>
        ) : null}
      </View>

      <Switch
        value={!!value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: look.switchOff, true: look.accent }}
        thumbColor="#FFFFFF"
      />
    </TouchableOpacity>
  );
};

export default SettingRow;

const getStyles = look =>
  StyleSheet.create({
    row: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    chip: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: look.chip,
    },
    words: { flex: 1 },
    title: {
      fontFamily: 'Poppins Medium',
      fontSize: 15,
      lineHeight: 21,
      color: look.text,
    },
    note: {
      fontFamily: 'Poppins Regular',
      fontSize: 11,
      lineHeight: 15,
      color: look.muted,
    },
  });
