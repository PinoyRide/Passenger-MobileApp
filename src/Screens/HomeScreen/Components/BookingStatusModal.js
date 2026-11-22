import { ProfileAvatar } from '@/Components';
import React, { useEffect, useRef, useState } from 'react';
import {
  Linking,
  PanResponder,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { selectUserInfo } from '@/Redux/Slices/userSlice';
import { Constants } from '@/Utils';
import usePostRequest from '@/Services/Api';
import { getBookingVehicle } from '@/Hooks/bookingVehicle';
import { getRiderPhoto } from '@/Hooks/bookingTransform';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomSpace } from '@/Utils/bottomSpace';
import { formatPeso } from '@/Utils/formatPeso';
import { modern } from '@/Theme/modern';
import FindingRider from './FindingRider';
import RiderProfileSheet from './RiderProfileSheet';

const UNREAD_POLL_INTERVAL_MS = 5000;

const PAYMENT_METHOD_CONFIG = {
  cash: { label: 'Cash' },
  wallet: { label: 'Wallet' },
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

// A place's first part: "SM Mall of Asia".
const placeName = (place, fallback) =>
  (place?.description || place?.address || fallback || '').split(',')[0].trim();

// The trip sheet once a rider has the booking (docs/booking-redesign-spec.md,
// "BookingStatusModal", and the design canvas): a headline ("Jomar is on the
// way" over the arrival time), the driver card, Call / Message / Share trip,
// the fare, and a quiet Cancel ride while the rider is on the way. Nothing the
// data lacks is shown: no pickup PIN. Tapping the driver card opens the
// rider's profile (RiderProfileSheet), which adds their rating. While the
// rider's details load, "Finding your rider". Once the rider has arrived, and
// during the trip, the sheet swipes down to its headline, as before.
const BookingStatusModal = ({
  onLayout,
  riderDetails,
  bookingDetails,
  bookingStatus,
  pickup,
  dropoff,
  vehicle,
  etaText = '',
  onCancelRide,
  statusBannerText = '',
  showSafetyGuide = false,
  onSafetyGuidePress,
  confirmedBookingView = false,
}) => {
  // The navigation bar may cover the bottom of the screen: keep the bottom content clear of it
  const { bottom: bottomInset } = useSafeAreaInsets();
  const theme = useTheme();
  const look = modern(theme);
  const styles = getStyles(look, theme.colors.blue ?? '#084CF7');
  const navigation = useNavigation();
  const userInfo = useSelector(selectUserInfo);
  const [expanded, setExpanded] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);

  // a new booking or a new rider starts with the profile closed
  useEffect(() => {
    setProfileOpen(false);
  }, [bookingDetails?.id, riderDetails?.id]);

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

  const sheetStyle = [
    styles.sheet,
    { paddingBottom: bottomSpace(bottomInset, 24, 24) },
  ];

  if (!riderDetails) {
    return (
      <View style={styles.overlay} onLayout={onLayout}>
        <View style={sheetStyle}>
          <View style={styles.handle} />
          <FindingRider />
        </View>
      </View>
    );
  }

  const ekycDetails = riderDetails?.ekyc_details;
  const firstName = ekycDetails?.first_name?.trim() || '';
  const lastInitial = ekycDetails?.last_name?.trim()?.[0];
  const shortName =
    [firstName, lastInitial && `${lastInitial}.`].filter(Boolean).join(' ') ||
    'Your rider';
  const phoneNumber = ekycDetails?.pretty_mobile_no;

  // "Jomar is on the way" over the arrival time while the rider comes; from
  // their arrival on, the status line the sheet has always shown.
  const onTheWay = Number(bookingStatus) === 1 && !confirmedBookingView;
  const headline = onTheWay
    ? `${firstName || 'Your rider'} is on the way`
    : statusBannerText;
  const caption = onTheWay ? etaText : '';

  const toggleExpanded = () => setExpanded(prev => !prev);
  const showTripDetails = confirmedBookingView && expanded;

  let fareCaption = '';
  if (showEstimatedFareLabels) {
    fareCaption = 'Estimated — final fare may change';
  } else if (paymentType === 'cash') {
    fareCaption = 'Hand the exact fare to your rider';
  }

  const actions = [
    {
      id: 'call',
      icon: 'phone-outline',
      label: 'Call',
      onPress: handleCall,
      disabled: !phoneNumber,
    },
    {
      id: 'message',
      icon: 'message-outline',
      label: 'Message',
      onPress: handleMessage,
      badge: unreadCount,
    },
    {
      id: 'share',
      icon: 'share-variant-outline',
      label: 'Share trip',
      onPress: handleShareTrip,
    },
  ];

  return (
    <View style={styles.overlay} onLayout={onLayout}>
      <View style={sheetStyle}>
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
              <View style={styles.handleBar} />
              {!expanded && (
                <Text style={styles.expandHint}>▲ Show trip details</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.handle} />
        )}

        {confirmedBookingView && showSafetyGuide ? (
          <TouchableOpacity
            testID="safety-guide-chip"
            style={styles.safetyChip}
            onPress={onSafetyGuidePress}>
            <Text style={styles.safetyChipText}>Safety Guide</Text>
          </TouchableOpacity>
        ) : null}

        {headline ? (
          <Text style={styles.title} maxFontSizeMultiplier={1.3}>
            {headline}
          </Text>
        ) : null}
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}

        {/* Minimized: only the handle and the status line, so the map is clear. */}
        {(!confirmedBookingView || expanded) && (
          <View style={styles.stack}>
            {/* the driver: photo (else the vehicle's, else a plain figure;
                no name goes to an outside service), name, vehicle, plate.
                Tapping it opens the rider's profile. */}
            <Pressable
              onPress={() => setProfileOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={[
                shortName,
                resolvedVehicle?.label,
                resolvedVehicle?.plateNumber &&
                  `plate ${resolvedVehicle.plateNumber}`,
              ]
                .filter(Boolean)
                .join(', ')}
              accessibilityHint="Opens the rider's profile"
              style={({ pressed }) => [
                styles.driverCard,
                pressed && styles.pressed,
              ]}>
              <ProfileAvatar
                uri={
                  getRiderPhoto(riderDetails) ||
                  riderDetails?.vehicle_details?.[0]?.motorcyle_img
                }
                size={54}
              />
              <View style={styles.flex}>
                <Text style={styles.driverName} numberOfLines={1}>
                  {shortName}
                </Text>
                {resolvedVehicle?.label ? (
                  <Text style={styles.driverMeta} numberOfLines={1}>
                    {resolvedVehicle.label}
                  </Text>
                ) : null}
              </View>
              {resolvedVehicle?.plateNumber ? (
                <View style={styles.plate}>
                  <Text style={styles.plateText}>
                    {resolvedVehicle.plateNumber}
                  </Text>
                </View>
              ) : null}
              <Icon
                name="chevron-right"
                size={20}
                color={look.muted}
                style={styles.chevron}
              />
            </Pressable>

            <View style={styles.actionRow}>
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
                    action.disabled && styles.actionDisabled,
                    pressed && styles.pressed,
                  ]}>
                  <Icon name={action.icon} size={20} color={look.ink} />
                  <Text style={styles.actionText}>{action.label}</Text>
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

            {showTripDetails ? (
              <View style={styles.routeLine}>
                <View style={styles.dot} />
                <Text style={styles.routeName} numberOfLines={1}>
                  {placeName(pickup, bookingDetails?.pickup_location)}
                </Text>
                <Icon
                  name="arrow-right"
                  size={15}
                  color={look.muted}
                  style={styles.routeArrow}
                />
                <View style={styles.square} />
                <Text style={styles.routeName} numberOfLines={1}>
                  {placeName(dropoff, bookingDetails?.dropoff_location)}
                </Text>
              </View>
            ) : null}

            <View style={styles.fareRow}>
              <View style={styles.flex}>
                <Text style={styles.fareLabel}>
                  {`Pay with ${paymentConfig.label.toLowerCase()}`}
                </Text>
                {fareCaption ? (
                  <Text style={styles.fareCaption}>{fareCaption}</Text>
                ) : null}
              </View>
              <Text style={styles.fareFigure} maxFontSizeMultiplier={1.3}>
                {headerFareDisplay}
              </Text>
            </View>

            {/* Weaker than the button that booked it: cancelling should take
                more intent than confirming did. */}
            {onCancelRide ? (
              <Pressable
                onPress={onCancelRide}
                hitSlop={8}
                accessibilityRole="button"
                style={styles.cancelLink}>
                <Text style={styles.cancelText}>Cancel ride</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>

      <RiderProfileSheet
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
        riderDetails={riderDetails}
        bookingDetails={bookingDetails}
        vehicle={resolvedVehicle}
        customerId={userInfo?.id}
      />
    </View>
  );
};

export default BookingStatusModal;

const getStyles = (look, blue) =>
  StyleSheet.create({
    overlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'transparent',
    },
    sheet: {
      backgroundColor: look.surface,
      borderTopLeftRadius: look.radiusSheet,
      borderTopRightRadius: look.radiusSheet,
      paddingHorizontal: 20,
      paddingTop: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -10 },
      shadowOpacity: 0.13,
      shadowRadius: 22,
      elevation: 16,
    },
    handle: {
      alignSelf: 'center',
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: look.hairline,
      marginBottom: 14,
    },
    swipeHandleHit: {
      alignItems: 'center',
      marginBottom: 6,
    },
    swipeHandleTouch: {
      paddingBottom: 8,
      paddingHorizontal: 40,
      alignItems: 'center',
    },
    handleBar: {
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: look.hairline,
    },
    expandHint: {
      marginTop: 6,
      fontFamily: 'Poppins Medium',
      fontSize: 12,
      lineHeight: 16,
      color: look.muted,
      textAlign: 'center',
    },
    safetyChip: {
      alignSelf: 'flex-start',
      height: 26,
      paddingHorizontal: 10,
      borderRadius: 4,
      backgroundColor: blue,
      justifyContent: 'center',
      marginBottom: 10,
    },
    safetyChipText: {
      fontFamily: 'Poppins Medium',
      fontSize: 11,
      color: '#FFFFFF',
    },
    // Title role
    title: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 22,
      lineHeight: 27,
      letterSpacing: -0.5,
      color: look.ink,
    },
    caption: {
      marginTop: 2,
      fontFamily: 'Poppins Regular',
      fontSize: 13,
      lineHeight: 18,
      color: look.muted,
    },
    stack: {
      marginTop: 16,
      gap: 12,
    },
    flex: {
      flex: 1,
    },
    pressed: {
      opacity: 0.85,
    },
    driverCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: look.radiusCard,
      backgroundColor: look.soft,
    },
    driverName: {
      fontFamily: 'Poppins Medium',
      fontSize: 15,
      lineHeight: 20,
      letterSpacing: -0.2,
      color: look.ink,
    },
    // inkSoft, not muted, on `soft`
    driverMeta: {
      fontFamily: 'Poppins Regular',
      fontSize: 13,
      lineHeight: 18,
      color: look.inkSoft,
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
    chevron: {
      marginLeft: -6,
      marginRight: -4,
    },
    actionRow: {
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
    actionDisabled: {
      opacity: 0.5,
    },
    actionText: {
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
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: blue,
    },
    square: {
      width: 10,
      height: 10,
      borderRadius: 2,
      backgroundColor: look.ink,
    },
    routeLine: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 32,
    },
    routeName: {
      flexShrink: 1,
      marginLeft: 8,
      fontFamily: 'Poppins Medium',
      fontSize: 13,
      lineHeight: 18,
      color: look.ink,
    },
    routeArrow: {
      marginHorizontal: 8,
    },
    fareRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingTop: 4,
    },
    fareLabel: {
      fontFamily: 'Poppins Medium',
      fontSize: 15,
      lineHeight: 20,
      letterSpacing: -0.2,
      color: look.ink,
    },
    fareCaption: {
      fontFamily: 'Poppins Regular',
      fontSize: 13,
      lineHeight: 18,
      color: look.muted,
    },
    // Fare role
    fareFigure: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 23,
      lineHeight: 28,
      letterSpacing: -0.7,
      color: look.ink,
    },
    cancelLink: {
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelText: {
      fontFamily: 'Poppins Medium',
      fontSize: 14,
      lineHeight: 20,
      color: look.muted,
    },
  });
