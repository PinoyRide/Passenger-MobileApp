import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { modern } from '@/Theme/modern';

// One suggestion of a place search: what the place is, where, and how far
// (the distance is left out where it means nothing, as for a home address).
// One line each unless asked for more (the Rider's home address: 2 and 2, so
// a short line still shows its city at a large font).
// Taken out of the Passenger's Add Saved Place for the Rider's Home Address
// (A-328), looking as it did. The same file in both apps (sharedUi.test.mjs).
const PlaceResultRow = ({
  icon,
  title,
  subtitle,
  distance,
  onPress,
  titleLines = 1,
  subtitleLines = 1,
}) => {
  const look = modern(useTheme());
  const styles = getStyles({ look });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.resultRow,
        pressed && styles.resultPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')}>
      <View style={styles.resultIcon}>
        <Icon name={icon} size={18} color={look.chipInk} />
      </View>
      <View style={styles.resultWords}>
        <Text style={styles.resultTitle} numberOfLines={titleLines}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.resultSubtitle} numberOfLines={subtitleLines}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {distance ? <Text style={styles.resultDistance}>{distance}</Text> : null}
    </Pressable>
  );
};

export default PlaceResultRow;

const getStyles = ({ look }) =>
  StyleSheet.create({
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: look.hairline,
    },
    resultPressed: {
      opacity: 0.7,
    },
    resultIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: look.chip,
    },
    resultWords: {
      flex: 1,
    },
    resultTitle: {
      fontFamily: 'Poppins Medium',
      fontSize: 15,
      lineHeight: 21,
      color: look.ink,
    },
    resultSubtitle: {
      fontFamily: 'Poppins Regular',
      fontSize: 13,
      lineHeight: 18,
      color: look.muted,
    },
    resultDistance: {
      fontFamily: 'Poppins Regular',
      fontSize: 12,
      color: look.faint,
    },
  });
