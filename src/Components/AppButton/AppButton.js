import React, { memo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { modern } from '@/Theme/modern';

// The app's button.
//   contained  the main thing to do on a screen: gold, with dark words
//   outlined   the other choice beside it: a quiet outline
//   light      a white button that sits on a map or a picture
// A buttonColor of one's own keeps its meaning (red for giving up, grey
// for not available): it colours the button, or the outline and its words.
const AppButton = ({
  title,
  onPress,
  noSpacing,
  buttonColor,
  textColor,
  leftIcon,
  rightIcon,
  isBold = false,
  disabled = false,
  mode = 'contained', // 'contained' | 'outlined' | 'light'
  labelStyle,
  featureStyle,
}) => {
  const theme = useTheme();
  const { colors, dark } = theme;
  const look = modern(theme);
  const styles = getStyles();

  const hasIcon = !!leftIcon || !!rightIcon;
  const isOutlined = mode === 'outlined';
  const isLight = mode === 'light';
  // The app's own gold takes dark words; any other colour keeps white ones.
  const isGold = !buttonColor || buttonColor === colors.primary;

  const background = isLight
    ? dark
      ? look.soft
      : '#FFFFFF'
    : isOutlined
    ? 'transparent'
    : buttonColor || colors.primary;
  const border = isOutlined
    ? buttonColor || look.hairline
    : isLight
    ? look.hairline
    : 'transparent';
  const words =
    textColor ??
    (isLight
      ? look.text
      : isOutlined
      ? buttonColor || look.text
      : isGold
      ? look.onAccent
      : colors.onPrimary);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      style={[
        styles.button,
        {
          backgroundColor: background,
          borderColor: border,
          borderWidth: isOutlined || isLight ? 1 : 0,
          height: hasIcon ? 58 : 54,
          marginVertical: noSpacing ? 0 : 20,
          opacity: disabled ? 0.5 : 1,
        },
        featureStyle,
      ]}>
      <View style={styles.innerContent}>
        <View style={styles.sideIcon}>
          {leftIcon && (
            <Image
              source={leftIcon}
              style={[
                styles.icon,
                { marginLeft: 34, marginRight: 24, tintColor: words },
              ]}
            />
          )}
        </View>

        <View style={styles.textWrapper}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={[
              {
                fontSize: 16,
                lineHeight: 22,
                fontFamily: isBold ? 'Poppins SemiBold' : 'Poppins Medium',
                color: words,
              },
              labelStyle,
            ]}>
            {title}
          </Text>
        </View>

        <View style={styles.sideIcon}>
          {rightIcon && (
            <Image
              source={rightIcon}
              style={[
                styles.icon,
                { marginRight: 24, marginLeft: 5, tintColor: words },
              ]}
            />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default memo(AppButton);

const getStyles = () =>
  StyleSheet.create({
    button: {
      borderRadius: 16,
      paddingHorizontal: 16,
      justifyContent: 'center',
    },
    innerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sideIcon: {
      width: 34,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textWrapper: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    icon: {
      width: 25,
      height: 25,
      resizeMode: 'contain',
    },
  });
