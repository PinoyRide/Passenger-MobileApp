import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';

// One line of consent: a tick box, and the name of the document it is for as
// a link that opens it. Ticking is always a deliberate tap on the box (or the
// words before the link); opening the document never ticks it.
const ConsentCheck = ({
  checked,
  onToggle,
  label,
  linkText,
  onOpen,
  style,
}) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, style]}>
      <TouchableOpacity
        onPress={onToggle}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={`${label} ${linkText}`}
        style={[
          styles.box,
          { borderColor: colors.primary },
          checked && { backgroundColor: colors.primary },
        ]}>
        {checked && <Ionicons name="checkmark" size={16} color="white" />}
      </TouchableOpacity>
      <Text style={[styles.label, { color: colors.primary }]}>
        <Text onPress={onToggle}>{label} </Text>
        <Text style={styles.link} onPress={onOpen} accessibilityRole="link">
          {linkText}
        </Text>
      </Text>
    </View>
  );
};

export default ConsentCheck;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  box: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  label: {
    flexShrink: 1,
    fontFamily: 'Poppins Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  link: { textDecorationLine: 'underline' },
});
