import React, { useEffect, useRef, useState } from 'react';
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
import AlertBox from '@/Components/AlertBox/AlertBox';
import AppButton from '@/Components/AppButton/AppButton';
import AppTextInput from '@/Components/AppTextInput/AppTextInput';
import ReportIssueModal from '@/Screens/BookingHistoryScreen/Components/ReportIssueModal';
import useAutoClose from '@/Hooks/useAutoClose';
import { Constants } from '@/Utils';
import usePostRequest from '@/Services/Api';
import {
  bookingKey,
  getRiderPhoto,
  transformBooking,
} from '@/Hooks/bookingTransform';
import { getBookingVehicle } from '@/Hooks/bookingVehicle';
import { formatPeso } from '@/Utils/formatPeso';
import {
  RATING_WORDS,
  canSubmit,
  endedAwayNotice,
  feedbackText,
  placeName,
  rideQuestion,
  tagsFor,
} from '@/Utils/ratingPage';
import { modern } from '@/Theme/modern';

const SUPPORT_NUMBER = '09770368299';

const PAYMENT = { cash: 'Cash', wallet: 'Wallet' };

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

// After a trip, as the owner's design draws it (2026-11-23, "make this"): the
// rider, five empty stars, then the trip (route, fare, how it was paid, and a
// notice with Report when it ended away from the drop-off). Submit rating
// waits for a star; a compliment can be added once one is chosen. Close skips.
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
  const vehicleLine = [vehicle?.label, vehicle?.plateNumber]
    .filter(Boolean)
    .join(' · ');
  const payment =
    PAYMENT[
      String(
        paymentDetails?.type || booking.payment_type || 'cash',
      ).toLowerCase()
    ] || PAYMENT.cash;
  const fare = paymentDetails?.total_amount ?? booking.total_amount;
  const bookingId = paymentDetails?.booking_id ?? booking?.id;
  const notice = endedAwayNotice(booking);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [tags, setTags] = useState([]);
  const asked = tagsFor(rating);
  const [alert, setAlert] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [reported, setReported] = useState(false);

  const rateBooking = usePostRequest();
  const reportIssue = usePostRequest();
  const ready = canSubmit(rating, rateBooking.loading);

  useAutoClose(!!alert, () => setAlert(null));

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

  // One rating per press: two quick taps both got past the loading state
  // and saved two ratings (overnight review 2026-11-23). Let go only when
  // the rating did not go through, so it can be sent again.
  const submittingRef = useRef(false);
  const handleSubmit = async () => {
    if (!ready || submittingRef.current) {
      return;
    }
    submittingRef.current = true;
    let sent = false;
    try {
      const result = await rateBooking.makePostRequest(
        Constants.ENDPOINT.RATE_BOOKING,
        {
          booking_id: bookingId,
          rate: rating,
          compliment: feedbackText(tags, comment),
        },
      );
      sent = Boolean(result?.response) && !result?.error;
    } finally {
      if (!sent) {
        submittingRef.current = false;
      }
    }
  };

  // The trip's end in booking_issues, where the fare is reviewed
  const handleReport = message => {
    reportIssue.makePostRequest(Constants.ENDPOINT.REPORT_AN_ISSUE, {
      booking_id: bookingId,
      issue: message,
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
      setAlert({ title: 'Error', message: rateBooking.error });
      return;
    }
    if (rateBooking.response) {
      goHome();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rateBooking.response, rateBooking.error]);

  useEffect(() => {
    if (reportIssue.error) {
      setShowReport(false);
      setAlert({ title: 'Error', message: reportIssue.error });
      return;
    }
    if (reportIssue.response) {
      setShowReport(false);
      setReported(true);
      setAlert({
        title: 'Report sent',
        message: 'Thank you. We will review the fare for this trip.',
      });
    }
  }, [reportIssue.response, reportIssue.error]);

  return (
    <>
      {alert ? (
        <AlertBox
          title={alert.title}
          message={alert.message}
          visible
          setVisible={visible => {
            if (!visible) {
              setAlert(null);
            }
          }}
        />
      ) : null}
      <ReportIssueModal
        visible={showReport}
        onClose={() => setShowReport(false)}
        onSubmit={handleReport}
        loading={reportIssue.loading}
        initialMessage={notice?.report}
      />
      <Container style={styles.page} background={look.surface}>
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
              size={76}
            />
            <Text style={styles.title} accessibilityRole="header">
              {rideQuestion(firstName)}
            </Text>
            {vehicleLine ? (
              <Text style={styles.vehicle} numberOfLines={1}>
                {vehicleLine}
              </Text>
            ) : null}
          </View>

          <View style={styles.stars} accessibilityRole="adjustable">
            {[1, 2, 3, 4, 5].map(star => (
              <Pressable
                key={star}
                onPress={() => {
                  // praise and problems are different tags: crossing 3/4 drops
                  // the ones picked
                  if (tagsFor(star).ask !== asked.ask) {
                    setTags([]);
                  }
                  setRating(star);
                }}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`${star} ${star === 1 ? 'star' : 'stars'}`}
                accessibilityState={{ selected: rating === star }}>
                <Icon
                  name={rating >= star ? 'star' : 'star-outline'}
                  size={40}
                  color={rating >= star ? look.gold : look.faint}
                />
              </Pressable>
            ))}
          </View>

          {rating > 0 ? (
            <View style={styles.said}>
              <Text style={styles.ratingWord}>{RATING_WORDS[rating]}</Text>
              <Text style={styles.ask}>{asked.ask}</Text>
              <View style={styles.tags}>
                {asked.tags.map(tag => {
                  const on = tags.includes(tag);
                  return (
                    <Pressable
                      key={tag}
                      onPress={() =>
                        setTags(picked =>
                          on ? picked.filter(t => t !== tag) : [...picked, tag],
                        )
                      }
                      style={[styles.tag, on && styles.tagOn]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}>
                      <Text style={[styles.tagText, on && styles.tagTextOn]}>
                        {tag}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <AppTextInput
                placeholder="Anything else? (optional)"
                // one line high, growing as it is typed: the trip and its
                // fare notice stay in view under the tags
                inputStyle={styles.note}
                grow
                value={comment}
                onChangeText={setComment}
                inputMode="comment"
              />
            </View>
          ) : null}

          <View style={styles.spacer} />

          <View style={styles.trip}>
            <View style={styles.routeLine}>
              <View style={styles.dot} />
              <Text style={styles.routeName} numberOfLines={1}>
                {placeName(booking.pickup_location) || 'Pick-up'}
              </Text>
              <Icon
                name="arrow-right"
                size={15}
                color={look.faint}
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
              <Text style={styles.lineValue}>{payment}</Text>
            </View>
            {notice ? (
              <View style={styles.notice}>
                <Icon
                  name="alert-circle-outline"
                  size={18}
                  color={look.red}
                  style={styles.noticeIcon}
                />
                <View style={styles.flex}>
                  <Text style={styles.noticeTitle}>{notice.title}</Text>
                  <Text style={styles.noticeBody}>{notice.body}</Text>
                </View>
                {reported ? (
                  <Text style={styles.reported}>Sent</Text>
                ) : (
                  <Pressable
                    onPress={() => setShowReport(true)}
                    hitSlop={10}
                    style={styles.report}
                    accessibilityRole="button"
                    accessibilityLabel="Report where the trip ended">
                    <Text style={styles.reportText}>Report</Text>
                  </Pressable>
                )}
              </View>
            ) : null}
          </View>

          <View style={styles.spacer} />
        </ScrollView>

        <View style={styles.footer}>
          <AppButton
            title="Submit rating"
            onPress={handleSubmit}
            disabled={!ready}
            isBold
            noSpacing
            mode="contained"
            textColor={ready ? undefined : look.faint}
            featureStyle={ready ? undefined : styles.submitOff}
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
    // Container keeps 20 at each side, as the design does
    page: {
      flex: 1,
      paddingHorizontal: 0,
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
      fontFamily: 'Poppins SemiBold',
      fontSize: 15,
      lineHeight: 20,
      color: look.link,
    },
    // the rider at the top, the trip low, Submit pinned under: the room
    // between them shared out (spacer), scrolling only on a short screen
    body: {
      flexGrow: 1,
      paddingTop: 4,
      paddingBottom: 12,
    },
    rider: {
      alignItems: 'center',
    },
    title: {
      marginTop: 18,
      fontFamily: 'Poppins SemiBold',
      fontSize: 22,
      lineHeight: 28,
      letterSpacing: -0.5,
      color: look.ink,
      textAlign: 'center',
    },
    vehicle: {
      marginTop: 4,
      fontFamily: 'Poppins Regular',
      fontSize: 13,
      lineHeight: 18,
      color: look.muted,
    },
    stars: {
      marginTop: 26,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 16,
    },
    said: {
      marginTop: 8,
    },
    ask: {
      marginBottom: 10,
      fontFamily: 'Poppins Regular',
      fontSize: 13,
      lineHeight: 18,
      color: look.muted,
      textAlign: 'center',
    },
    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 4,
    },
    tag: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: look.radiusPill,
      borderWidth: 1,
      borderColor: look.hairline,
      backgroundColor: look.soft,
    },
    tagOn: {
      borderColor: look.accent,
      backgroundColor: look.chip,
    },
    tagText: {
      fontFamily: 'Poppins Medium',
      fontSize: 13,
      lineHeight: 18,
      color: look.inkSoft,
    },
    tagTextOn: {
      color: look.chipInk,
    },
    ratingWord: {
      marginBottom: 2,
      fontFamily: 'Poppins Medium',
      fontSize: 15,
      lineHeight: 20,
      color: look.inkSoft,
      textAlign: 'center',
    },
    spacer: {
      flex: 1,
      minHeight: 16,
    },
    note: {
      minHeight: 52,
    },
    trip: {
      padding: 16,
      gap: 12,
      borderRadius: look.radiusCard,
      backgroundColor: look.soft,
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
      fontFamily: 'Poppins SemiBold',
      fontSize: 14,
      lineHeight: 20,
      color: look.ink,
    },
    routeArrow: {
      marginHorizontal: 10,
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
      color: look.inkSoft,
    },
    fare: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 16,
      lineHeight: 22,
      letterSpacing: -0.2,
      color: look.ink,
    },
    lineValue: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 14,
      lineHeight: 20,
      color: look.ink,
    },
    notice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 2,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: look.radiusTile - 2,
      backgroundColor: look.redSoft,
    },
    noticeIcon: {
      alignSelf: 'flex-start',
      marginTop: 1,
    },
    noticeTitle: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 13,
      lineHeight: 19,
      color: look.red,
    },
    noticeBody: {
      marginTop: 2,
      fontFamily: 'Poppins Regular',
      fontSize: 12,
      lineHeight: 18,
      color: look.inkSoft,
    },
    report: {
      paddingLeft: 4,
    },
    reportText: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 13,
      lineHeight: 19,
      color: look.red,
    },
    reported: {
      paddingLeft: 4,
      fontFamily: 'Poppins Medium',
      fontSize: 13,
      lineHeight: 19,
      color: look.muted,
    },
    footer: {
      paddingTop: 8,
      paddingBottom: 4,
    },
    // the design's quiet button until a star is chosen
    submitOff: {
      opacity: 1,
      backgroundColor: look.tile,
    },
    details: {
      minHeight: 44,
      marginTop: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailsText: {
      fontFamily: 'Poppins Medium',
      fontSize: 14,
      lineHeight: 20,
      color: look.muted,
    },
  });
