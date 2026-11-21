import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { openSettings } from 'react-native-permissions';
import BottomModal from './BottomModal';
import {
  PUSH_BOOKING_UPDATE_EVENT,
  PUSH_TYPES,
} from '@/Services/Push/pushEvents';
import {
  AdvanceBookingAcceptedModal,
  AlertBox,
  AppMap,
  RiderFoundAlertBox,
  SuccessAlertBox,
} from '@/Components';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import {
  addAcknowledgedScheduledId,
  addMinimizedAdvanceBookingId,
  clearAcknowledgedScheduledForBooking,
  clearBookingState,
  parkAdvanceBooking,
  removeMinimizedAdvanceBookingId,
  removeParkedAdvanceBooking,
  replaceBookingId,
  selectAcknowledgedScheduledIds,
  selectActiveBooking,
  selectBookingStatus,
  selectDropoffLocation,
  selectHasShownLoginSuccess,
  selectInquireBookingResponse,
  selectIsBooked,
  selectIsConfirmed,
  selectMinimizedAdvanceBookingIds,
  selectParkedAdvanceBookings,
  selectPickupLocation,
  selectRatedBookingIds,
  selectRiderDetails,
  selectSelectedService,
  selectUserInfo,
  setActiveBooking,
  setBookingStatus,
  setDropoffLocation,
  setHasShownLoginSuccess,
  setInquireBookingResponse,
  setIsBooked,
  setIsConfirmed,
  setPickupLocation,
  setRiderDetails,
  setSelectedService,
} from '@/Redux/Slices/userSlice';
import { AppUtil, Constants } from '@/Utils';
import usePostRequest from '@/Services/Api';
import ServiceModal from './Components/ServiceModal';
import PaymentMethodModal from './Components/PaymentMethodModal';
import BookingStatusModal from './Components/BookingStatusModal';
import NoteToRiderModal from './Components/NoteToRiderModal';
import PromoModal from './Components/PromoModal';
import { ensureLocationPermission } from '@/Utils/Permissions';
import { useLocationWatch } from '@/Hooks/useLocation';
import useNetworkStatus from '@/Hooks/useNetworkStatus';
import { checkIsOnline } from '@/Utils/Network';
import { getBookingVehicle } from '@/Hooks/bookingVehicle';
import { getRiderEtaText } from '@/Hooks/riderEta';
import { getDropoffEtaText, keepDropoffEta } from '@/Utils/dropoffEta';
import useBookLaterConfig from '@/Hooks/useBookLaterConfig';
import {
  formatScheduledDateLabel,
  formatScheduledTimeLabel,
  shortenAddress,
} from '@/Hooks/bookLaterFormat';
import PickDateModal from './Components/PickDateModal';
import ChoosePickupPanel from './Components/ChoosePickupPanel';
import NoRidersAvailableModal from '@/Components/AlertBox/NoRidersAvailableModal';
import CancelPenaltyModal from '@/Components/AlertBox/CancelPenaltyModal';
import {
  cancelPreviewOutcome,
  cancelRoute,
  cancelYesAction,
  instantCancelPreview,
  updateStatusCancelOutcome,
  useCancellationSubmitGuard,
} from '@/Utils/cancellationDialog';
import SafetyGuideModal from '@/Components/SafetyGuide/SafetyGuideModal';
import EmergencyButton from '@/Components/EmergencyButton';
import {
  advanceAcceptedAckKey,
  bookingKey,
  getAssignedRiderId,
  getReplacementId,
  isAdvanceAcceptedAcknowledged,
  isReturnedToPool,
  shouldShowRiderFoundAlert,
  transformBooking,
} from '@/Hooks/bookingTransform';
import { services as SERVICE_OPTIONS } from './Components/ServiceModal';
import useNoRidersTimer from '@/Hooks/useNoRidersTimer';
import useRiderEtaPoll from '@/Hooks/useRiderEtaPoll';
import useRiderLocationPoll from '@/Hooks/useRiderLocationPoll';
import useAdvanceBookingDiscovery from '@/Hooks/useAdvanceBookingDiscovery';
import useParkedAdvanceBookingPoll from '@/Hooks/useParkedAdvanceBookingPoll';

// Matches backend ADVANCE_MAX_OPEN_PER_CUSTOMER.
const ADVANCE_MAX_OPEN = 3;
const OFFLINE_ALERT_TITLE = 'No Internet Connection';
const OFFLINE_ALERT_MESSAGE =
  'This action needs an internet connection. Please reconnect and try again.';

const FARE_UNAVAILABLE_MESSAGE = 'Unable to compute fare. Please try again.';

// A rider holds the booking: rider_assigned, or a non-empty rider object
// (the backend sends rider_details: {} when there is no rider).
const hasRider = (booking, rd) =>
  booking?.rider_assigned === true ||
  Boolean(rd && typeof rd === 'object' && (rd.id || Object.keys(rd).length));

const HomeScreen = () => {
  const { colors } = useTheme();
  const styles = getStyles({ colors });
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();

  // ✅ Use Redux selectors instead of local state
  const userInfo = useSelector(selectUserInfo);
  const hasShownLoginSuccess = useSelector(selectHasShownLoginSuccess);
  const activeBooking = useSelector(selectActiveBooking);
  const ratedBookingIds = useSelector(selectRatedBookingIds);
  const bookingStatus = useSelector(selectBookingStatus);
  const riderDetails = useSelector(selectRiderDetails);
  const pickupLocation = useSelector(selectPickupLocation);
  const dropoffLocation = useSelector(selectDropoffLocation);
  const selectedService = useSelector(selectSelectedService);
  const isBooked = useSelector(selectIsBooked);
  const isConfirmed = useSelector(selectIsConfirmed);
  const inquireBookingResponse = useSelector(selectInquireBookingResponse);
  const acknowledgedScheduledIds = useSelector(selectAcknowledgedScheduledIds);
  const minimizedAdvanceBookingIds = useSelector(
    selectMinimizedAdvanceBookingIds,
  );
  const parkedAdvanceBookings = useSelector(selectParkedAdvanceBookings);

  const bookLater = useBookLaterConfig();

  const [alertMessage, setAlertMessage] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const [modalHeight, setModalHeight] = useState(0);
  // Push-notification tap target ({ id, type }) waiting for its get_details
  // reply, plus the notice shown when that booking is stale/gone.
  const pushTargetRef = useRef(null);
  // true while that reply is still expected (request timeout is 15s)
  const pushTargetPending = () =>
    Boolean(pushTargetRef.current) &&
    Date.now() - pushTargetRef.current.at < 20000;
  const [pushNotice, setPushNotice] = useState(null);
  const [showPushNotice, setShowPushNotice] = useState(false);

  // ✅ NEW: live connectivity flag used to gate actions and show a banner
  const isOnline = useNetworkStatus();
  const wasOnlineRef = useRef(isOnline);

  // Use location watch hook for real-time location updates
  const {
    location: userLocation,
    error: locationError,
    permissionStatus,
    startWatching,
    stopWatching,
  } = useLocationWatch(true);

  // Default location (Manila)
  const defaultLocation = {
    latitude: 14.5995,
    longitude: 120.9842,
  };

  const currentLocation = userLocation || defaultLocation;
  const locationReady = permissionStatus === 'granted';

  const [showSuccess, setShowSuccess] = useState(false);
  const [showRiderFound, setShowRiderFound] = useState(false);
  const riderAlertShownRef = useRef(false);
  const [showServiceModal, setShowServiceModal] = useState(false);

  // Modal states (not persisted)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);

  // Selection states (not persisted)
  const [selectedPayment, setSelectedPayment] = useState('cash');
  const [selectedPromo, setSelectedPromo] = useState(null);
  const [noteToRider, setNoteToRider] = useState('');

  // Promo state
  const [availablePromos, setAvailablePromos] = useState([]);

  // 🆕 Rider real-time location state (transient, not persisted in Redux)
  const [riderLocation, setRiderLocation] = useState(null);
  // When the fast rider-location poll last delivered a fix (see useRiderLocationPoll).
  const lastFastFixAtRef = useRef(0);
  const [bookingVehicle, setBookingVehicle] = useState(null);
  const [riderEta, setRiderEta] = useState(null);
  const [riderEtaReceivedAt, setRiderEtaReceivedAt] = useState(0);
  const [etaStaleTick, setEtaStaleTick] = useState(0);

  const [scheduledAt, setScheduledAt] = useState(null);
  const [autoBookAfterSchedule, setAutoBookAfterSchedule] = useState(false);
  const [showPickDate, setShowPickDate] = useState(false);
  const [advanceBookingFlow, setAdvanceBookingFlow] = useState(false);
  // Advance: a pickup was (re)chosen and still needs "Choose this pick up",
  // even when the date is already set (date-first order).
  const [pickupConfirmPending, setPickupConfirmPending] = useState(false);
  const [showAdvanceAccepted, setShowAdvanceAccepted] = useState(false);
  const paymentBeforeScheduleRef = useRef(null);

  // 🔍 Diagnostic: confirms whether riderLocation state is actually updating.
  // If this never logs a non-null value while status is 1 or 2, the map
  // props are correctly empty and the bug is upstream (handleGetBookingDetails
  // not extracting rider_details, or bookingStatus not reaching this component).
  // If it DOES log a value but the marker still doesn't appear, the bug is
  // inside AppMap.js's rendering/prop handling instead.
  useEffect(() => {
    console.log(
      '🗺️ [Map] riderLocation state changed:',
      riderLocation,
      '| bookingStatus:',
      bookingStatus,
    );
  }, [riderLocation, bookingStatus]);

  const statusMessages = {
    0: 'Waiting for the Rider to accept your Booking',
    1: 'Your Rider will arrive soon',
    2: 'In transit. Do not use your phone',
  };

  const riderFoundTimeout = useRef(null);
  const [showWaitingBanner, setShowWaitingBanner] = useState(false);
  const [riderArrivedAt, setRiderArrivedAt] = useState(null);
  const [showSafetyGuide, setShowSafetyGuide] = useState(false);
  const [penaltyPreview, setPenaltyPreview] = useState(null);
  const [cancelPreviewLoading, setCancelPreviewLoading] = useState(false);
  const cancelSubmitGuard = useCancellationSubmitGuard();
  const [penaltyLoading, setPenaltyLoading] = useState(false);
  const [retryLoading, setRetryLoading] = useState(false);
  const [noRidersError, setNoRidersError] = useState('');

  // ✅ Ref to distinguish between "Cancel to go back to confirm" vs "Full cancel"
  // When true, handleUpdateBookingStatus will only clear the booking ID,
  // keeping all other details (locations, fare, service, etc.) intact
  const isCancellingToConfirmRef = useRef(false);

  const applyBookingVehicle = (booking, rider_details) => {
    const next = getBookingVehicle(booking, rider_details);
    const plate = next?.plateNumber || '';
    const label = next?.label || '';
    setBookingVehicle(prev => {
      if (prev?.plateNumber === plate && prev?.label === label) {
        return prev;
      }
      return next;
    });
  };

  const clearTransientBookingUi = () => {
    setBookingVehicle(null);
    setRiderEta(null);
    setRiderEtaReceivedAt(0);
    setScheduledAt(null);
    setAdvanceBookingFlow(false);
    setPickupConfirmPending(false);
    setShowAdvanceAccepted(false);
    paymentBeforeScheduleRef.current = null;
  };

  // After a reload the persisted trip fields can be empty; rebuild them from
  // the server booking so the sheet shows the trip and its Cancel button.
  const restoreTripFields = booking => {
    if (!pickupLocation && booking?.pickup_location) {
      dispatch(
        setPickupLocation({
          address: booking.pickup_location,
          description: booking.pickup_location,
          lat: booking.pickup_lat,
          long: booking.pickup_long,
        }),
      );
    }
    if (!dropoffLocation && booking?.dropoff_location) {
      dispatch(
        setDropoffLocation({
          address: booking.dropoff_location,
          description: booking.dropoff_location,
          lat: booking.dropoff_lat,
          long: booking.dropoff_long,
        }),
      );
    }
    if (!selectedService) {
      const svc = SERVICE_OPTIONS.find(
        s => String(s.id) === String(booking?.booking_type),
      );
      if (svc) {
        dispatch(setSelectedService(svc));
      }
    }
  };

  const maybeShowAdvanceAcceptedModal = (booking, rider_details) => {
    if (!bookLater.enabled || Number(booking?.status) !== 5) {
      return;
    }
    const riderId = getAssignedRiderId(booking, rider_details);
    if (
      !booking?.id ||
      !riderId ||
      isAdvanceAcceptedAcknowledged(
        acknowledgedScheduledIds,
        booking.id,
        riderId,
      )
    ) {
      return;
    }
    // status 5 without a rider is just "scheduled", not accepted
    // (the backend sends rider_details: {} when no rider holds it)
    if (!hasRider(booking, rider_details)) {
      return;
    }
    if (hasRider(null, rider_details)) {
      dispatch(setRiderDetails(rider_details));
      applyBookingVehicle(booking, rider_details);
    }
    setShowAdvanceAccepted(true);
  };

  useParkedAdvanceBookingPoll({
    customerId: userInfo?.id,
    enabled: bookLater.enabled && parkedAdvanceBookings.length > 0,
    onBookingSynced: data => {
      if (isReturnedToPool(data)) {
        dispatch(clearAcknowledgedScheduledForBooking(data.id));
      }
    },
  });

  const checkActiveBooking = usePostRequest();
  const discoverActiveBooking = usePostRequest();
  // Bookings the restore check rejected as stale/not ours; discovery skips them
  // so a mismatch can't loop.
  const staleBookingIdsRef = useRef(new Set());
  const [isRestoringBooking, setIsRestoringBooking] = useState(false);

  const seedPersistedActiveBookingUi = useCallback(() => {
    if (!activeBooking?.id) {
      return;
    }
    const persistedStatus = Number(activeBooking.status ?? bookingStatus ?? 0);
    if (![0, 1, 2, 5].includes(persistedStatus)) {
      return;
    }
    restoreTripFields(activeBooking);
    dispatch(setBookingStatus(persistedStatus));
    dispatch(setIsConfirmed(true));
    dispatch(setIsBooked(true));
    setShowWaitingBanner(true);
    if (activeBooking.scheduled_pickup_at || activeBooking.scheduled_at) {
      setScheduledAt(
        new Date(
          activeBooking.scheduled_pickup_at || activeBooking.scheduled_at,
        ),
      );
    }
    const rd = riderDetails || activeBooking.rider_details;
    if (rd && Object.keys(rd).length > 0) {
      dispatch(setRiderDetails(rd));
      applyBookingVehicle(activeBooking, rd);
      if (
        (persistedStatus === 1 || persistedStatus === 2) &&
        rd.current_lat &&
        rd.current_long
      ) {
        setRiderLocation({
          lat: rd.current_lat,
          long: rd.current_long,
        });
      }
    }
  }, [activeBooking, bookingStatus, riderDetails, dispatch]);

  const discoverOngoingBookingFromServer = useCallback(async () => {
    if (!userInfo?.id || activeBooking?.id || checkActiveBooking.loading) {
      return;
    }
    const { response } = await discoverActiveBooking.makePostRequest(
      Constants.ENDPOINT.GET_BOOKING_HISTORY,
      { customer_id: userInfo.id, page: 1 },
    );
    const bookings = response?.data?.bookings;
    if (!Array.isArray(bookings)) {
      return;
    }
    const ongoing =
      bookings.find(b => Number(b.status) === 2) ||
      bookings.find(b => Number(b.status) === 1) ||
      bookings.find(
        b =>
          Number(b.status) === 0 &&
          !staleBookingIdsRef.current.has(bookingKey(b)),
      ) ||
      bookings.find(
        b =>
          Number(b.status) === 5 &&
          hasRider(b, b.rider_details) &&
          !minimizedAdvanceBookingIds.includes(String(b.id)) &&
          !staleBookingIdsRef.current.has(bookingKey(b)),
      );
    if (ongoing?.id && !staleBookingIdsRef.current.has(bookingKey(ongoing))) {
      restoreTripFields(ongoing);
      setIsRestoringBooking(true);
      checkActiveBooking.makePostRequest(
        Constants.ENDPOINT.GET_BOOKING_DETAILS,
        {
          booking_id: ongoing.id,
          customer_id: userInfo.id,
          include_rider_eta: '1',
        },
      );
    }
  }, [userInfo?.id, activeBooking?.id, minimizedAdvanceBookingIds]);

  const restoreParkedAdvanceSnapshot = snapshot => {
    const booking = snapshot?.booking;
    if (!booking?.id) {
      return;
    }
    dispatch(removeMinimizedAdvanceBookingId(booking.id));
    dispatch(removeParkedAdvanceBooking(booking.id));
    restoreTripFields(booking);
    dispatch(setActiveBooking(booking));
    dispatch(setBookingStatus(Number(booking.status)));
    dispatch(setIsBooked(true));
    dispatch(setIsConfirmed(true));
    if (snapshot.riderDetails) {
      dispatch(setRiderDetails(snapshot.riderDetails));
      applyBookingVehicle(booking, snapshot.riderDetails);
    }
    if (snapshot.pickupLocation) {
      dispatch(setPickupLocation(snapshot.pickupLocation));
    }
    if (snapshot.dropoffLocation) {
      dispatch(setDropoffLocation(snapshot.dropoffLocation));
    }
    if (snapshot.selectedService) {
      dispatch(setSelectedService(snapshot.selectedService));
    }
    if (snapshot.inquireBookingResponse) {
      dispatch(setInquireBookingResponse(snapshot.inquireBookingResponse));
    }
    const scheduledIso =
      snapshot.scheduledPickupAt ||
      booking.scheduled_pickup_at ||
      booking.scheduled_at;
    if (scheduledIso) {
      setScheduledAt(new Date(scheduledIso));
    }
    if (snapshot.selectedPayment) {
      setSelectedPayment(snapshot.selectedPayment);
    }
    setShowWaitingBanner(true);
    maybeShowAdvanceAcceptedModal(
      booking,
      snapshot.riderDetails ?? booking.rider_details,
    );
  };

  const expandAdvanceTracking = useCallback(
    bookingId => {
      const id = String(bookingId ?? '');
      if (!id) {
        return;
      }
      const parked = parkedAdvanceBookings.find(
        p => String(p.booking?.id) === id,
      );
      if (parked) {
        restoreParkedAdvanceSnapshot(parked);
        return;
      }
      if (activeBooking?.id && String(activeBooking.id) === id) {
        dispatch(removeMinimizedAdvanceBookingId(id));
        setShowWaitingBanner(true);
        return;
      }
      setIsRestoringBooking(true);
      checkActiveBooking.makePostRequest(
        Constants.ENDPOINT.GET_BOOKING_DETAILS,
        {
          booking_id: bookingId,
          customer_id: userInfo?.id,
          include_rider_eta: '1',
        },
      );
    },
    [parkedAdvanceBookings, activeBooking?.id, userInfo?.id, dispatch],
  );

  const handleMinimizeAcceptedAdvance = () => {
    if (!activeBooking?.id) {
      return;
    }
    const scheduled =
      scheduledAt ||
      activeBooking.scheduled_pickup_at ||
      activeBooking.scheduled_at;
    dispatch(
      parkAdvanceBooking({
        booking: activeBooking,
        riderDetails,
        pickupLocation,
        dropoffLocation,
        selectedService,
        inquireBookingResponse,
        scheduledPickupAt: scheduled ? new Date(scheduled).toISOString() : null,
        selectedPayment,
      }),
    );
    dispatch(addMinimizedAdvanceBookingId(activeBooking.id));
    const minimizeRiderId = getAssignedRiderId(activeBooking, riderDetails);
    const minimizeAck = advanceAcceptedAckKey(
      activeBooking.id,
      minimizeRiderId,
    );
    if (minimizeAck) {
      dispatch(addAcknowledgedScheduledId(minimizeAck));
    }
    setShowWaitingBanner(false);
    setShowAdvanceAccepted(false);
    riderAlertShownRef.current = false;
    dispatch(clearBookingState());
    clearTransientBookingUi();
    setSelectedPromo(null);
    setNoteToRider('');
    setRiderLocation(null);
  };

  const notifyPush = (message, onConfirm) => {
    setPushNotice({ message, onConfirm });
    setShowPushNotice(true);
  };

  // A rider cancel re-pools the trip under a NEW booking (old one: status 4 +
  // replaced_by). Swap every saved id to the new booking, tell the passenger
  // the new reference, then reload it through the normal restore path.
  const replacementHopsRef = useRef(0);
  const followReplacement = (oldBooking, { notify = true } = {}) => {
    const newId = getReplacementId(oldBooking);
    if (!newId || replacementHopsRef.current >= 5) {
      return false;
    }
    replacementHopsRef.current += 1;
    dispatch(
      replaceBookingId({
        oldId: oldBooking.id,
        newId,
        newRefCode: oldBooking.replaced_by_ref_code,
      }),
    );
    dispatch(setRiderDetails({}));
    setRiderLocation(null);
    setBookingVehicle(null);
    setShowAdvanceAccepted(false);
    riderAlertShownRef.current = false;
    if (pushTargetRef.current?.id === String(oldBooking.id)) {
      pushTargetRef.current = { ...pushTargetRef.current, id: String(newId) };
    }
    if (notify) {
      notifyPush(
        "Your rider cancelled. We're finding you a new rider." +
          (oldBooking.replaced_by_ref_code
            ? ` New reference: ${oldBooking.replaced_by_ref_code}`
            : ''),
      );
    }
    setIsRestoringBooking(true);
    checkActiveBooking.makePostRequest(Constants.ENDPOINT.GET_BOOKING_DETAILS, {
      booking_id: newId,
      customer_id: userInfo?.id,
      include_rider_eta: '1',
    });
    return true;
  };

  // Resolve the newest booking id for a (possibly re-pooled) booking.
  const replacementLookup = usePostRequest();
  const resolveReplacedId = async bookingId => {
    let id = bookingId;
    for (let hop = 0; hop < 5; hop += 1) {
      const { response } = await replacementLookup.makePostRequest(
        Constants.ENDPOINT.GET_BOOKING_DETAILS,
        { booking_id: id, customer_id: userInfo?.id },
      );
      const data = response?.code === 200 ? response.data : null;
      const nextId = getReplacementId(data);
      if (!nextId) {
        return String(id) === String(bookingId) ? null : { id, data };
      }
      dispatch(
        replaceBookingId({
          oldId: id,
          newId: nextId,
          newRefCode: data.replaced_by_ref_code,
        }),
      );
      id = nextId;
    }
    return null;
  };

  // Push tap: always reload the pushed booking by id and let
  // handleRestoredBooking decide from its current status. Never replaces a
  // different live trip that is already on screen.
  const openPushTarget = (bookingId, pushType) => {
    const id = String(bookingId);
    const liveOnScreen =
      Boolean(activeBooking?.id) &&
      String(activeBooking.id) !== id &&
      ([1, 2].includes(Number(bookingStatus)) ||
        (!activeBooking.is_advance && Number(bookingStatus) === 0));
    if (liveOnScreen) {
      console.log('🔔 Push for', id, 'while trip', activeBooking.id, 'is live');
      navigation.navigate('BookingHistoryScreen', {
        openBookingId: bookingId,
        fromPush: true,
        openAsDetails: true,
      });
      return;
    }
    const parked = parkedAdvanceBookings.find(
      p => String(p.booking?.id) === id,
    );
    if (parked) {
      // show the saved snapshot right away; get_details below verifies it
      restoreParkedAdvanceSnapshot(parked);
    } else if (activeBooking?.id && String(activeBooking.id) === id) {
      dispatch(removeMinimizedAdvanceBookingId(id));
    }
    pushTargetRef.current = { id, type: pushType, at: Date.now() };
    setIsRestoringBooking(true);
    checkActiveBooking.makePostRequest(Constants.ENDPOINT.GET_BOOKING_DETAILS, {
      booking_id: bookingId,
      customer_id: userInfo?.id,
      include_rider_eta: '1',
    });
  };

  useEffect(() => {
    const expandId = route.params?.expandAdvanceBookingId;
    if (!expandId) {
      return;
    }
    const fromPush = Boolean(route.params?.fromPush);
    const pushType = route.params?.pushType;
    navigation.setParams({
      expandAdvanceBookingId: undefined,
      fromPush: undefined,
      pushType: undefined,
    });
    if (fromPush) {
      openPushTarget(expandId, pushType);
      return;
    }
    expandAdvanceTracking(expandId);
  }, [route.params?.expandAdvanceBookingId, expandAdvanceTracking, navigation]);

  const inquireBooking = usePostRequest();
  const advanceLimitCheck = usePostRequest();
  const createBooking = usePostRequest();
  const updateBookingStatus = usePostRequest();
  const retryBooking = usePostRequest();
  const cancelAdvance = usePostRequest();
  const getBookingDetails = usePostRequest();
  const getPromoList = usePostRequest();
  // 🆕 Any request that represents a user-initiated state transition
  // (book, confirm, cancel) locks the relevant buttons. A button only
  // re-enables once the API actually responds — success or error — never
  // before. This is the real guarantee: no navigation/transition without
  // a confirmed response, regardless of what NetInfo thinks connectivity is.
  const isLoading =
    inquireBooking.loading ||
    createBooking.loading ||
    updateBookingStatus.loading ||
    cancelAdvance.loading ||
    retryBooking.loading;

  const onBookPressed = async () => {
    // "booking should not go through when there is no internet".
    const online = await checkIsOnline();
    if (!online) {
      Alert.alert(
        OFFLINE_ALERT_TITLE,
        'You need an internet connection to book a ride. Please reconnect and try again.',
      );
      return;
    }

    // Check location permission before allowing booking
    const permission = await ensureLocationPermission();

    if (permission !== 'granted') {
      if (permission === 'blocked') {
        Alert.alert(
          'Location Required',
          'Location access is blocked. Please enable it in Settings to book a ride.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => openSettings() },
          ],
        );
      } else {
        Alert.alert(
          'Location Required',
          'Location access is required to book a ride. Please enable location services.',
          [{ text: 'OK' }],
        );
      }
      return;
    }

    setShowServiceModal(true);
    riderFoundTimeout.current = setTimeout(() => {
      // setShowRiderFound(true);
    }, 15000);
  };

  const handleTopRightPress = () => {
    navigation.navigate('SettingsScreen');
  };

  // Request location when screen is focused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      const permission = await ensureLocationPermission();

      if (permission === 'granted') {
        startWatching();
      } else if (permission === 'blocked') {
        Alert.alert(
          'Location Access Blocked',
          'Please enable location in Settings to use the app.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => openSettings() },
          ],
        );
      } else if (permission === 'denied') {
        Alert.alert(
          'Location Required',
          'This app needs location access to show your position on the map.',
          [{ text: 'OK' }],
        );
      }
    });

    return unsubscribe;
  }, [navigation, startWatching]);

  // Separate useEffect for login success modal - only runs once
  useEffect(() => {
    if (!hasShownLoginSuccess) {
      setShowSuccess(true);
      dispatch(setHasShownLoginSuccess(true));
    }
  }, [hasShownLoginSuccess, dispatch]);

  useEffect(() => {
    AppUtil.debugDeep(userInfo);
    AppUtil.debugDeep(selectedService);

    triggerGetPromoList();

    return () => {
      if (riderFoundTimeout.current) {
        clearTimeout(riderFoundTimeout.current);
      }
      stopWatching();
    };
  }, []);

  // Verify a saved (persisted) booking against the server whenever Home mounts
  // or the logged-in customer changes, so a stale booking can't stick.
  useEffect(() => {
    if (pushTargetPending()) {
      return;
    }
    if (!activeBooking?.id) {
      discoverOngoingBookingFromServer();
      return;
    }
    console.log('🔄 Found saved booking in Redux:', activeBooking.id);
    seedPersistedActiveBookingUi();
    setIsRestoringBooking(true);
    checkActiveBooking.makePostRequest(Constants.ENDPOINT.GET_BOOKING_DETAILS, {
      booking_id: activeBooking.id,
      customer_id: userInfo?.id,
      include_rider_eta: '1',
    });
  }, [userInfo?.id]);

  // Re-check the saved booking whenever Home regains focus, so a booking
  // cancelled elsewhere (e.g. from Booking History) doesn't leave a stale card.
  const homeFocusedOnceRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!homeFocusedOnceRef.current) {
        homeFocusedOnceRef.current = true;
        return;
      }
      if (
        !activeBooking?.id ||
        checkActiveBooking.loading ||
        pushTargetPending()
      ) {
        return;
      }
      checkActiveBooking.makePostRequest(
        Constants.ENDPOINT.GET_BOOKING_DETAILS,
        {
          booking_id: activeBooking.id,
          customer_id: userInfo?.id,
          include_rider_eta: '1',
        },
      );
    }, [activeBooking?.id, userInfo?.id]),
  );

  // Show location error if any
  useEffect(() => {
    if (locationError && permissionStatus === 'granted') {
      console.warn('Location error:', locationError);
    }
  }, [locationError, permissionStatus]);

  // ✅ NEW: Handle restored booking response
  const handleRestoredBooking = () => {
    if (checkActiveBooking.error) {
      // if we simply have no connection, DO NOT wipe the booking out of
      // Redux — the booking is very likely still active on the backend.
      // Just stop the "restoring" spinner and let it fall through to the
      // normal poll loop, which will pick things up as soon as we're back
      // online (see the reconnect-resync effect below).
      const pushTarget = pushTargetPending() ? pushTargetRef.current : null;
      pushTargetRef.current = null;
      if (checkActiveBooking.isOffline) {
        console.warn('⚠️ Could not verify active booking — offline');
        seedPersistedActiveBookingUi();
        setIsRestoringBooking(false);
        if (pushTarget) {
          notifyPush(
            "We couldn't open that booking. Please check your connection and try again.",
          );
        }
        return;
      }
      const notFound = /not found|does not exist/i.test(
        String(checkActiveBooking.error),
      );
      if (pushTarget) {
        // only drop the saved booking if it is the one that's gone
        if (notFound && String(activeBooking?.id) === pushTarget.id) {
          dispatch(clearBookingState());
          clearTransientBookingUi();
          setShowWaitingBanner(false);
        }
        setIsRestoringBooking(false);
        notifyPush(
          notFound
            ? 'This booking is no longer available.'
            : String(checkActiveBooking.error),
        );
        return;
      }

      console.warn(
        '❌ Error fetching active booking:',
        checkActiveBooking.error,
      );
      // An error is "unknown", not "status 0": keep the saved booking and its
      // status. Only a definite not-found drops it.
      if (/not found|does not exist/i.test(String(checkActiveBooking.error))) {
        dispatch(clearBookingState());
      }
      setIsRestoringBooking(false);
      return;
    }

    if (!checkActiveBooking.response) {
      return;
    }

    const results = checkActiveBooking.response;

    if (results?.code === 200 && results?.data) {
      const booking = results?.data;
      AppUtil.debugDeep(booking);
      const restoredNum = Number(booking.status);
      const ownerId = booking.customer?.id ?? booking.customer_id;
      const notMine =
        ownerId != null &&
        userInfo?.id != null &&
        String(ownerId) !== String(userInfo.id);

      if (!notMine && followReplacement(booking)) {
        return;
      }
      if (!getReplacementId(booking)) {
        replacementHopsRef.current = 0;
      }

      const pushTarget = pushTargetRef.current;
      const isPushTarget =
        Boolean(pushTarget) && String(booking.id) === pushTarget.id;
      if (isPushTarget) {
        pushTargetRef.current = null;
        const isSaved = String(activeBooking?.id) === String(booking.id);
        const dropIfSaved = () => {
          if (isSaved) {
            dispatch(clearBookingState());
            clearTransientBookingUi();
            setShowWaitingBanner(false);
          }
        };
        const rated =
          restoredNum === 3 &&
          Boolean(
            booking.booking_ratings?.rate ||
              ratedBookingIds.includes(bookingKey(booking)),
          );
        if (notMine || ![0, 1, 2, 3, 5].includes(restoredNum)) {
          staleBookingIdsRef.current.add(bookingKey(booking));
          dropIfSaved();
          setIsRestoringBooking(false);
          notifyPush(
            !notMine && restoredNum === 4
              ? 'This booking was cancelled.'
              : 'This booking is no longer available.',
          );
          return;
        }
        if (rated) {
          dropIfSaved();
          setIsRestoringBooking(false);
          const openDetails = () =>
            navigation.navigate('BookingDetailsScreen', {
              bookingDetails: transformBooking(booking),
            });
          if (pushTarget.type === PUSH_TYPES.TRIP_COMPLETED) {
            openDetails();
          } else {
            notifyPush('This trip is already completed.', openDetails);
          }
          return;
        }
        // still live (0/1/2/5) or completed-not-rated (Rating below): show
        // the server's current state, replacing a different saved booking
        // that isn't live (the live case was sent to History already).
        if (activeBooking?.id && !isSaved && restoredNum !== 3) {
          dispatch(clearBookingState());
          clearTransientBookingUi();
          riderAlertShownRef.current = false;
        }
        if (!isSaved && restoredNum !== 3) {
          dispatch(
            setPickupLocation({
              address: booking.pickup_location,
              description: booking.pickup_location,
              lat: booking.pickup_lat,
              long: booking.pickup_long,
            }),
          );
          dispatch(
            setDropoffLocation({
              address: booking.dropoff_location,
              description: booking.dropoff_location,
              lat: booking.dropoff_lat,
              long: booking.dropoff_long,
            }),
          );
          const svc = SERVICE_OPTIONS.find(
            s => String(s.id) === String(booking.booking_type),
          );
          if (svc) {
            dispatch(setSelectedService(svc));
          }
        }
        // expand a minimized / parked advance booking
        dispatch(removeMinimizedAdvanceBookingId(booking.id));
        dispatch(removeParkedAdvanceBooking(booking.id));
        if (!hasRider(booking, booking.rider_details)) {
          // e.g. reassigned since the push: no stale rider card
          dispatch(setRiderDetails({}));
          setRiderLocation(null);
          setBookingVehicle(null);
        }
      }
      // Only 0 (searching), 1, 2 and 5 (scheduled) are live. Anything else, or a
      // booking that isn't this customer's, is stale: drop it.
      if (notMine || ![0, 1, 2, 3, 5].includes(restoredNum)) {
        console.log('🧹 Clearing stale saved booking', booking.id, restoredNum);
        staleBookingIdsRef.current.add(bookingKey(booking));
        dispatch(clearBookingState());
        clearTransientBookingUi();
        setShowWaitingBanner(false);
        setIsRestoringBooking(false);
        return;
      }
      // Completed and already rated (server rating, or rated/skipped locally):
      // just clear, no Rating screen.
      if (
        restoredNum === 3 &&
        (booking.booking_ratings?.rate ||
          ratedBookingIds.includes(bookingKey(booking)))
      ) {
        dispatch(clearBookingState());
        clearTransientBookingUi();
        setIsRestoringBooking(false);
        return;
      }

      // Check if booking is still active
      if (restoredNum === 3) {
        console.log('✅ Booking completed, navigating to rating');
        clearTransientBookingUi();
        setIsRestoringBooking(false);

        navigation.reset({
          index: 0,
          routes: [
            {
              name: 'RatingScreen',
              params: { bookingDetails: booking },
            },
          ],
        });
        return;
      }

      if (restoredNum === 4) {
        console.log('✅ Booking cancelled');
        dispatch(clearBookingState());
        clearTransientBookingUi();
        setIsRestoringBooking(false);
        return;
      }

      if (Number(booking.status) === 5) {
        dispatch(removeMinimizedAdvanceBookingId(booking.id));
        dispatch(removeParkedAdvanceBooking(booking.id));
        restoreTripFields(booking);
        dispatch(setActiveBooking(booking));
        dispatch(setBookingStatus(5));
        dispatch(setIsConfirmed(true));
        dispatch(setIsBooked(true));
        setShowWaitingBanner(true);
        if (booking.scheduled_pickup_at || booking.scheduled_at) {
          setScheduledAt(
            new Date(booking.scheduled_pickup_at || booking.scheduled_at),
          );
        }
        if (
          isReturnedToPool(booking) ||
          !hasRider(booking, booking.rider_details)
        ) {
          dispatch(clearAcknowledgedScheduledForBooking(booking.id));
        } else {
          maybeShowAdvanceAcceptedModal(booking, booking.rider_details);
        }
        setIsRestoringBooking(false);
        return;
      }

      // ✅ Update Redux with latest booking data
      console.log('✅ Restoring active booking state');
      restoreTripFields(booking);
      dispatch(setActiveBooking(booking));
      dispatch(setBookingStatus(Number(booking.status)));
      dispatch(setIsConfirmed(true));
      dispatch(setIsBooked(true));
      setShowWaitingBanner(true);

      // Restore rider details if available
      if (booking.scheduled_pickup_at || booking.scheduled_at) {
        setScheduledAt(
          new Date(booking.scheduled_pickup_at || booking.scheduled_at),
        );
      }

      if (booking.rider_details) {
        dispatch(setRiderDetails(booking.rider_details));
        applyBookingVehicle(booking, booking.rider_details);

        // 🆕 Seed the live map marker immediately from the restored data so
        // the rider shows up right away instead of waiting for the next poll
        const restoredStatusNum = Number(booking.status);
        if (
          (restoredStatusNum === 1 || restoredStatusNum === 2) &&
          booking.rider_details?.current_lat &&
          booking.rider_details?.current_long
        ) {
          setRiderLocation({
            lat: booking.rider_details.current_lat,
            long: booking.rider_details.current_long,
          });
        }

        if (booking.status === 1 && !riderAlertShownRef.current) {
          AppUtil.debugDeep(riderDetails);
          if (shouldShowRiderFoundAlert(booking)) {
            setShowRiderFound(true);
          }
          riderAlertShownRef.current = true;
        }
      }

      const restoredStatus = Number(booking.status);
      if (restoredStatus === 1 && booking.rider_eta) {
        setRiderEta(booking.rider_eta);
        setRiderEtaReceivedAt(Date.now());
      }
    } else {
      // data:null / unexpected reply = unknown: keep the previous status and
      // let the normal poll pick things up.
      console.warn('⚠️ get_details returned no data; keeping saved booking');
      if (pushTargetPending()) {
        pushTargetRef.current = null;
        notifyPush('This booking is no longer available.');
      }
    }

    setIsRestoringBooking(false);
  };

  useEffect(() => {
    handleRestoredBooking();
  }, [checkActiveBooking.response, checkActiveBooking.error]);

  // GET PROMO LIST
  const triggerGetPromoList = () => {
    const postdata = {};
    getPromoList.makePostRequest(Constants.ENDPOINT.GET_PROMO_LIST, postdata);
  };

  const handleGetPromoList = () => {
    if (getPromoList.error) {
      console.warn('Error fetching promo list:', getPromoList.error);
      return;
    }

    if (!getPromoList.response) {
      return;
    }

    const results = getPromoList.response;

    if (results?.code === 200 && results?.data?.promos) {
      setAvailablePromos(results.data.promos);
    }
  };

  useEffect(() => {
    handleGetPromoList();
  }, [getPromoList.response, getPromoList.error]);

  //INQUIRE BOOKING
  const triggerInquireBooking = async (bookingTypeOverride = null) => {
    // guard against a double-tap firing a second request before the
    // button's disabled state has re-rendered.
    if (inquireBooking.loading) {
      return;
    }

    // block — no fare inquiry, no booking, without a connection.
    const online = await checkIsOnline();
    if (!online) {
      Alert.alert(OFFLINE_ALERT_TITLE, OFFLINE_ALERT_MESSAGE);
      return;
    }

    const permission = await ensureLocationPermission();

    if (permission !== 'granted') {
      Alert.alert(
        'Location Required',
        'Location access is required to inquire booking.',
        [{ text: 'OK' }],
      );
      return;
    }

    // Only a plain id counts as an override. A button press event used to land
    // here and got sent as '[object Object]', which the backend priced as a motorcycle.
    const isScalar = v => typeof v === 'string' || typeof v === 'number';
    const bookingType = isScalar(bookingTypeOverride)
      ? bookingTypeOverride
      : selectedService?.id;
    if (bookingType == null || bookingType === '') {
      setAlertMessage('Please choose a vehicle type first.');
      setShowAlert(true);
      return;
    }
    const postdata = {
      booking_type: String(bookingType),
      pickup_location: pickupLocation?.address,
      pickup_lat: pickupLocation?.lat,
      pickup_long: pickupLocation?.long,
      dropoff_location: dropoffLocation?.address,
      dropoff_lat: dropoffLocation?.lat,
      dropoff_long: dropoffLocation?.long,
      promo_code: selectedPromo?.code || '',
      promo_id: selectedPromo?.id || '',
    };
    if (scheduledAt) {
      postdata.scheduled_pickup_at = scheduledAt.toISOString();
    }
    inquireBooking.makePostRequest(
      Constants.ENDPOINT.INQUIRE_BOOKING,
      postdata,
    );
  };

  const handleInquireBookingRequest = () => {
    if (inquireBooking.error) {
      setAlertMessage(inquireBooking.error);
      setShowAlert(true);
      return;
    }

    if (!inquireBooking.response) {
      return;
    }

    const results = inquireBooking?.response;
    AppUtil.debugDeep(results?.data);

    if (results?.code === 200 && results?.data) {
      // save to Redux instead of local state
      dispatch(setInquireBookingResponse(results.data));
      dispatch(setIsBooked(true));
    } else if (results?.code === 200) {
      // BUG-1: a 200 with no fare data must not open the summary
      setAlertMessage(FARE_UNAVAILABLE_MESSAGE);
      setShowAlert(true);
    }
  };

  useEffect(() => {
    handleInquireBookingRequest();
  }, [inquireBooking.response, inquireBooking.error]);

  // A booking needs a complete profile: first name, last name and a photo of
  // the passenger (the server refuses it otherwise). It is checked at the
  // first tap, so nobody picks places and a fare only to be turned away.
  const profileComplete = !!userInfo?.profile_complete;
  const requireCompleteProfile = () => {
    if (profileComplete) {
      return true;
    }
    Alert.alert(
      'Complete Your Profile',
      'Add your first name, last name and a photo of yourself before booking.',
      [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Complete Profile',
          onPress: () => navigation.navigate('CompleteProfileScreen'),
        },
      ],
    );
    return false;
  };

  //CREATE BOOKING
  const triggerCreateBooking = async () => {
    if (createBooking.loading) {
      return;
    }
    if (!requireCompleteProfile()) {
      return;
    }

    // BUG-1: never build payment_details from an empty fare
    if (!inquireBookingResponse) {
      setAlertMessage(FARE_UNAVAILABLE_MESSAGE);
      setShowAlert(true);
      return;
    }

    // block — this is the actual booking-creation call, the one that
    // absolutely must not go through while offline.
    const online = await checkIsOnline();
    if (!online) {
      Alert.alert(OFFLINE_ALERT_TITLE, OFFLINE_ALERT_MESSAGE);
      return;
    }

    const permission = await ensureLocationPermission();

    if (permission !== 'granted') {
      Alert.alert(
        'Location Required',
        'Location access is required to create booking.',
        [{ text: 'OK' }],
      );
      return;
    }

    const payment_details = {
      type: selectedPayment.toLowerCase(),
      distance_km_round: inquireBookingResponse?.distance_km_round,
      minimum_fare: inquireBookingResponse?.minimum_fare,
      pesos_per_km: inquireBookingResponse?.pesos_per_km,
      booking_fee: inquireBookingResponse?.booking_fee,
      base_amount: inquireBookingResponse?.base_amount,
      commission: inquireBookingResponse?.commission,
      rider_net_amount: inquireBookingResponse?.rider_net_amount,
      promo_discount: inquireBookingResponse?.promo_discount,
      tip: 0,
      total_amount_wo_promo: inquireBookingResponse?.total_amount_wo_promo,
      total_amount: inquireBookingResponse?.total_amount,
    };

    const all_payment_details = inquireBookingResponse;

    const postdata = {
      booking_type: String(selectedService?.id ?? ''),
      pickup_location: pickupLocation?.address,
      pickup_lat: pickupLocation?.lat,
      pickup_long: pickupLocation?.long,
      dropoff_location: dropoffLocation?.address,
      dropoff_lat: dropoffLocation?.lat,
      dropoff_long: dropoffLocation?.long,
      payment_type: selectedPayment.toLowerCase(),
      note_to_rider: noteToRider || '',
      payment_details: JSON.stringify(payment_details),
      all_payment_details: JSON.stringify(all_payment_details),
      promo_code: selectedPromo?.code || '',
      promo_id: selectedPromo?.id || '',
    };
    if (scheduledAt) {
      postdata.scheduled_at = scheduledAt.toISOString();
      // backend 0102 contract
      postdata.is_advance = '1';
      postdata.scheduled_pickup_at = scheduledAt.toISOString();
    }
    createBooking.makePostRequest(Constants.ENDPOINT.CREATE_BOOKING, postdata);
  };

  const handleCreateBookingRequest = () => {
    if (createBooking.error) {
      setAlertMessage(createBooking.error);
      setShowAlert(true);
      return;
    }

    if (!createBooking.response) {
      return;
    }

    const results = createBooking?.response;
    AppUtil.debugDeep(results);

    if (results?.code === 200) {
      // save to Redux (automatically persisted)
      dispatch(setIsConfirmed(true));
      dispatch(setActiveBooking(results?.data));
      setShowWaitingBanner(true);
    }
  };

  useEffect(() => {
    handleCreateBookingRequest();
  }, [createBooking.response, createBooking.error]);

  //GET BOOKING DETAILS
  const triggerGetBookingDetails = () => {
    // don't even fire the poll while offline — Api.js would fail it fast
    // anyway, but skipping it here avoids needless loading-state churn and
    // makes the "temporarily stop, resume after reconnection" behavior the
    // client asked for explicit rather than incidental.
    if (!isOnline) {
      return;
    }

    const postdata = {
      booking_id: activeBooking?.id,
      // stop asking for ETA once the rider has arrived at pickup
      include_rider_eta: riderArrived ? '0' : '1',
    };
    getBookingDetails.makePostRequest(
      Constants.ENDPOINT.GET_BOOKING_DETAILS,
      postdata,
    );
  };

  const handleGetBookingDetails = () => {
    if (getBookingDetails.error) {
      // a poll failing because we're offline is expected and should be
      // silent — real-time updates just pause and resume on reconnect.
      // This is the fix for "modal keeps popping up with a weak connection
      // warning" (issue c). Only surface an alert for a genuine API error.
      if (getBookingDetails.isOffline) {
        return;
      }
      setAlertMessage(getBookingDetails.error);
      setShowAlert(true);
      return;
    }

    const response = getBookingDetails.response;
    if (!response) {
      return;
    }

    const { code, data } = response;

    if (
      code === 200 &&
      data &&
      String(data.id) === String(activeBooking?.id) &&
      followReplacement(data)
    ) {
      return;
    }

    if (code === 200 && data && data.status != null && data.status !== '') {
      const { status, rider_details } = data;
      const statusNum = Number(status);

      // ✅ Update Redux (keep activeBooking, trip fields, and banner synced on poll/reconnect)
      if ([0, 1, 2, 5].includes(statusNum)) {
        restoreTripFields(data);
        dispatch(setActiveBooking(data));
        dispatch(setIsConfirmed(true));
        dispatch(setIsBooked(true));
        setShowWaitingBanner(true);
      }
      dispatch(setBookingStatus(statusNum));
      AppUtil.debugDeep(rider_details);

      setRiderArrivedAt(
        statusNum === 1 && (data.arrived || data.rider_arrived_at)
          ? data.rider_arrived_at || true
          : null,
      );

      if (statusNum === 5) {
        if (isReturnedToPool(data) || !hasRider(data, rider_details)) {
          dispatch(clearAcknowledgedScheduledForBooking(data.id));
          dispatch(setRiderDetails({}));
          setBookingVehicle(null);
          setShowAdvanceAccepted(false);
        } else {
          dispatch(setRiderDetails(rider_details));
          applyBookingVehicle(data, rider_details);
          maybeShowAdvanceAcceptedModal(data, rider_details);
        }
        setRiderLocation(null);
        setRiderEta(null);
        setRiderEtaReceivedAt(0);
      } else if (statusNum === 1) {
        dispatch(setRiderDetails(rider_details));
        applyBookingVehicle(data, rider_details);
        if (data.rider_eta) {
          setRiderEta(data.rider_eta);
          setRiderEtaReceivedAt(Date.now());
        }
        if (!riderAlertShownRef.current) {
          if (shouldShowRiderFoundAlert(data)) {
            setShowRiderFound(true);
          }
          riderAlertShownRef.current = true;
        }
      } else if (statusNum === 2) {
        // Keep last good drop-off ETA across booking-details polls; get_eta owns updates.
        dispatch(setRiderDetails(rider_details));
        applyBookingVehicle(data, rider_details);
      } else {
        setRiderEta(null);
        setRiderEtaReceivedAt(0);
      }

      if (statusNum === 1 || statusNum === 2) {
        applyBookingVehicle(data, rider_details);
      } else if (statusNum !== 5) {
        setBookingVehicle(null);
      }

      // The booking-details response already carries the rider's live GPS
      // coordinates inside rider_details (current_lat / current_long).
      if (
        (statusNum === 1 || statusNum === 2) &&
        rider_details?.current_lat &&
        rider_details?.current_long
      ) {
        // The 1 s location poll is the live source; only use this (older,
        // slower) copy when that poll has gone quiet.
        if (Date.now() - lastFastFixAtRef.current > 4000) {
          setRiderLocation({
            lat: rider_details.current_lat,
            long: rider_details.current_long,
          });
        }
      } else if (statusNum !== 1 && statusNum !== 2) {
        setRiderLocation(null);
      }

      if (statusNum === 4) {
        clearTransientBookingUi();
        setShowWaitingBanner(false);
        setRiderLocation(null);
        dispatch(clearBookingState());
        return;
      }

      if (statusNum === 3) {
        // Keep the completed booking saved until the Rating screen submits or
        // skips, so a reload before rating still brings the rating back.
        clearTransientBookingUi();
        setRiderLocation(null);

        navigation.reset({
          index: 0,
          routes: [
            {
              name: 'RatingScreen',
              params: { bookingDetails: data },
            },
          ],
        });
      }
    }
  };

  useEffect(() => {
    handleGetBookingDetails();
  }, [getBookingDetails.response, getBookingDetails.error]);

  // Poll booking details when confirmed
  useEffect(() => {
    if (!activeBooking?.id) {
      return;
    }

    let intervalId;
    const intervalTime = bookingStatus === 0 ? 1000 : 2000;

    intervalId = setInterval(() => {
      triggerGetBookingDetails();
      setEtaStaleTick(t => t + 1);
    }, intervalTime);

    return () => {
      clearInterval(intervalId);
    };
  }, [bookingStatus, activeBooking?.id, isOnline]);

  // push notification received (foreground) or tapped: fetch the latest
  // status now instead of waiting for the next poll tick.
  const pushRefreshRef = useRef(null);
  pushRefreshRef.current = () => {
    if (activeBooking?.id) {
      triggerGetBookingDetails();
    }
  };
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(PUSH_BOOKING_UPDATE_EVENT, () =>
      pushRefreshRef.current?.(),
    );
    return () => sub.remove();
  }, []);

  // reconnect resync: the moment connectivity comes back while a booking
  // is active, immediately fetch the latest status instead of waiting up to
  // 2s for the next interval tick. This is what actually fixes the customer
  // being stuck on "Waiting for the Rider..." after the ride already moved
  // on while they were offline.
  useEffect(() => {
    const cameBackOnline = isOnline && !wasOnlineRef.current;
    wasOnlineRef.current = isOnline;

    if (!cameBackOnline) {
      return;
    }
    if (activeBooking?.id) {
      console.log('🔄 Back online — resyncing booking status immediately');
      checkActiveBooking.makePostRequest(
        Constants.ENDPOINT.GET_BOOKING_DETAILS,
        {
          booking_id: activeBooking.id,
          customer_id: userInfo?.id,
          include_rider_eta: '1',
        },
      );
      triggerGetBookingDetails();
    } else {
      discoverOngoingBookingFromServer();
    }
  }, [
    isOnline,
    activeBooking?.id,
    userInfo?.id,
    discoverOngoingBookingFromServer,
  ]);

  //UPDATE BOOKING STATUS
  const triggerUpdateBookingStatus = async () => {
    if (updateBookingStatus.loading) {
      return;
    }
    if (!activeBooking?.id) {
      // Nothing left to cancel (already cancelled or cleared).
      setPenaltyPreview(null);
      return;
    }

    // cancelling is also an explicit user action that must reach the
    // server — block it offline rather than let it silently no-op.
    const online = await checkIsOnline();
    if (!online) {
      Alert.alert(OFFLINE_ALERT_TITLE, OFFLINE_ALERT_MESSAGE);
      return;
    }

    const postdata = {
      customer_id: userInfo?.id,
      booking_id: activeBooking?.id,
      status: '4',
    };
    updateBookingStatus.makePostRequest(
      Constants.ENDPOINT.UPDATE_BOOKING_STATUS,
      postdata,
    );
  };

  const finishFullCancel = () => {
    // Close the "Cancel Booking" dialog: left open, a second Yes sent a cancel
    // with no booking id ("Booking id is required").
    setPenaltyPreview(null);
    setCancelPreviewLoading(false);
    dispatch(clearBookingState());
    riderAlertShownRef.current = false;
    setShowWaitingBanner(false);
    // Reset selections
    setSelectedPromo(null);
    setNoteToRider('');
    setRiderLocation(null);
    clearTransientBookingUi();
  };

  // Full cancel entry point. Advance bookings always use cancel_advance:
  // preview first (dialog shows a loading state), then exactly one dialog.
  // Only instant bookings use update_status. `confirm` shows the free dialog;
  // without it a free preview cancels straight away. `advance` forces the
  // preview (update_status answered 409 use_cancel_advance).
  const requestFullCancel = async (bookingIdOverride, confirm, advance) => {
    const online = await checkIsOnline();
    if (!online) {
      Alert.alert(OFFLINE_ALERT_TITLE, OFFLINE_ALERT_MESSAGE);
      return;
    }
    const cancelInstant = () =>
      confirm
        ? setPenaltyPreview(instantCancelPreview(activeBooking?.id))
        : triggerUpdateBookingStatus();
    const booking = advance
      ? { ...activeBooking, is_advance: true }
      : activeBooking;
    const path = cancelRoute(booking, scheduledAt, bookingIdOverride);
    if (path === 'update_status') {
      cancelInstant();
      return;
    }
    // Never free-cancel an advance booking without a successful preview.
    const failed = { booking_id: bookingIdOverride ?? null, failed: true };
    if (path === 'error') {
      setPenaltyPreview(failed);
      return;
    }
    setPenaltyPreview(null);
    setCancelPreviewLoading(true);
    const outcome = cancelPreviewOutcome(
      await cancelAdvance.makePostRequest(Constants.ENDPOINT.CANCEL_ADVANCE, {
        booking_id: bookingIdOverride ?? activeBooking.id,
        customer_id: userInfo?.id,
        preview: true,
      }),
    );
    setCancelPreviewLoading(false);
    if (outcome.kind === 'replaced') {
      // re-pooled by a rider cancel: cancel the new booking instead
      const next = bookingIdOverride
        ? null
        : await resolveReplacedId(activeBooking.id);
      if (next) {
        requestFullCancel(next.id, confirm);
        return;
      }
      finishFullCancel();
      return;
    }
    if (outcome.kind === 'instant' && !advance) {
      cancelInstant(); // backend: not an advance booking, so no fee applies
      return;
    }
    if (outcome.kind !== 'ready') {
      setPenaltyPreview(failed);
      return;
    }
    if (outcome.preview.penalty_applies || confirm) {
      setPenaltyPreview(outcome.preview);
      return;
    }
    // free cancel: still go through cancel_advance so cancelled_by is recorded
    confirmPenaltyCancel(outcome.preview.booking_id ?? bookingIdOverride);
  };

  const confirmPenaltyCancel = async bookingIdOverride => {
    const online = await checkIsOnline();
    if (!online) {
      Alert.alert(OFFLINE_ALERT_TITLE, OFFLINE_ALERT_MESSAGE);
      return;
    }
    setPenaltyLoading(true);
    const targetId =
      bookingIdOverride ?? penaltyPreview?.booking_id ?? activeBooking?.id;
    setCancelPreviewLoading(false);
    const { error } = await cancelAdvance.makePostRequest(
      Constants.ENDPOINT.CANCEL_ADVANCE,
      { booking_id: targetId, customer_id: userInfo?.id },
    );
    setPenaltyLoading(false);
    setPenaltyPreview(null);
    if (error && /no longer be cancelled/i.test(String(error))) {
      // re-pooled by a rider cancel: preview + cancel the new booking (its
      // penalty can differ, so ask again rather than cancel blindly)
      const next = await resolveReplacedId(targetId);
      if (next) {
        requestFullCancel(next.id);
        return;
      }
      // Already cancelled or finished elsewhere: just clear the stale card.
      finishFullCancel();
      return;
    }
    if (error) {
      setAlertMessage(error);
      setShowAlert(true);
      return;
    }
    finishFullCancel();
  };

  const handleUpdateBookingStatus = () => {
    const err = updateBookingStatus.error;
    if (updateStatusCancelOutcome({ error: err }) === 'use_cancel_advance') {
      isCancellingToConfirmRef.current = false;
      requestFullCancel(undefined, true, true); // fee due: priced dialog
      return;
    }
    if (updateBookingStatus.error) {
      if (!updateBookingStatus.isOffline) {
        setAlertMessage(updateBookingStatus.error);
        setShowAlert(true);
      }
      return;
    }

    if (!updateBookingStatus.response) {
      return;
    }

    const results = updateBookingStatus.response;
    AppUtil.debugDeep(results);

    if (results?.code === 200) {
      // check if this cancel was triggered by "go back to confirm" or a full cancel
      if (isCancellingToConfirmRef.current) {
        console.log('🔄 Cancelled booking to return to confirm screen');
        setPenaltyPreview(null);
        dispatch(setActiveBooking(null));
        dispatch(setIsConfirmed(false));
        dispatch(setIsBooked(true)); // keep fare breakdown visible
        setShowWaitingBanner(false);
        isCancellingToConfirmRef.current = false; // reset the flag
      } else {
        // Full cancel — clear everything and go back to the start
        console.log('🗑️ Full booking cancel');
        finishFullCancel();
      }
    }
  };

  useEffect(() => {
    handleUpdateBookingStatus();
  }, [updateBookingStatus.response, updateBookingStatus.error]);

  // Note: rider live location is no longer fetched from a separate endpoint —
  // it comes bundled inside rider_details on the existing booking-details
  // poll (see handleGetBookingDetails above), which already runs every 1-2s
  // while a booking is active. This mirrors your backend, which returns
  // current_lat/current_long as part of the rider object on get_details/.

  const openInputLocation = (extra = {}) => {
    navigation.navigate('InputLocation', {
      ...extra,
      pickup: pickupLocation,
      dropoff: dropoffLocation,
      onPickupSelect: location => {
        dispatch(setPickupLocation(location));
        if (extra.returnAfterPickup || (bookLater.enabled && scheduledAt)) {
          setPickupConfirmPending(true);
        }
      },
      onDropoffSelect: location => dispatch(setDropoffLocation(location)),
      // X buttons on the location screen clear the saved points too.
      onPickupClear: () => dispatch(setPickupLocation(null)),
      onDropoffClear: () => dispatch(setDropoffLocation(null)),
    });
  };

  const handleAdvanceBookingPress = async () => {
    if (!bookLater.enabled) {
      return;
    }
    const online = await checkIsOnline();
    if (!online) {
      Alert.alert(OFFLINE_ALERT_TITLE, OFFLINE_ALERT_MESSAGE);
      return;
    }
    // Check the open advance booking limit before any location/date steps.
    if (!scheduledAt && userInfo?.id) {
      const { response } = await advanceLimitCheck.makePostRequest(
        Constants.ENDPOINT.GET_UPCOMING_BOOKINGS,
        { customer_id: userInfo.id, page: 1 },
      );
      const list = response?.data?.bookings;
      if (Array.isArray(list)) {
        const now = Date.now();
        const openCount = list.filter(b => {
          if (!b?.is_advance) {
            return false;
          }
          const status = Number(b.status);
          if (status !== 5 && status !== 1) {
            return false;
          }
          const hasRider =
            b.rider_assigned === true ||
            Boolean(b.rider_details && b.rider_details.id);
          const pickupMs = new Date(b.scheduled_pickup_at).getTime();
          return hasRider || !(pickupMs < now);
        }).length;
        if (openCount >= ADVANCE_MAX_OPEN) {
          setAlertMessage(
            `You can have at most ${ADVANCE_MAX_OPEN} open advance bookings`,
          );
          setShowAlert(true);
          return;
        }
      }
    }
    setAdvanceBookingFlow(true);
    if (!scheduledAt) {
      if (paymentBeforeScheduleRef.current === null) {
        paymentBeforeScheduleRef.current = selectedPayment;
      }
      setSelectedPayment('cash');
    }
    // Flow: pick up and drop off first, then the date and time.
    if (!pickupLocation || !dropoffLocation) {
      openInputLocation({ focusDropoff: Boolean(pickupLocation) });
      return;
    }
    if (!scheduledAt) {
      setShowPickDate(true);
    }
  };

  const handlePickDateConfirm = date => {
    setScheduledAt(date);
    setShowPickDate(false);
    setSelectedPayment('cash');
    setPickupConfirmPending(false);
    // Both points set: fetch fare and show confirm step (same as instant Book).
    if (pickupLocation && dropoffLocation) {
      setAutoBookAfterSchedule(true);
      return;
    }
    // Remember the date so it survives the trip to the location screen.
    pendingScheduleRef.current = date;
    openInputLocation({ returnAfterPickup: true, focusDropoff: true });
  };

  // Back from the location screen with both points: restore the chosen time
  // and fetch fare for the confirm step.
  const pendingScheduleRef = useRef(null);
  useEffect(() => {
    const pending = pendingScheduleRef.current;
    if (!pending || !pickupLocation || !dropoffLocation || isBooked) {
      return;
    }
    pendingScheduleRef.current = null;
    setScheduledAt(pending);
    setAdvanceBookingFlow(true);
    setPickupConfirmPending(false);
    setAutoBookAfterSchedule(true);
  }, [pickupLocation, dropoffLocation]);

  // Advance booking: date confirmed with both points set → inquire fare, then
  // BottomModal shows breakdown + Confirm (user taps Confirm to create).
  useEffect(() => {
    if (autoBookAfterSchedule && scheduledAt) {
      setAutoBookAfterSchedule(false);
      triggerInquireBooking();
    }
  }, [autoBookAfterSchedule, scheduledAt]);

  const handleChoosePickup = () => {
    if (!dropoffLocation) {
      openInputLocation({ focusDropoff: true });
      return;
    }
    if (scheduledAt) {
      // date-first order: date is set, go on to drop-off
      setPickupConfirmPending(false);
      openInputLocation({ returnAfterPickup: true, focusDropoff: true });
      return;
    }
    setShowPickDate(true);
  };

  // Figma frame 91: map + "Choose this pick up" panel while the date is unset
  const showChoosePickupPanel =
    advanceBookingFlow &&
    bookLater.enabled &&
    Boolean(pickupLocation) &&
    (!scheduledAt || pickupConfirmPending) &&
    !isBooked &&
    // 4 = last booking cancelled; Home is idle again (same as BottomModal)
    (bookingStatus === 0 || bookingStatus === 4);

  const pickDatePromptedRef = useRef(false);
  useEffect(() => {
    if (!advanceBookingFlow || !bookLater.enabled || scheduledAt) {
      if (scheduledAt) {
        pickDatePromptedRef.current = false;
      }
      return;
    }
    if (pickupLocation && dropoffLocation && !pickDatePromptedRef.current) {
      pickDatePromptedRef.current = true;
      setShowPickDate(true);
    }
  }, [
    advanceBookingFlow,
    bookLater.enabled,
    pickupLocation,
    dropoffLocation,
    scheduledAt,
  ]);

  useEffect(() => {
    if (scheduledAt) {
      if (paymentBeforeScheduleRef.current === null) {
        paymentBeforeScheduleRef.current = selectedPayment;
      }
      setSelectedPayment('cash');
    } else if (paymentBeforeScheduleRef.current !== null) {
      setSelectedPayment(paymentBeforeScheduleRef.current);
      paymentBeforeScheduleRef.current = null;
    }
  }, [scheduledAt]);

  useFocusEffect(
    React.useCallback(() => {
      if (bookLater.enabled) {
        bookLater.refetch();
      }
    }, [bookLater.enabled]),
  );

  const handleAdvanceAcceptedClose = () => {
    const riderId = getAssignedRiderId(activeBooking, riderDetails);
    const ackKey = advanceAcceptedAckKey(activeBooking?.id, riderId);
    if (ackKey) {
      dispatch(addAcknowledgedScheduledId(ackKey));
    }
    setShowAdvanceAccepted(false);
  };

  const scheduledForModal =
    scheduledAt ||
    activeBooking?.scheduled_pickup_at ||
    activeBooking?.scheduled_at;
  const scheduledDateObj = scheduledForModal
    ? new Date(scheduledForModal)
    : null;

  const statusNum = Number(bookingStatus);
  const riderArrived =
    statusNum === 1 &&
    (Boolean(riderArrivedAt) || riderEta?.state === 'arrived');
  const confirmedBookingView =
    riderArrived || statusNum === 2 || statusNum === 3;
  // While the rider is on the way, the ETA banner (51) and the Safety Guide
  // chip (26) float over the map just above the trip sheet (see their `bottom`
  // styles below). The map counts that strip as covered when framing the rider.
  const floatingAboveSheet =
    !confirmedBookingView && (statusNum === 1 || statusNum === 2)
      ? 15 + (showWaitingBanner ? 59 : 0) + 26
      : 0;

  const etaBannerText = riderArrived
    ? 'Your Rider has arrived'
    : statusNum === 1
    ? getRiderEtaText(riderEta, riderEtaReceivedAt) ?? statusMessages[1]
    : statusNum === 2
    ? getDropoffEtaText(riderEta, riderEtaReceivedAt)
    : statusNum === 5
    ? hasRider(activeBooking, riderDetails) && scheduledDateObj
      ? `Your Rider will pick you up at ${formatScheduledTimeLabel(
          scheduledDateObj,
        )}`
      : statusMessages[0]
    : statusMessages[bookingStatus] || '';
  // re-pooled booking: show its new reference on the card banner
  const bannerText =
    activeBooking?.replaces && activeBooking?.ref_code && etaBannerText
      ? `${etaBannerText}
New reference: ${activeBooking.ref_code}`
      : etaBannerText;
  if (statusNum === 1 || statusNum === 2) {
    void etaStaleTick;
  }

  // Pick up advance bookings a rider accepted while nothing is tracked here,
  // then reuse the normal restore path (get_details → accepted modal / ETA).
  useAdvanceBookingDiscovery({
    customerId: userInfo?.id,
    // Runs even with a saved booking: the server's under-way trip (1/2) wins
    // over a different saved one; otherwise only adopt when nothing is tracked.
    enabled: bookLater.enabled && !checkActiveBooking.loading,
    isOnline,
    onFound: booking => {
      if (
        minimizedAdvanceBookingIds.includes(String(booking.id)) ||
        String(booking.id) === String(activeBooking?.id) ||
        staleBookingIdsRef.current.has(bookingKey(booking))
      ) {
        return;
      }
      const underWay = [1, 2].includes(Number(booking.status));
      if (activeBooking?.id || isBooked) {
        if (!underWay) {
          return;
        }
        console.log(
          '🔁 Replacing saved booking',
          activeBooking?.id,
          'with',
          booking.id,
        );
        dispatch(clearBookingState());
        clearTransientBookingUi();
        riderAlertShownRef.current = false;
      }
      dispatch(
        setPickupLocation({
          address: booking.pickup_location,
          description: booking.pickup_location,
          lat: booking.pickup_lat,
          long: booking.pickup_long,
        }),
      );
      dispatch(
        setDropoffLocation({
          address: booking.dropoff_location,
          description: booking.dropoff_location,
          lat: booking.dropoff_lat,
          long: booking.dropoff_long,
        }),
      );
      setIsRestoringBooking(true);
      checkActiveBooking.makePostRequest(
        Constants.ENDPOINT.GET_BOOKING_DETAILS,
        {
          booking_id: booking.id,
          customer_id: userInfo?.id,
        },
      );
    },
  });

  // Live map: the rider's position every second (booking details, polled every
  // 2 s, only seeds it and covers for this poll if it fails).
  useRiderLocationPoll({
    bookingId: activeBooking?.id,
    customerId: userInfo?.id,
    enabled: isOnline && (statusNum === 1 || statusNum === 2),
    onFix: fix => {
      lastFastFixAtRef.current = Date.now();
      // Same fix again: keep its first timing, only note the rider's phone
      // has reported in since (that is how the map knows they are stopped).
      setRiderLocation(prev =>
        prev && prev.id === fix.id
          ? fix.heardAt != null && fix.heardAt > (prev.heardAt || 0)
            ? { ...prev, heardAt: fix.heardAt }
            : prev
          : fix,
      );
    },
  });

  useRiderEtaPoll({
    bookingId: activeBooking?.id,
    customerId: userInfo?.id,
    enabled:
      isOnline && ((statusNum === 1 && !riderArrived) || statusNum === 2),
    status: statusNum,
    onEta: eta => {
      setRiderEta(prev => (statusNum === 2 ? keepDropoffEta(prev, eta) : eta));
      if (statusNum !== 2 || (eta && (!eta.leg || eta.leg === 'dropoff'))) {
        setRiderEtaReceivedAt(Date.now());
      }
    },
  });

  // Once a booking has been accepted (status 1-4, or a rider assigned) it can
  // never be "unaccepted" again, even if a late/stale response or a transient
  // Redux reset briefly reports status 0. Latch it per booking id.
  const acceptedBookingIdsRef = useRef(new Set());
  const hasRiderNow =
    Boolean(activeBooking?.rider_assigned) ||
    Boolean(riderDetails && Object.keys(riderDetails).length);
  if (
    activeBooking?.id &&
    ([1, 2, 3, 4].includes(statusNum) ||
      Boolean(activeBooking?.rider_assigned) ||
      (statusNum === 5 && hasRiderNow))
  ) {
    acceptedBookingIdsRef.current.add(bookingKey(activeBooking));
  }
  const bookingEverAccepted =
    Boolean(activeBooking?.id) &&
    acceptedBookingIdsRef.current.has(bookingKey(activeBooking));
  const stillUnaccepted =
    Boolean(activeBooking?.id) &&
    !bookingEverAccepted &&
    (statusNum === 0 || (statusNum === 5 && !hasRiderNow));

  const showAcceptedAdvanceTracking =
    bookLater.enabled &&
    statusNum === 5 &&
    hasRiderNow &&
    Boolean(activeBooking?.is_advance) &&
    isConfirmed;

  const noRiders = useNoRidersTimer({
    booking: activeBooking,
    waiting: stillUnaccepted,
    serverOffsetMs: bookLater.serverOffsetMs,
  });

  const handleNoRidersTryAgain = async () => {
    if (!stillUnaccepted) {
      return;
    }
    const online = await checkIsOnline();
    if (!online) {
      Alert.alert(OFFLINE_ALERT_TITLE, OFFLINE_ALERT_MESSAGE);
      return;
    }
    setRetryLoading(true);
    setNoRidersError('');
    const { response, error } = await retryBooking.makePostRequest(
      Constants.ENDPOINT.RETRY_BOOKING,
      { booking_id: activeBooking?.id, customer_id: userInfo?.id },
    );
    setRetryLoading(false);
    if (error) {
      setNoRidersError(
        /404/.test(String(error))
          ? 'Try Again is not available yet. Please try later.'
          : error,
      );
      return;
    }
    setShowWaitingBanner(true);
    // retry resets pooled_at on the server and returns it
    noRiders.restart(response?.data?.pooled_at);
  };

  const handlePromoSelect = promo => {
    setSelectedPromo(promo);
    console.log('Selected promo:', promo);
  };

  const handleNoteSave = note => {
    setNoteToRider(note);
    console.log('Note to rider:', note);
  };

  // show loading indicator while restoring
  if (isRestoringBooking) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>
            Checking for active bookings...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <>
      {alertMessage ? (
        <AlertBox
          {...(/already have a booking|ongoing booking/i.test(alertMessage)
            ? { icon: 'alert-outline' }
            : { title: 'Error' })}
          message={alertMessage}
          visible={showAlert}
          setVisible={setShowAlert}
        />
      ) : null}
      {pushNotice ? (
        <AlertBox
          title="Booking update"
          message={pushNotice.message}
          visible={showPushNotice}
          setVisible={setShowPushNotice}
          confirmText="OK"
          onConfirm={pushNotice.onConfirm}
        />
      ) : null}
      <View style={styles.container}>
        <AppMap
          initialLat={currentLocation.latitude}
          initialLong={currentLocation.longitude}
          locationReady={locationReady}
          firstMarkerLat={bookingStatus === 2 ? null : pickupLocation?.lat}
          firstMarkerLong={bookingStatus === 2 ? null : pickupLocation?.long}
          secondMarkerLat={dropoffLocation?.lat}
          secondMarkerLong={dropoffLocation?.long}
          riderMarkerLat={riderLocation?.lat}
          riderMarkerLong={riderLocation?.long}
          riderFixAt={riderLocation?.at}
          riderFixId={riderLocation?.id}
          riderHeardAt={riderLocation?.heardAt}
          bottomInset={modalHeight + floatingAboveSheet}
          bookingStatus={bookingStatus}
          interactive
          style={styles.map}
        />

        <TouchableOpacity
          style={styles.profileButton}
          onPress={handleTopRightPress}>
          <Image
            source={require('@/Assets/Common/HomeScreen/Profile_Icon_1.png')}
            style={styles.iconImage}
          />
        </TouchableOpacity>

        <RiderFoundAlertBox
          visible={showRiderFound}
          onClose={() => setShowRiderFound(false)}
          riderName={
            riderDetails
              ? `${riderDetails.ekyc_details?.first_name} ${riderDetails.ekyc_details?.last_name}`
              : ''
          }
          plateNumber={bookingVehicle?.plateNumber || ''}
          vehicle={bookingVehicle?.label || ''}
          imageSource={
            riderDetails?.ekyc_details?.selfie
              ? { uri: riderDetails.ekyc_details.selfie }
              : require('@/Assets/Common/Default_Profile.png')
          }
        />

        {showSuccess && (
          <SuccessAlertBox
            visible={showSuccess}
            onClose={() => setShowSuccess(false)}
            imageSource={require('@/Assets/Common/Check.png')}
            title="Success"
            message="You are now successfully Login."
          />
        )}

        {/* persistent, non-blocking offline banner — replaces alert-spam
            with a single quiet indicator that clears itself on reconnect. */}
        {!isOnline && (
          <View style={[styles.offlineBanner, { top: 60 }]}>
            <Text style={styles.offlineBannerText}>
              No internet connection — updates paused
            </Text>
          </View>
        )}

        {/* New accounts: a standing reminder of what is needed before booking. */}
        {!profileComplete && userInfo?.id && statusNum === 0 && (
          <TouchableOpacity
            style={[styles.profileBanner, { top: isOnline ? 60 : 104 }]}
            onPress={() => navigation.navigate('CompleteProfileScreen')}
            accessibilityRole="button">
            <Text style={styles.profileBannerText}>
              Complete your profile to start booking ›
            </Text>
          </TouchableOpacity>
        )}

        {showWaitingBanner && !confirmedBookingView && (
          <View style={[styles.banner, { bottom: modalHeight + 15 }]}>
            <Text style={styles.bannerText}>{bannerText}</Text>
          </View>
        )}

        {(statusNum === 1 || statusNum === 2) && !confirmedBookingView && (
          <TouchableOpacity
            testID="safety-guide-chip"
            style={[
              styles.safetyChip,
              { bottom: modalHeight + 15 + (showWaitingBanner ? 59 : 0) },
            ]}
            onPress={() => setShowSafetyGuide(true)}>
            <Text style={styles.safetyChipText}>Safety Guide</Text>
          </TouchableOpacity>
        )}
        {statusNum === 2 && <EmergencyButton style={styles.emergencyButton} />}
        <SafetyGuideModal
          visible={showSafetyGuide}
          onClose={() => setShowSafetyGuide(false)}
        />
        <NoRidersAvailableModal
          visible={
            noRiders.expired &&
            stillUnaccepted &&
            !penaltyPreview &&
            !cancelPreviewLoading
          }
          loading={retryLoading}
          errorText={noRidersError}
          onTryAgain={handleNoRidersTryAgain}
          onCancelBooking={() => {
            setNoRidersError('');
            if (!stillUnaccepted) {
              return;
            }
            requestFullCancel();
          }}
        />
        <CancelPenaltyModal
          visible={Boolean(penaltyPreview) || cancelPreviewLoading}
          checking={cancelPreviewLoading}
          failed={Boolean(penaltyPreview?.failed)}
          penaltyAmount={penaltyPreview?.penalty_amount}
          prettyPenaltyAmount={penaltyPreview?.pretty_penalty_amount}
          penaltyApplies={Boolean(penaltyPreview?.penalty_applies)}
          penaltyPercent={
            penaltyPreview?.cancellation_policy
              ?.passenger_cancel_penalty_percent
          }
          loading={penaltyLoading}
          onYes={() => {
            const action = cancelYesAction(
              penaltyPreview,
              penaltyLoading || cancelPreviewLoading,
            );
            if (action === 'none' || !cancelSubmitGuard.begin()) {
              return;
            }
            const finishSubmit = () => cancelSubmitGuard.end();
            if (action === 'penalty') {
              confirmPenaltyCancel().finally(finishSubmit);
              return;
            }
            // free: re-checks then cancels; retry: previews again
            requestFullCancel(
              penaltyPreview?.booking_id,
              action === 'retry',
            ).finally(finishSubmit);
          }}
          onNo={() => setPenaltyPreview(null)}
        />

        <PickDateModal
          visible={showPickDate}
          onClose={() => setShowPickDate(false)}
          onConfirm={handlePickDateConfirm}
          minLeadMinutes={bookLater.minLeadMinutes}
          maxWindowDays={bookLater.maxWindowDays}
          serverOffsetMs={bookLater.serverOffsetMs}
          leadTimeSubtitleHours={bookLater.leadTimeSubtitleHours}
        />

        <AdvanceBookingAcceptedModal
          visible={showAdvanceAccepted}
          onClose={handleAdvanceAcceptedClose}
          riderName={
            riderDetails
              ? `${riderDetails.ekyc_details?.first_name || ''} ${
                  riderDetails.ekyc_details?.last_name || ''
                }`.trim()
              : ''
          }
          plateNumber={bookingVehicle?.plateNumber || ''}
          vehicleLabel={bookingVehicle?.label || ''}
          imageSource={
            riderDetails?.ekyc_details?.selfie
              ? { uri: riderDetails.ekyc_details.selfie }
              : require('@/Assets/Common/Default_Profile.png')
          }
          dateText={
            scheduledDateObj
              ? formatScheduledDateLabel(scheduledDateObj)
              : 'Today'
          }
          timeText={
            scheduledDateObj ? formatScheduledTimeLabel(scheduledDateObj) : ''
          }
          pickup={shortenAddress(
            pickupLocation?.address ||
              pickupLocation?.description ||
              activeBooking?.pickup_location,
          )}
          dropoff={shortenAddress(
            dropoffLocation?.address ||
              dropoffLocation?.description ||
              activeBooking?.dropoff_location,
          )}
          noticeText={bookLater.noticeText}
          penaltyPercent={
            activeBooking?.cancellation_policy?.passenger_cancel_penalty_percent
          }
        />

        {showChoosePickupPanel && (
          <ChoosePickupPanel
            onLayout={e => setModalHeight(e.nativeEvent.layout.height)}
            address={pickupLocation?.address || pickupLocation?.description}
            onAddressPress={() =>
              openInputLocation({
                returnAfterPickup: true,
                focusDropoff: false,
              })
            }
            onChoose={handleChoosePickup}
          />
        )}

        {!showChoosePickupPanel &&
          (bookingStatus === 0 ||
            bookingStatus === 4 ||
            bookingStatus === 5) && (
            <BottomModal
              onLayout={e => setModalHeight(e.nativeEvent.layout.height)}
              selectedService={selectedService}
              onBookPressed={onBookPressed}
              pickup={pickupLocation}
              dropoff={dropoffLocation}
              onPickupChange={location => {
                dispatch(setPickupLocation(location));
                // Advance Booking: a pickup changed from the Home summary while
                // a date is set must also be confirmed ("Choose this pick up").
                if (bookLater.enabled && scheduledAt && !isBooked) {
                  setAdvanceBookingFlow(true);
                  setPickupConfirmPending(true);
                }
              }}
              onDropoffChange={location =>
                dispatch(setDropoffLocation(location))
              }
              onChangeService={() => setShowServiceModal(true)}
              onInquireBooking={() => {
                if (requireCompleteProfile()) {
                  triggerInquireBooking();
                }
              }}
              onCreateBooking={triggerCreateBooking}
              onCancelBooking={() => requestFullCancel()}
              // Cancel while waiting: confirm, then a full cancel back to a clean
              // Home (it used to drop back to the fare/confirm screen).
              // One designed dialog (never the phone's native one), chosen
              // by the cancel_advance preview: free or with penalty.
              onBackToConfirm={() => requestFullCancel(undefined, true)}
              onBackToEdit={() => {
                dispatch(setIsBooked(false));
                dispatch(setInquireBookingResponse(null));
                setShowWaitingBanner(false);
                // Back from an advance booking confirm: drop the picked date so
                // the Advance Booking button shows again (payment restores itself).
                setScheduledAt(null);
                setAdvanceBookingFlow(false);
                setAutoBookAfterSchedule(false);
                pendingScheduleRef.current = null;
              }}
              isBooked={isBooked}
              isConfirmed={isConfirmed}
              showPaymentModal={showPaymentModal}
              setShowPaymentModal={setShowPaymentModal}
              setShowPromoModal={setShowPromoModal}
              setShowNoteModal={setShowNoteModal}
              selectedPayment={selectedPayment}
              selectedPromo={selectedPromo}
              noteToRider={noteToRider}
              inquireBookingResponse={inquireBookingResponse}
              isLoading={isLoading}
              permissionStatus={permissionStatus}
              // lets the modal disable Book/Confirm buttons while offline
              // too (defense-in-depth on top of the checks in the triggers)
              isOnline={isOnline}
              showAdvanceBooking={
                bookLater.enabled && !scheduledAt && !isBooked && !isConfirmed
              }
              onAdvanceBooking={() => {
                if (requireCompleteProfile()) {
                  handleAdvanceBookingPress();
                }
              }}
              advanceCashOnlyNote={Boolean(scheduledAt) && !isBooked}
              fareIsEstimate={
                isBooked &&
                (Boolean(scheduledAt) ||
                  (Boolean(activeBooking?.is_advance) && statusNum === 5))
              }
              showMinimizeButton={showAcceptedAdvanceTracking}
              onMinimizePress={handleMinimizeAcceptedAdvance}
            />
          )}

        {(bookingStatus === 1 ||
          bookingStatus === 2 ||
          bookingStatus === 3) && (
          <BookingStatusModal
            onLayout={e => setModalHeight(e.nativeEvent.layout.height)}
            visible={bookingStatus !== 0}
            riderDetails={riderDetails}
            bookingDetails={activeBooking}
            bookingStatus={bookingStatus}
            pickup={pickupLocation}
            dropoff={dropoffLocation}
            selectedService={selectedService}
            onChangeService={() => setShowServiceModal(true)}
            vehicle={bookingVehicle}
            confirmedBookingView={confirmedBookingView}
            statusBannerText={
              confirmedBookingView && showWaitingBanner && bannerText
                ? bannerText
                : ''
            }
            showSafetyGuide={
              confirmedBookingView && (statusNum === 1 || statusNum === 2)
            }
            onSafetyGuidePress={() => setShowSafetyGuide(true)}
          />
        )}

        <PaymentMethodModal
          visible={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          selectedPayment={selectedPayment}
          onSelect={method => {
            setSelectedPayment(method);
          }}
        />

        <PromoModal
          visible={showPromoModal}
          onClose={() => setShowPromoModal(false)}
          onSelect={handlePromoSelect}
          selectedPromo={selectedPromo}
          availablePromos={availablePromos}
          isLoading={getPromoList.loading}
        />

        <NoteToRiderModal
          visible={showNoteModal}
          onClose={() => setShowNoteModal(false)}
          onSave={handleNoteSave}
          initialNote={noteToRider}
        />

        <ServiceModal
          visible={showServiceModal}
          onClose={() => setShowServiceModal(false)}
          onSelect={service => {
            dispatch(setSelectedService(service));
            setShowServiceModal(false);
            if (
              pickupLocation &&
              dropoffLocation &&
              service?.id != null &&
              (isBooked || inquireBookingResponse)
            ) {
              triggerInquireBooking(service.id);
            }
          }}
        />
      </View>
    </>
  );
};

export default HomeScreen;

const { width, height } = Dimensions.get('window');

const getStyles = ({ colors }) =>
  StyleSheet.create({
    container: {
      flex: 1,
      position: 'relative',
    },
    map: {
      flex: 1,
      width,
      height,
    },
    safetyChip: {
      position: 'absolute',
      left: 30,
      height: 26,
      paddingHorizontal: 10,
      borderRadius: 4,
      backgroundColor: '#084CF7',
      justifyContent: 'center',
      zIndex: 10,
    },
    safetyChipText: {
      fontFamily: 'Poppins Medium',
      fontSize: 11,
      color: '#FFFFFF',
    },
    emergencyButton: {
      position: 'absolute',
      top: 70,
      right: 92,
      zIndex: 15,
    },
    profileButton: {
      position: 'absolute',
      top: 60,
      right: 28,
      zIndex: 15,
    },
    iconImage: {
      width: 51,
      height: 51,
      resizeMode: 'contain',
    },
    // Figma frame 93: 370x51, 30pt side inset, radius 10, #FEC107
    banner: {
      position: 'absolute',
      left: 30,
      right: 30,
      height: 51,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
      elevation: 999,
    },
    bannerText: {
      fontFamily: 'Poppins Medium',
      fontWeight: '500',
      fontSize: 16,
      color: colors.onPrimary,
      textAlign: 'center',
    },
    offlineBanner: {
      position: 'absolute',
      left: 20,
      right: 100,
      padding: 8,
      borderRadius: 8,
      backgroundColor: colors.error,
      alignItems: 'center',
      zIndex: 20,
      elevation: 999,
    },
    profileBanner: {
      position: 'absolute',
      left: 20,
      right: 100,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: '#084CF7',
      zIndex: 20,
      elevation: 6,
    },
    profileBannerText: {
      fontFamily: 'Poppins Medium',
      fontSize: 12,
      color: '#FFFFFF',
    },
    offlineBannerText: {
      fontWeight: '600',
      fontSize: 12,
      color: colors.primaryLight,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    loadingText: {
      fontFamily: 'Poppins Medium',
      fontSize: 16,
      color: colors.text,
    },
  });
