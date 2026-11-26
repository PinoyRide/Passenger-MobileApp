import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { modern } from '@/Theme/modern';

// The row of quiet tiles on a trip: Call, Message (with its unread count) and
// one more each app chooses. The same file in both apps (sharedUi.test.mjs);
// the owner, 2026-11-23: "the call and message button is much cleaner
// compared to rider". `actions`: [{ id, icon, label, onPress, disabled,
// badge }], `icon` a MaterialCommunityIcons name.
const TripActions = ({ actions = [], style }) => {
  const look = modern(useTheme());
  const styles = getStyles(look);

  return (
    <View style={[styles.row, style]}>
      {actions.map(action => (
        <Pressable
          key={action.id}
          onPress={action.onPress}
          disabled={action.disabled}
          accessibilityRole="button"
          accessibilityLabel={
            action.badge > 0
              ? `${action.label}, ${action.badge} unread`
              : action.label
          }
          accessibilityState={{ disabled: Boolean(action.disabled) }}
          style={({ pressed }) => [
            styles.action,
            action.disabled && styles.disabled,
            pressed && styles.pressed,
          ]}>
          <Icon name={action.icon} size={20} color={look.ink} />
          <Text style={styles.label} numberOfLines={1}>
            {action.label}
          </Text>
          {action.badge > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {action.badge > 9 ? '9+' : action.badge}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
};

export default TripActions;

const getStyles = look =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 9,
    },
    action: {
      flex: 1,
      minHeight: 54,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      borderRadius: look.radiusTile,
      backgroundColor: look.soft,
    },
    disabled: {
      opacity: 0.5,
    },
    pressed: {
      opacity: 0.85,
    },
    label: {
      fontFamily: 'Poppins Medium',
      fontSize: 11.5,
      lineHeight: 15,
      color: look.ink,
    },
    badge: {
      position: 'absolute',
      top: 6,
      right: 14,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: look.danger,
    },
    badgeText: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 11,
      lineHeight: 14,
      color: '#FFFFFF',
    },
  });
