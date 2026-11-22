import React, { useEffect, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import Container from '@/Components/Container/Container';
import ProfileAvatar from '@/Components/ProfileAvatar/ProfileAvatar';
import { addRatedBookingId, clearBookingState } from '@/Redux/Slices/userSlice';
import { AlertBox, AppButton, AppTextInput } from '@/Components';
import { Constants } from '@/Utils';
import usePostRequest from '@/Services/Api';
import {
  bookingKey,
  getRiderPhoto,
  transformBooking,
} from '@/Hooks/bookingTransform';
import { getBookingVehicle } from '@/Hooks/bookingVehicle';
import { formatPeso } from '@/Utils/formatPeso';
import { modern } from '@/Theme/modern';

const SUPPORT_NUMBER = '09770368299';

// What each number of stars means, said under them.
const RATING_WORDS = ['', 'Bad', 'Poor', 'Okay', 'Good', 'Great'];

const PAYMENT = {
  cash: { label: 'Cash', icon: 'cash' },
  wallet: { label: 'Wallet', icon: 'wallet-outline' },
};

const parseJson = value => {
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

// A place's first part: "Makati Square".
const placeName = text =>
  String(text || '')
    .split(',')[0]
    .trim();

// A distance as the apps say it: "450 m", "2.4 km".
const distanceText = meters =>
  meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(1).replace(/\.0$/, '')} km`;

// After a trip: how it went with the rider, in the shared look (the owner,
// 2026-11-23: "the how was your ride section also lacks styling, align the
// styling or UI"). The rider, five stars and a word for them, an optional
// compliment, then the trip: its route, fare and how it was paid, and where it
// ended when that was away from the drop-off. Submit, or close to skip.
const RatingScreen = () => {
  const look = modern(useTheme());
  const styles = getStyles(look);
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();

  const booking = route?.params?.bookingDetails || {};
  const paymentDetails = parseJson(booking.payment_details);
  const rider = booking.rider_details || {};
  const firstName = rider?.ekyc_details?.first_name?.trim() || '';
  const lastName = rider?.ekyc_details?.last_name?.trim() || '';
  const vehicle = getBookingVehicle(booking, rider);
  const payment =
    PAYMENT[
      String(
        paymentDetails?.type || booking.payment_type || 'cash',
      ).toLowerCase()
    ] || PAYMENT.cash;
  const fare = paymentDetails?.total_amount ?? booking.total_amount;
  const endedAway =
    booking.ended_away && Number.isFinite(Number(booking.end_distance_m));

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [showAlert, setShowAlert] = useState(false);

  const rateBooking = usePostRequest();

  // Remember this trip as rated/skipped, then drop the saved booking. Home
  // keeps the completed booking saved until here so a reload re-prompts.
  const finishRating = () => {
    dispatch(
      addRatedBookingId(
        booking?.id != null ? bookingKey(booking) : paymentDetails?.booking_id,
      ),
    );
    dispatch(clearBookingState());
  };

  const goHome = () => {
    finishRating();
    navigation.reset({
      index: 0,
      routes: [{ name: 'HomeScreen' }],
    });
  };

  const handleSubmit = () => {
    rateBooking.makePostRequest(Constants.ENDPOINT.RATE_BOOKING, {
      booking_id: paymentDetails?.booking_id ?? booking?.id,
      rate: rating,
      compliment: comment,
    });
  };

  const handleContactSupport = () => {
    Linking.openURL(
      Platform.OS === 'android' ? `tel:${SUPPORT_NUMBER}` : 'telprompt:',
    );
  };

  const handleViewDetails = () => {
    if (!booking?.id) {
      return;
    }
    navigation.navigate('BookingDetailsScreen', {
      bookingDetails: transformBooking(booking),
    });
  };

  useEffect(() => {
    if (rateBooking.error) {
      setAlertMessage(rateBooking.error);
      setShowAlert(true);
      return;
    }
    if (rateBooking.response) {
      goHome();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rateBooking.response, rateBooking.error]);

  return (
    <>
      {alertMessage ? (
        <AlertBox
          title="Error"
          message={alertMessage}
          visible={showAlert}
          setVisible={setShowAlert}
        />
      ) : null}
      <Container style={styles.page} background={look.page}>
        <View style={styles.top}>
          <Pressable
            onPress={goHome}
            hitSlop={8}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel="Close without rating">
            <Icon name="close" size={24} color={look.ink} />
          </Pressable>
          <Pressable
            onPress={handleContactSupport}
            hitSlop={8}
            accessibilityRole="button">
            <Text style={styles.support}>Contact support</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.rider}>
            <ProfileAvatar
              uri={getRiderPhoto(rider)}
              name={`${firstName} ${lastName}`.trim() || undefined}
              size={72}
            />
            <Text style={styles.title} accessibilityRole="header">
              {firstName
                ? `How was your ride with ${firstName}?`
                : 'How was your ride?'}
            </Text>
            {vehicle?.label || vehicle?.plateNumber ? (
              <Text style={styles.vehicle} numberOfLines={1}>
                {[vehicle?.label, vehicle?.plateNumber]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            ) : null}
          </View>

          <View style={styles.stars} accessibilityRole="adjustable">
            {[1, 2, 3, 4, 5].map(star => (
              <Pressable
                key={star}
                onPress={() => setRating(star)}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityLabel={`${star} ${star === 1 ? 'star' : 'stars'}`}
                accessibilityState={{ selected: rating === star }}>
                <Icon
                  name="star"
                  size={42}
                  color={rating >= star ? look.gold : look.tile}
                />
              </Pressable>
            ))}
          </View>
          <Text style={styles.ratingWord}>{RATING_WORDS[rating]}</Text>

          <AppTextInput
            placeholder={
              rating >= 4
                ? 'Add a compliment (optional)'
                : 'What could have been better? (optional)'
            }
            value={comment}
            onChangeText={setComment}
            inputMode="comment"
          />

          <View style={styles.trip}>
            <View style={styles.routeLine}>
              <View style={styles.dot} />
              <Text style={styles.routeName} numberOfLines={1}>
                {placeName(booking.pickup_location) || 'Pick-up'}
              </Text>
              <Icon
                name="arrow-right"
                size={15}
                color={look.muted}
                style={styles.routeArrow}
              />
              <View style={styles.square} />
              <Text style={styles.routeName} numberOfLines={1}>
                {placeName(booking.dropoff_location) || 'Drop-off'}
              </Text>
            </View>
            <View style={styles.hairline} />
            <View style={styles.line}>
              <Text style={styles.lineLabel}>Total fare</Text>
              <Text style={styles.fare}>
                {fare == null || fare === '' ? '—' : formatPeso(fare)}
              </Text>
            </View>
            <View style={styles.line}>
              <Text style={styles.lineLabel}>Paid with</Text>
              <View style={styles.paid}>
                <Icon name={payment.icon} size={18} color={look.inkSoft} />
                <Text style={styles.lineValue}>{payment.label}</Text>
              </View>
            </View>
            {endedAway ? (
              <View style={styles.away}>
                <Icon
                  name="map-marker-alert-outline"
                  size={18}
                  color={look.inkSoft}
                />
                <Text style={styles.awayText}>
                  {`Your trip ended ${distanceText(
                    Number(booking.end_distance_m),
                  )} from your drop-off. Not right? Contact support.`}
                </Text>
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <AppButton
            title="Submit"
            onPress={handleSubmit}
            disabled={rateBooking.loading}
            isBold
            mode="contained"
          />
          {booking?.id ? (
            <Pressable
              onPress={handleViewDetails}
              hitSlop={8}
              style={styles.details}
              accessibilityRole="button">
              <Text style={styles.detailsText}>View trip details</Text>
            </Pressable>
          ) : null}
        </View>
      </Container>
    </>
  );
};

export default RatingScreen;

const getStyles = look =>
  StyleSheet.create({
    page: {
      flex: 1,
      paddingHorizontal: 20,
    },
    flex: {
      flex: 1,
    },
    top: {
      height: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    close: {
      width: 44,
      height: 44,
      marginLeft: -10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    support: {
      fontFamily: 'Poppins Medium',
      fontSize: 14,
      lineHeight: 20,
      color: look.link,
    },
    body: {
      paddingTop: 8,
      paddingBottom: 16,
    },
    rider: {
      alignItems: 'center',
    },
    title: {
      marginTop: 14,
      fontFamily: 'Poppins SemiBold',
      fontSize: 22,
      lineHeight: 28,
      letterSpacing: -0.5,
      color: look.ink,
      textAlign: 'center',
    },
    vehicle: {
      marginTop: 2,
      fontFamily: 'Poppins Regular',
      fontSize: 13,
      lineHeight: 18,
      color: look.muted,
    },
    stars: {
      marginTop: 22,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
    },
    ratingWord: {
      marginTop: 4,
      marginBottom: 18,
      fontFamily: 'Poppins Medium',
      fontSize: 15,
      lineHeight: 20,
      color: look.inkSoft,
      textAlign: 'center',
    },
    trip: {
      marginTop: 18,
      padding: 16,
      gap: 10,
      borderRadius: look.radiusCard,
      backgroundColor: look.card,
      borderWidth: 1,
      borderColor: look.hairline,
    },
    routeLine: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: look.link,
    },
    square: {
      width: 10,
      height: 10,
      borderRadius: 2,
      backgroundColor: look.ink,
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
    hairline: {
      height: 1,
      backgroundColor: look.hairline,
    },
    line: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    lineLabel: {
      fontFamily: 'Poppins Regular',
      fontSize: 14,
      lineHeight: 20,
      color: look.muted,
    },
    fare: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 18,
      lineHeight: 24,
      letterSpacing: -0.3,
      color: look.ink,
    },
    paid: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    lineValue: {
      fontFamily: 'Poppins Medium',
      fontSize: 14,
      lineHeight: 20,
      color: look.ink,
    },
    away: {
      flexDirection: 'row',
      gap: 8,
      paddingTop: 2,
    },
    awayText: {
      flex: 1,
      fontFamily: 'Poppins Regular',
      fontSize: 13,
      lineHeight: 18,
      color: look.inkSoft,
    },
    footer: {
      paddingTop: 8,
      paddingBottom: 8,
    },
    details: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailsText: {
      fontFamily: 'Poppins Medium',
      fontSize: 14,
      lineHeight: 20,
      color: look.inkSoft,
    },
  });
