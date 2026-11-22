import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { modern } from '@/Theme/modern';
import { NO_FARE, serviceRows } from '@/Utils/serviceList';

// The ride types. `meta` is the short line under the name, `badge` an optional
// tag beside it. The icons are one-colour shapes, tinted for each state.
export const services = [
  {
    id: 1,
    icon: require('@/Assets/Common/HomeScreen/Motorcycle.png'),
    title: 'Motorcycle',
    meta: '1 seat',
    badge: 'FASTEST',
  },
  {
    id: 2,
    icon: require('@/Assets/Common/HomeScreen/Car.png'),
    title: 'Car (4 Seaters)',
    meta: '4 seats',
  },
  {
    id: 3,
    icon: require('@/Assets/Common/HomeScreen/Car.png'),
    title: 'Car (6 Seaters)',
    meta: '6 seats',
  },
];

// The ride list inside the booking sheet (it used to be a modal). A row calls
// onSelect with its ride, never with the press event. What each row shows,
// the fare on the chosen one only, is worked out in Utils/serviceList.js.
const ServiceList = ({
  services: rides = services,
  selectedService,
  fare,
  onSelect,
  disabled = false,
  selectedOnly = false,
  style,
}) => {
  const look = modern(useTheme());
  const styles = getStyles(look);
  const rows = serviceRows({
    services: rides,
    selectedId: selectedService?.id,
    fare,
    selectedOnly,
  });
  const locked = disabled || selectedOnly;

  return (
    <View style={style} accessibilityRole="radiogroup">
      {rows.map((row, index) => (
        <Pressable
          key={row.service.id}
          onPress={() => onSelect?.(row.service)}
          disabled={locked}
          accessibilityRole="radio"
          accessibilityState={{ selected: row.selected, disabled: locked }}
          accessibilityLabel={row.label}
          style={({ pressed }) => [
            styles.card,
            row.selected ? styles.cardSelected : styles.cardResting,
            index < rows.length - 1 && styles.gap,
            pressed && styles.pressed,
          ]}>
          <View
            style={[
              styles.tile,
              { backgroundColor: row.selected ? look.accent : look.chip },
            ]}>
            <Image
              source={row.service.icon}
              style={[
                styles.icon,
                { tintColor: row.selected ? look.onAccent : look.chipInk },
              ]}
            />
          </View>
          <View style={styles.middle}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {row.service.title}
              </Text>
              {row.service.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{row.service.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.meta} numberOfLines={1}>
              {row.meta}
            </Text>
          </View>
          <Text style={[styles.fare, row.fare === NO_FARE && styles.noFare]}>
            {row.fare}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

export default ServiceList;

const getStyles = look =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      // with the 2px ring, 11 from the card's edge whether chosen or not
      padding: 9,
      borderWidth: 2,
      borderRadius: look.radiusCard,
    },
    cardSelected: {
      backgroundColor: look.surface,
      borderColor: look.accent,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.09,
      shadowRadius: 10,
      elevation: 4,
    },
    cardResting: {
      backgroundColor: look.soft,
      borderColor: 'transparent',
    },
    gap: {
      marginBottom: 10,
    },
    pressed: {
      opacity: 0.85,
    },
    tile: {
      width: 50,
      height: 50,
      borderRadius: look.radiusTile,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    icon: {
      width: 30,
      height: 21,
      resizeMode: 'contain',
    },
    middle: {
      flex: 1,
      marginRight: 10,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    name: {
      flexShrink: 1,
      fontFamily: 'Poppins Medium',
      fontSize: 15,
      lineHeight: 20,
      letterSpacing: -0.2,
      color: look.ink,
    },
    badge: {
      marginLeft: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: look.radiusPill,
      backgroundColor: look.onSuccess,
    },
    badgeText: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 11,
      lineHeight: 14,
      letterSpacing: 1.2,
      color: look.success,
    },
    meta: {
      fontFamily: 'Poppins Regular',
      fontSize: 13,
      lineHeight: 18,
      // inkSoft, not muted: the resting cards sit on `soft`
      color: look.inkSoft,
    },
    fare: {
      fontFamily: 'Poppins Medium',
      fontSize: 15,
      lineHeight: 20,
      letterSpacing: -0.2,
      color: look.ink,
    },
    noFare: {
      color: look.inkSoft,
    },
  });
