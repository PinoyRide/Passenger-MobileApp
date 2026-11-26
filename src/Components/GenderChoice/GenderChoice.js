import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { modern } from '@/Theme/modern';
import { GENDERS } from '@/Utils/gender';

// Gender, one of two (the owner, 2026-11-23: "Require gender"), laid out as a
// text field is (AppTextInput): its label, the two answers side by side in
// the field's quiet boxes, and its message under them.
const GenderChoice = ({ value, onChange, error }) => {
  const theme = useTheme();
  const look = modern(theme);
  const styles = getStyles(look, theme.colors);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Gender</Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {GENDERS.map(gender => {
          const on = value === gender.value;
          return (
            <Pressable
              key={gender.value}
              onPress={() => onChange(gender.value)}
              style={[
                styles.option,
                error && !value && styles.optionError,
                on && styles.optionOn,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={gender.label}>
              <Icon
                name={gender.icon}
                size={18}
                color={on ? look.chipInk : look.muted}
              />
              <Text style={[styles.optionText, on && styles.optionTextOn]}>
                {gender.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};

export default GenderChoice;

const getStyles = (look, colors) =>
  StyleSheet.create({
    container: {
      marginBottom: 18,
    },
    label: {
      fontFamily: 'Poppins Medium',
      fontSize: 13,
      lineHeight: 18,
      color: look.muted,
      marginBottom: 6,
    },
    row: {
      flexDirection: 'row',
      gap: 10,
    },
    option: {
      flex: 1,
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: look.hairline,
      borderRadius: 14,
      backgroundColor: look.soft,
    },
    optionOn: {
      borderColor: look.accent,
      backgroundColor: look.chip,
    },
    optionError: {
      borderColor: colors.error,
    },
    optionText: {
      fontFamily: 'Poppins Medium',
      fontSize: 15,
      lineHeight: 21,
      color: look.inkSoft,
    },
    optionTextOn: {
      color: look.chipInk,
    },
    error: {
      marginTop: 6,
      fontFamily: 'Poppins Regular',
      fontSize: 12,
      lineHeight: 17,
      color: colors.error,
    },
  });
