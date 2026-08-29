import { AppButton } from '@/Components';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { selectUserInfo } from '@/Redux/Slices/userSlice';
import { Constants } from '@/Utils';
import usePostRequest from '@/Services/Api';

const UNREAD_POLL_INTERVAL_MS = 5000;

const BookingStatusModal = ({
  onLayout,
  riderDetails,
  onShareTrip,
  bookingDetails,
  bookingStatus,
  pickup,
  dropoff,
  selectedService,
  onChangeService,
}) => {
  const { colors } = useTheme();
  const styles = getStyles({ colors });
  const navigation = useNavigation();
  const userInfo = useSelector(selectUserInfo);

  // ✅ payment_details may be a JSON string if echoed back from API
  const paymentDetails =
    typeof bookingDetails?.payment_details === 'string'
      ? (() => {
          try {
            return JSON.parse(bookingDetails.payment_details);
          } catch {
            return {};
          }
        })()
      : bookingDetails?.payment_details ?? {};

  // ── Unread message badge ────────────────────────────────────────────
  const getUnreadCount = usePostRequest();
  const [unreadCount, setUnreadCount] = useState(0);
  const unreadPollRef = useRef(null);

  useEffect(() => {
    const bookingId = bookingDetails?.id;

    if (!bookingId || !riderDetails) {
      setUnreadCount(0);
      if (unreadPollRef.current) {
        clearInterval(unreadPollRef.current);
        unreadPollRef.current = null;
      }
      return;
    }

    const fetchUnreadCount = async () => {
      const customerId = userInfo?.id;
      const { response, error } = await getUnreadCount.makePostRequest(
        Constants.ENDPOINT.GET_UNREAD_MESSAGE_COUNT,
        { booking_id: bookingId, user_id: customerId, user_type: 'customer' },
        {},
        'json',
      );
      if (error) {
        return;
      }
      // Response shape assumed to match the other messages/* endpoints:
      // { code: 200, data: { unread_count } }. Adjust the field name here
      // if your backend returns something different (e.g. `count`).
      const count = response?.data?.unread_count ?? response?.data?.count ?? 0;
      setUnreadCount(Number(count) || 0);
    };

    fetchUnreadCount();
    unreadPollRef.current = setInterval(
      fetchUnreadCount,
      UNREAD_POLL_INTERVAL_MS,
    );

    return () => {
      if (unreadPollRef.current) {
        clearInterval(unreadPollRef.current);
        unreadPollRef.current = null;
      }
    };
  }, [bookingDetails?.id, riderDetails]);
  // ─────────────────────────────────────────────────────────────────────

  const handleCall = () => {
    const phoneNumber = riderDetails?.ekyc_details?.pretty_mobile_no;
    if (!phoneNumber) {
      return;
    }
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleMessage = () => {
    if (!bookingDetails?.id) {
      return;
    }

    // Clear the badge immediately on open — the ChatScreen's own
    // mark-as-read call will confirm this with the server; this just
    // avoids the badge lingering visually until the next poll tick.
    setUnreadCount(0);

    const ekyc = riderDetails?.ekyc_details;
    const otherPartyName =
      `${ekyc?.first_name || ''} ${ekyc?.last_name || ''}`.trim() || 'Rider';

    navigation.navigate('ChatScreen', {
      bookingId: bookingDetails.id,
      otherPartyName,
      otherPartyAvatar: ekyc?.selfie || null,
    });
  };

  const handleShareTrip = async () => {
    const pickupAddress =
      pickup?.address || bookingDetails?.pickup_location || 'N/A';
    const dropoffAddress =
      dropoff?.address || bookingDetails?.dropoff_location || 'N/A';
    const riderName = riderDetails?.ekyc_details
      ? `${riderDetails.ekyc_details.first_name} ${riderDetails.ekyc_details.last_name}`
      : 'Unknown Rider';
    const plateNumber =
      riderDetails?.vehicle_details?.[0]?.plate_number || 'N/A';
    const vehicle = riderDetails?.vehicle_details?.[0]
      ? `${riderDetails.vehicle_details[0].brand} ${riderDetails.vehicle_details[0].model}`
      : 'N/A';
    const fare = paymentDetails?.total_amount || 0;

    const message =
      "🛵 I'm on a Pinoy Ride!\n\n" +
      `📍 Pickup: ${pickupAddress}\n` +
      `🏁 Dropoff: ${dropoffAddress}\n\n` +
      `🧑 Rider: ${riderName}\n` +
      `🏍️ Vehicle: ${vehicle}\n` +
      `🔖 Plate: ${plateNumber}\n` +
      `💰 Fare: ₱${fare}\n\n`;

    try {
      await Share.share({ message });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  if (!riderDetails) {
    return (
      <View style={styles.overlay} onLayout={onLayout}>
        <View style={styles.container}>
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Finding your rider...</Text>
          </View>
        </View>
      </View>
    );
  }

  const ekycDetails = riderDetails?.ekyc_details;

  return (
    <View style={styles.overlay} onLayout={onLayout}>
      <View style={styles.container}>
        {/* Fare + Vehicle */}
        <TouchableOpacity
          style={styles.rowBetween}
          onPress={onChangeService}
          disabled={!(bookingStatus === 0 || bookingStatus === 4)}>
          <View>
            <Text style={styles.label}>
              {selectedService?.title || 'Vehicle'}
            </Text>
            {(bookingStatus === 0 || bookingStatus === 4) && (
              <Text style={styles.changeText}>Tap to change</Text>
            )}
          </View>
          {/* ✅ Show total_amount from payment_details */}
          <Text style={styles.price}>
            ₱{paymentDetails?.total_amount || bookingDetails?.total_amount || 0}
          </Text>
        </TouchableOpacity>

        {(bookingStatus === 2 || bookingStatus === 3) && (
          <>
            {/* Pickup & Dropoff */}
            <View style={styles.locationColumn}>
              <View style={styles.locationGroup}>
                <View style={styles.locationButton}>
                  <Image
                    source={require('@/Assets/Common/Pick_Up_Icon.png')}
                    style={styles.locationIcon}
                  />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {pickup?.description || bookingDetails?.pickup_location}
                  </Text>
                </View>

                <View style={styles.dotLine}>
                  {[...Array(2)].map((_, i) => (
                    <View key={i} style={styles.dot} />
                  ))}
                </View>

                <View style={styles.locationButton}>
                  <Image
                    source={require('@/Assets/Common/Drop_Off_Icon.png')}
                    style={styles.locationIcon}
                  />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {dropoff?.description || bookingDetails?.dropoff_location}
                  </Text>
                </View>
              </View>
            </View>

            {/* Fare Breakdown */}
            <View style={styles.fareBreakdown}>
              <View style={styles.fareRow}>
                <Text
                  style={[styles.feeText, { fontFamily: 'Poppins SemiBold' }]}>
                  Final Fare
                </Text>
                <Text
                  style={[styles.feeText, { fontFamily: 'Poppins SemiBold' }]}>
                  ₱{paymentDetails?.total_amount}
                </Text>
              </View>
              {/* <View style={styles.fareRow}>
                <Text style={styles.feeText}>Booking Fee</Text>
                <Text style={styles.feeText}>
                  ₱{paymentDetails?.booking_fee}
                </Text>
              </View> */}
              <View style={styles.fareRow}>
                <Text style={styles.feeText}>Payment Method</Text>
                <Text style={styles.feeText}>{paymentDetails?.type}</Text>
              </View>
            </View>
          </>
        )}

        <View style={styles.separator} />

        {/* Rider Info */}
        <View style={styles.riderRow}>
          <Image
            source={
              riderDetails?.vehicle_details?.[0]?.motorcyle_img
                ? { uri: riderDetails.vehicle_details[0].motorcyle_img }
                : {
                    uri:
                      'https://ui-avatars.com/api/?name=' +
                      encodeURIComponent(
                        (ekycDetails?.first_name || '') +
                          ' ' +
                          (ekycDetails?.last_name || ''),
                      ),
                  }
            }
            style={styles.avatar}
          />

          <View style={{ flex: 1 }}>
            <Text style={styles.riderName}>
              {ekycDetails?.first_name} {ekycDetails?.last_name}
            </Text>
            <Text style={styles.plate}>
              {riderDetails.vehicle_details?.[0]?.plate_number}
            </Text>
            <Text style={styles.vehicle}>
              {riderDetails.vehicle_details?.[0]?.brand}{' '}
              {riderDetails.vehicle_details?.[0]?.model}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.circleBtn} onPress={handleMessage}>
              <Text>💬</Text>
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.circleBtn} onPress={handleCall}>
              <Text>📞</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Share Trip */}
        <AppButton
          title="Share Your Trip Details"
          onPress={handleShareTrip}
          mode="outlined"
          buttonColor={colors.primary}
          textColor={colors.primary}
          isBold
          noSpacing
        />
      </View>
    </View>
  );
};

export default BookingStatusModal;

const getStyles = ({ colors }) =>
  StyleSheet.create({
    overlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'transparent',
    },
    container: {
      backgroundColor: colors.onPrimary,
      padding: 20,
      elevation: 10,
      paddingBottom: 50,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 20,
      gap: 10,
    },
    loadingText: {
      fontFamily: 'Poppins Medium',
      fontSize: 14,
      color: colors.onSurfaceVariant,
      marginLeft: 10,
    },
    rowBetween: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    vehicleInfo: {
      flexDirection: 'column',
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      fontFamily: 'Poppins SemiBold',
    },
    changeText: {
      fontSize: 12,
      color: colors.primary,
      fontFamily: 'Poppins Regular',
      marginTop: 2,
    },
    price: {
      fontSize: 16,
      fontWeight: '600',
      fontFamily: 'Poppins SemiBold',
    },
    separator: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.backdrop,
      marginVertical: 10,
    },
    riderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
    },
    avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 10 },
    riderName: {
      fontWeight: 'bold',
      fontSize: 16,
      fontFamily: 'Poppins SemiBold',
    },
    plate: {
      color: colors.shadow,
      fontFamily: 'Poppins Regular',
    },
    vehicle: {
      color: colors.shadow,
      fontSize: 12,
      fontFamily: 'Poppins Regular',
    },
    actions: { flexDirection: 'row' },
    circleBtn: {
      backgroundColor: colors.primary,
      borderRadius: 30,
      padding: 10,
      marginLeft: 8,
    },
    unreadBadge: {
      position: 'absolute',
      top: -2,
      right: -2,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 3,
      backgroundColor: '#FF3B30',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: '#fff',
    },
    unreadBadgeText: {
      color: '#fff',
      fontSize: 9,
      fontFamily: 'Poppins SemiBold',
      lineHeight: 11,
    },
    locationColumn: {
      marginTop: 20,
      alignItems: 'flex-start',
    },
    locationGroup: {
      alignItems: 'flex-start',
    },
    dotLine: {
      height: 24,
      justifyContent: 'space-between',
      marginLeft: 11,
      paddingVertical: 5,
    },
    dot: {
      width: 5,
      height: 5,
      borderRadius: 2,
      backgroundColor: colors.grey,
    },
    locationButton: {
      width: '90%',
      flexDirection: 'row',
      alignItems: 'center',
    },
    locationIcon: {
      width: 27,
      height: 27,
      resizeMode: 'contain',
      marginRight: 10,
    },
    locationText: {
      fontSize: 16,
      color: colors.locationTextColor,
      fontFamily: 'Poppins SemiBold',
    },
    fareBreakdown: {
      marginTop: 10,
    },
    fareRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginVertical: 4,
    },
    feeText: {
      fontFamily: 'Poppins Regular',
      fontSize: 16,
      color: colors.shadow,
    },
  });
