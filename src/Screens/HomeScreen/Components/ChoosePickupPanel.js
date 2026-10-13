// "Choose this pick up" panel – Figma frame 91 (8:16143), Book Later flow.
// 430-pt frame: panel top y≈740, field 370×40 @ y775, pill 370×50 @ y835.5.
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { AppButton } from '@/Components';

const ChoosePickupPanel = ({ address, onAddressPress, onChoose, onLayout }) => {
  const { colors } = useTheme();
  const styles = getStyles({ colors });

  return (
    <View style={styles.container} onLayout={onLayout}>
      <TouchableOpacity
        style={styles.field}
        onPress={onAddressPress}
        activeOpacity={0.7}>
        <Text style={styles.fieldText} numberOfLines={1}>
          {address || ''}
        </Text>
      </TouchableOpacity>
      <AppButton
        title="Choose this pick up"
        onPress={onChoose}
        noSpacing
        featureStyle={styles.button}
      />
    </View>
  );
};

export default ChoosePickupPanel;

const getStyles = ({ colors }) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.onPrimary,
      paddingTop: 35,
      paddingBottom: 46.5,
      paddingHorizontal: 30,
    },
    field: {
      height: 40,
      borderRadius: 10,
      backgroundColor: colors.blueGrey,
      justifyContent: 'center',
      paddingHorizontal: 18,
      marginBottom: 20.5,
    },
    fieldText: {
      fontFamily: 'Poppins Regular',
      fontSize: 12,
      color: colors.grey3,
    },
    button: {
      height: 50,
      marginTop: 0,
    },
  });
