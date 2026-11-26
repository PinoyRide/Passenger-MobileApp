import React, { useCallback, useState } from 'react';
import { BackHandler, Linking, StyleSheet, Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AppButton from '@/Components/AppButton/AppButton';
import { modern } from '@/Theme/modern';
import { displayVersion } from '@/Utils/displayVersion';
import { openUpdateLink, updateNeededText } from '@/Utils/updateNeededText';

// Update needed (A-184, C-4): plain words, the gold icon patch, the app's one
// gold button. Colours only from modern.js, so it turns with the look.
const UpdateRequiredScreen = ({ route }) => {
  // The backend also names a "current version". It is not shown: the person
  // is told a newer version is needed, not which one they have. The minimum
  // comes from the API as the real version (2.0.103) and is shown on a small
  // line as people count it (v2.1.04): Utils/updateNeededText.js.
  const { updateLink, minimumVersion } = route.params || {};
  const theme = useTheme();
  const look = modern(theme);
  const styles = getStyles(look);
  const words = updateNeededText(displayVersion(minimumVersion));

  const [isProcessing, setIsProcessing] = useState(false);
  // the red line under the button when the download page did not open
  const [problem, setProblem] = useState(null);

  // Block the hardware back button — nowhere to go back to, the app is outdated.
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => true;
      const sub = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress,
      );
      return () => sub.remove();
    }, []),
  );

  // Off to the download, still signed in (the owner, 2026-11-23: reduce
  // cost): installing the new APK keeps the app's data, so no new sign-in,
  // no paid code text. Should the sign-in be lost all the same, the backend
  // lets a newer version take over the old session (LoginSession). With no
  // link, or a link that does not open, one red line says so and the button
  // can be tapped again.
  const handleUpdatePress = async () => {
    if (isProcessing) {
      return;
    }
    setIsProcessing(true);
    setProblem(null);
    try {
      setProblem(await openUpdateLink(updateLink, url => Linking.openURL(url)));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconPatch}>
        <Icon name="cellphone-arrow-down" size={26} color={look.chipInk} />
      </View>
      <Text style={styles.title} maxFontSizeMultiplier={1.3}>
        {words.title}
      </Text>
      <Text style={styles.message} maxFontSizeMultiplier={1.3}>
        {words.message}
      </Text>
      {words.versionLine ? (
        <Text style={styles.versionLine} maxFontSizeMultiplier={1.3}>
          {words.versionLine}
        </Text>
      ) : null}
      <View style={styles.buttonRow}>
        <AppButton
          title={words.button}
          onPress={handleUpdatePress}
          disabled={isProcessing}
          isBold
          noSpacing
        />
        {problem ? (
          <Text
            style={styles.problem}
            maxFontSizeMultiplier={1.3}
            accessibilityLiveRegion="polite">
            {problem}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

export default UpdateRequiredScreen;

const getStyles = look =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
      backgroundColor: look.surface,
    },
    iconPatch: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      backgroundColor: look.chip,
    },
    title: {
      fontSize: 20,
      lineHeight: 28,
      fontFamily: 'Poppins SemiBold',
      color: look.ink,
      marginBottom: 8,
      textAlign: 'center',
    },
    message: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: 'Poppins Regular',
      color: look.inkSoft,
      textAlign: 'center',
    },
    versionLine: {
      fontSize: 12,
      lineHeight: 17,
      fontFamily: 'Poppins Regular',
      color: look.muted,
      textAlign: 'center',
      marginTop: 8,
    },
    buttonRow: {
      alignSelf: 'stretch',
      marginTop: 24,
    },
    problem: {
      fontSize: 13,
      lineHeight: 18,
      fontFamily: 'Poppins Regular',
      color: look.red,
      textAlign: 'center',
      marginTop: 10,
    },
  });
