import React, { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppButton, ProfileAvatar } from '@/Components';
import usePostRequest from '@/Services/Api';
import { Constants } from '@/Utils';
import { bottomSpace } from '@/Utils/bottomSpace';
import { getRiderPhoto } from '@/Hooks/bookingTransform';
import { modern } from '@/Theme/modern';

// The rider's profile, opened by tapping the rider on the trip sheet (the
// owner, 2026-11-22). It shows what the Privacy Policy lets a passenger see of
// their rider: photo, name, rating, vehicle and plate. The booking already
// carries all of it but the rating, which booking/rider_profile/ adds each
// time the profile opens.
const RiderProfileSheet = ({
  visible,
  onClose,
  riderDetails,
  bookingDetails,
  vehicle,
  customerId,
}) => {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const theme = useTheme();
  const look = modern(theme);
  const styles = getStyles(look);
  const profileRequest = usePostRequest();
  // { riderId, value, count } from the server; shown only for the rider on screen
  const [rating, setRating] = useState(null);

  const bookingId = bookingDetails?.id;
  const riderId = riderDetails?.id;

  useEffect(() => {
    if (!visible || !bookingId || !customerId) {
      return;
    }
    let cancelled = false;
    (async () => {
      const { response } = await profileRequest.makePostRequest(
        Constants.ENDPOINT.RIDER_PROFILE,
        { customer_id: customerId, booking_id: bookingId },
      );
      const data = response?.data;
      if (!cancelled && response?.code === 200 && data) {
        setRating({
          riderId: data.rider_id,
          value: data.rating == null ? null : Number(data.rating),
          count: Number(data.rating_count) || 0,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, bookingId, customerId]);

  const ekyc = riderDetails?.ekyc_details;
  const fullName =
    [
      ekyc?.first_name || riderDetails?.first_name,
      ekyc?.last_name || riderDetails?.last_name,
    ]
      .map(part => part?.trim())
      .filter(Boolean)
      .join(' ') || 'Your rider';

  const known =
    rating && String(rating.riderId) === String(riderId) ? rating : null;
  let ratingText = '';
  if (known?.value != null && Number.isFinite(known.value)) {
    ratingText = `${known.value.toFixed(1)} · ${known.count} ${
      known.count === 1 ? 'rating' : 'ratings'
    }`;
  } else if (known) {
    ratingText = 'No ratings yet';
  }

  const vehiclePhoto =
    riderDetails?.vehicle_details?.[0]?.vehicle_img_pretty ||
    riderDetails?.vehicle_details?.[0]?.vehicle_img ||
    null;
  const vehicleName = [vehicle?.brand, vehicle?.model]
    .filter(Boolean)
    .join(' ');
  const vehicleType =
    bookingDetails?.vehicle?.pretty_type ||
    bookingDetails?.vehicle_type_label ||
    '';
  const rows = [
    { label: 'Vehicle', value: vehicleName },
    { label: 'Colour', value: vehicle?.color },
    { label: 'Type', value: vehicleType },
  ].filter(row => row.value);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Close the rider's profile"
      />
      <View
        style={[
          styles.sheet,
          { paddingBottom: bottomSpace(bottomInset, 24, 24) },
        ]}>
        <View style={styles.handle} />
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}>
          <View style={styles.person}>
            <ProfileAvatar uri={getRiderPhoto(riderDetails)} size={96} />
            <Text
              style={styles.name}
              numberOfLines={2}
              maxFontSizeMultiplier={1.3}>
              {fullName}
            </Text>
            <View style={styles.ratingRow}>
              {known?.value != null ? (
                <Icon name="star" size={17} color={look.accent} />
              ) : null}
              {ratingText ? (
                <Text style={styles.ratingText}>{ratingText}</Text>
              ) : null}
            </View>
          </View>

          {vehiclePhoto || rows.length || vehicle?.plateNumber ? (
            <View style={styles.card}>
              {vehiclePhoto ? (
                <Image
                  source={{ uri: vehiclePhoto }}
                  style={styles.vehiclePhoto}
                  resizeMode="cover"
                  accessibilityLabel="The rider's vehicle"
                />
              ) : null}
              {rows.map(row => (
                <View key={row.label} style={styles.row}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <Text style={styles.rowValue} numberOfLines={1}>
                    {row.value}
                  </Text>
                </View>
              ))}
              {vehicle?.plateNumber ? (
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Plate number</Text>
                  <View style={styles.plate}>
                    <Text style={styles.plateText}>{vehicle.plateNumber}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          <AppButton
            title="Close"
            mode="outlined"
            onPress={onClose}
            noSpacing
          />
        </ScrollView>
      </View>
    </Modal>
  );
};

export default RiderProfileSheet;

const getStyles = look =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '88%',
      backgroundColor: look.surface,
      borderTopLeftRadius: look.radiusSheet,
      borderTopRightRadius: look.radiusSheet,
      paddingHorizontal: 20,
      paddingTop: 10,
    },
    handle: {
      alignSelf: 'center',
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: look.hairline,
      marginBottom: 14,
    },
    content: {
      gap: 16,
    },
    person: {
      alignItems: 'center',
      gap: 6,
    },
    // Title role, as the trip sheet's headline
    name: {
      marginTop: 6,
      fontFamily: 'Poppins SemiBold',
      fontSize: 22,
      lineHeight: 27,
      letterSpacing: -0.5,
      color: look.ink,
      textAlign: 'center',
    },
    ratingRow: {
      minHeight: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    ratingText: {
      fontFamily: 'Poppins Medium',
      fontSize: 14,
      lineHeight: 20,
      color: look.inkSoft,
    },
    card: {
      padding: 14,
      gap: 10,
      borderRadius: look.radiusCard,
      backgroundColor: look.soft,
    },
    vehiclePhoto: {
      width: '100%',
      height: 160,
      borderRadius: look.radiusTile,
      backgroundColor: look.hairline,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      minHeight: 28,
    },
    // inkSoft, not muted, on `soft`
    rowLabel: {
      fontFamily: 'Poppins Regular',
      fontSize: 13,
      lineHeight: 18,
      color: look.inkSoft,
    },
    rowValue: {
      flexShrink: 1,
      fontFamily: 'Poppins Medium',
      fontSize: 15,
      lineHeight: 20,
      color: look.ink,
      textAlign: 'right',
    },
    plate: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: look.ink,
    },
    plateText: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 12.5,
      lineHeight: 16,
      letterSpacing: 0.4,
      color: look.surface,
    },
  });
