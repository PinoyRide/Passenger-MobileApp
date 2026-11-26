import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { modern } from '@/Theme/modern';

// The place search bar: a magnifier, the words, a cross that clears them, and
// a Cancel beside it when asked for. Taken out of the Passenger's Add Saved
// Place for the Rider's Home Address (A-328), looking as it did. The same file
// in both apps (sharedUi.test.mjs).

// The clear cross: `muted` (4.90:1 on the bar) and a 48 dp target (design
// A-328 F2, recommended; awaiting the owner's OK on the look). The one line to
// go back to the old cross: { color: 'faint', hitSlop: 8 }
const CLEAR_CROSS = { color: 'muted', hitSlop: 15 };

const PlaceSearchBar = ({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  onFocus,
  onBlur,
  showCancel = false,
  onCancel,
  autoFocus = false,
  inputRef,
}) => {
  const theme = useTheme();
  const look = modern(theme);
  const styles = getStyles({ colors: theme.colors, look });

  return (
    <View style={styles.searchArea}>
      <View style={styles.searchBar}>
        <Icon name="magnify" size={20} color={look.muted} />
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          autoFocus={autoFocus}
          placeholder={placeholder}
          placeholderTextColor={look.muted}
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel={accessibilityLabel || placeholder}
        />
        {value ? (
          <Pressable
            onPress={() => onChangeText('')}
            hitSlop={CLEAR_CROSS.hitSlop}
            accessibilityRole="button"
            accessibilityLabel="Clear the search">
            <Icon
              name="close-circle"
              size={18}
              color={look[CLEAR_CROSS.color]}
            />
          </Pressable>
        ) : null}
      </View>
      {showCancel ? (
        <Pressable
          onPress={onCancel}
          hitSlop={8}
          style={styles.searchCancel}
          accessibilityRole="button">
          <Text style={styles.searchCancelText}>Cancel</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

export default PlaceSearchBar;

const getStyles = ({ colors, look }) =>
  StyleSheet.create({
    searchArea: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.background,
    },
    searchBar: {
      flex: 1,
      height: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: look.hairline,
      backgroundColor: look.soft,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 0,
      fontFamily: 'Poppins Regular',
      fontSize: 15,
      color: look.ink,
    },
    searchCancel: {
      paddingVertical: 8,
    },
    searchCancelText: {
      fontFamily: 'Poppins Medium',
      fontSize: 14,
      color: look.link,
    },
  });
