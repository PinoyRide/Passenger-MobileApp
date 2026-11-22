import { AppButton, ProfileAvatar } from '@/Components';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  PanResponder,
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
import { getBookingVehicle } from '@/Hooks/bookingVehicle';
import { getRiderPhoto } from '@/Hooks/bookingTransform';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomSpace } from '@/Utils/bottomSpace';
import { formatPeso } from '@/Utils/formatPeso';

const UNREAD_POLL_INTERVAL_MS = 5000;

const PAYMENT_METHOD_CONFIG = {
  cash: {
    label: 'Cash',
    icon: require('@/Assets/Common/HomeScreen/PaymentMethodModal/Cash.png'),
  },
  wallet: {
    label: 'Wallet',
    icon: require('@/Assets/Common/HomeScreen/PaymentMethodModal/Wallet.png'),
  },
};

const parseJsonField = value => {
  if (!value) {
    return {};
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value;
};

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
  vehicle,
  statusBannerText = '',
  showSafetyGuide = false,
  onSafetyGuidePress,
  confirmedBookingView = false,
}) => {
  // The navigation bar may cover the bottom of the screen: keep the bottom content clear of it
  const { bottom: bottomInset } = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = getStyles({ colors });
  const navigation = useNavigation();
  const userInfo = useSelector(selectUserInfo);
  const [expanded, setExpanded] = useState(true);

  const swipeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dy) > Math.abs(gesture.dx) && Math.abs(gesture.dy) > 6,
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 16) {
          setExpanded(false);
        } else if (gesture.dy < -16) {
          setExpanded(true);
        }
      },
    }),
  ).current;

  const paymentDetails = parseJsonField(bookingDetails?.payment_details);
  const allPaymentDetails = parseJsonField(paymentDetails?.all_payment_details);
  const paymentType = (
    paymentDetails?.type ||
    bookingDetails?.payment_type ||
    'cash'
  ).toLowerCase();
  const paymentConfig =
    PAYMENT_METHOD_CONFIG[paymentType] || PAYMENT_METHOD_CONFIG.cash;
  const showEstimatedFareLabels =
    Boolean(bookingDetails?.is_advance) &&
    (allPaymentDetails?.fare_is_estimate === true ||
      bookingDetails?.status === 5);
  const finalFareLabel = showEstimatedFareLabels
    ? 'Estimated Fare'
    : 'Final Fare';
  const totalFareLabel = showEstimatedFareLabels
    ? 'Estimated Fare w/ Discount'
    : 'Total Fare w/ Discount';
  const finalFareDisplay =
    allPaymentDetails?.pretty_total_amount_wo_promo ||
    formatPeso(
      paymentDetails?.total_amount_wo_promo ??
        paymentDetails?.total_amount ??
        bookingDetails?.total_amount,
    );
  const totalFareDisplay =
    allPaymentDetails?.pretty_total_amount ||
    formatPeso(
      paymentDetails?.total_amount ?? bookingDetails?.total_amount ?? 0,
    );
  const headerFareDisplay =
    allPaymentDetails?.pretty_total_amount ||
    formatPeso(
      paymentDetails?.total_amount ?? bookingDetails?.total_amount ?? 0,
    );

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

  const resolvedVehicle =
    vehicle ?? getBookingVehicle(bookingDetails, riderDetails);

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
    const shareVehicle =
      resolvedVehicle ?? getBookingVehicle(bookingDetails, riderDetails);
    const plateNumber = shareVehicle?.plateNumber || 'N/A';
    const vehicleLine = shareVehicle?.label || 'N/A';
    const fare = paymentDetails?.total_amount || 0;

    const message =
      "🛵 I'm on a Pinoy Ride!\n\n" +
      `📍 Pickup: ${pickupAddress}\n` +
      `🏁 Dropoff: ${dropoffAddress}\n\n` +
      `🧑 Rider: ${riderName}\n` +
      `🏍️ Vehicle: ${vehicleLine}\n` +
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
        <View
          style={[
            styles.container,
            { paddingBottom: bottomSpace(bottomInset, 50) },
          ]}>
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Finding your rider...</Text>
          </View>
        </View>
      </View>
    );
  }

  const ekycDetails = riderDetails?.ekyc_details;

  const toggleExpanded = () => setExpanded(prev => !prev);
  const showTripDetails = confirmedBookingView && expanded;

  return (
    <View style={styles.overlay} onLayout={onLayout}>
      <View
        style={[
          styles.container,
          { paddingBottom: bottomSpace(bottomInset, 50) },
        ]}>
        {confirmedBookingView ? (
          <View
            style={styles.swipeHandleHit}
            {...swipeResponder.panHandlers}
            accessibilityRole="adjustable"
            accessibilityLabel="Trip details sheet">
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={toggleExpanded}
              accessibilityLabel={
                expanded ? 'Minimize trip details' : 'Show trip details'
              }
              style={styles.swipeHandleTouch}>
              <View style={styles.swipeMarker} />
              {!expanded && (
                <Text style={styles.expandHint}>▲ Show trip details</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {confirmedBookingView && showSafetyGuide ? (
          <TouchableOpacity
            testID="safety-guide-chip"
            style={styles.safetyChip}
            onPress={onSafetyGuidePress}>
            <Text style={styles.safetyChipText}>Safety Guide</Text>
          </TouchableOpacity>
        ) : null}

        {confirmedBookingView && statusBannerText ? (
          <View style={styles.statusBanner}>
            <Text style={styles.statusBannerText}>{statusBannerText}</Text>
          </View>
        ) : null}

        {/* Minimized: only the handle and the status line, so the map is clear. */}
        {(!confirmedBookingView || expanded) && (
          <>
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
              <Text style={styles.price}>{headerFareDisplay}</Text>
            </TouchableOpacity>

            {showTripDetails ? (
              <>
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
                        {dropoff?.description ||
                          bookingDetails?.dropoff_location}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.fareBreakdown}>
                  <View style={styles.fareRow}>
                    <Text
                      style={[
                        styles.feeText,
                        { fontFamily: 'Poppins SemiBold' },
                      ]}>
                      {finalFareLabel}
                    </Text>
                    <Text
                      style={[
                        styles.feeText,
                        { fontFamily: 'Poppins SemiBold' },
                      ]}>
                      {finalFareDisplay}
                    </Text>
                  </View>
                  <View style={styles.fareRow}>
                    <Text style={styles.feeText}>{totalFareLabel}</Text>
                    <Text style={styles.feeText}>{totalFareDisplay}</Text>
                  </View>
                  <View style={styles.fareRow}>
                    <Text style={styles.feeText}>Payment Method</Text>
                    <View style={styles.paymentMethodRow}>
                      <Image
                        source={paymentConfig.icon}
                        style={styles.paymentMethodIcon}
                      />
                      <Text style={styles.feeText}>{paymentConfig.label}</Text>
                    </View>
                  </View>
                </View>
              </>
            ) : null}

            <View style={styles.separator} />

            {/* Rider Info */}
            <View style={styles.riderRow}>
              {/* The rider's photo, else their vehicle's; a plain figure when
                  there is neither (no name is sent to an outside service). */}
              <ProfileAvatar
                uri={
                  getRiderPhoto(riderDetails) ||
                  riderDetails?.vehicle_details?.[0]?.motorcyle_img
                }
                size={50}
                style={styles.avatar}
              />

              <View style={{ flex: 1 }}>
                <Text style={styles.riderName}>
                  {ekycDetails?.first_name} {ekycDetails?.last_name}
                </Text>
                <Text style={styles.plate}>
                  {resolvedVehicle?.plateNumber || 'N/A'}
                </Text>
                <Text style={styles.vehicle}>
                  {resolvedVehicle?.label || 'N/A'}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.circleBtn}
                  onPress={handleMessage}>
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
          </>
        )}

        {(!confirmedBookingView || expanded) && (
          <AppButton
            title="Share Your Trip Details"
            onPress={handleShareTrip}
            mode="outlined"
            buttonColor={colors.primary}
            textColor={colors.primary}
            isBold
            noSpacing
          />
        )}
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
      paddingHorizontal: 20,
      paddingBottom: 50,
      paddingTop: 8,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      elevation: 10,
    },
    swipeHandleHit: {
      paddingVertical: 8,
      alignItems: 'center',
    },
    swipeHandleTouch: {
      paddingVertical: 4,
      paddingHorizontal: 40,
      alignItems: 'center',
    },
    expandHint: {
      marginTop: 6,
      fontSize: 12,
      color: '#084CF7',
      textAlign: 'center',
    },
    swipeMarker: {
      width: 48,
      height: 4,
      borderRadius: 2,
      backgroundColor: '#084CF7',
    },
    safetyChip: {
      alignSelf: 'flex-start',
      height: 26,
      paddingHorizontal: 10,
      borderRadius: 4,
      backgroundColor: '#084CF7',
      justifyContent: 'center',
      marginBottom: 10,
    },
    safetyChipText: {
      fontFamily: 'Poppins Medium',
      fontSize: 11,
      color: '#FFFFFF',
    },
    statusBanner: {
      minHeight: 51,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    statusBannerText: {
      fontFamily: 'Poppins Medium',
      fontWeight: '500',
      fontSize: 16,
      color: colors.onPrimary,
      textAlign: 'center',
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
    paymentMethodRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    paymentMethodIcon: {
      width: 18,
      height: 18,
      resizeMode: 'contain',
    },
  });
