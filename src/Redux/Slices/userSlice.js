import { createSlice } from '@reduxjs/toolkit';

// Matches ADVANCE_MAX_OPEN_PER_CUSTOMER on the backend.
const ADVANCE_PARK_LIMIT = 3;

// get_details returns the rider flat (first_name, mobile_no, ...) with no
// ekyc_details; the UI reads ekyc_details.*, so mirror the flat fields there.
const normalizeRiderDetails = rd => {
  if (!rd || typeof rd !== 'object') {
    return rd;
  }
  // backend sends {} for "no rider": store that as no rider at all
  if (Object.keys(rd).length === 0) {
    return null;
  }
  if (rd.ekyc_details) {
    const e0 = rd.ekyc_details;
    const e = e0.selfie
      ? e0
      : {
          ...e0,
          selfie:
            rd.selfie || rd.selfie_pretty || rd.profile_img_pretty || null,
        };
    if (e.pretty_mobile_no) {
      return e === e0 ? rd : { ...rd, ekyc_details: e };
    }
    const raw = String(
      e.mobile_no || rd.pretty_mobile_no || rd.mobile_no || '',
    );
    return {
      ...rd,
      ekyc_details: {
        ...e,
        pretty_mobile_no: raw ? (raw.startsWith('63') ? `+${raw}` : raw) : null,
      },
    };
  }
  if (
    !rd.first_name &&
    !rd.last_name &&
    !rd.mobile_no &&
    !rd.pretty_mobile_no
  ) {
    return rd;
  }
  const mobile = rd.mobile_no ? String(rd.mobile_no) : '';
  return {
    ...rd,
    ekyc_details: {
      first_name: rd.first_name || '',
      middle_name: rd.middle_name || '',
      last_name: rd.last_name || '',
      pretty_mobile_no:
        rd.pretty_mobile_no ||
        (mobile ? (mobile.startsWith('63') ? `+${mobile}` : mobile) : null),
      selfie: rd.selfie || rd.selfie_pretty || rd.profile_img_pretty || null,
    },
  };
};

const initialState = {
  userInfo: null,
  hasShownLoginSuccess: false,
  // The passenger's sign-in token from customers/login: a cash-out needs it
  // (X-Customer-Session). Kept apart from userInfo, which profile updates
  // replace.
  sessionToken: null,
  savedPlaces: [], // Array of saved locations
  // the drop-offs and pick-ups of recent trips (recentPlaces.js)
  recentPlaces: [],

  // ✅ NEW: Customer booking state (persisted across app restarts)
  activeBooking: null,
  bookingStatus: 0,
  riderDetails: null,
  pickupLocation: null,
  dropoffLocation: null,
  selectedService: null,
  isBooked: false,
  isConfirmed: false,
  inquireBookingResponse: null,
  acknowledgedScheduledIds: [],
  // Accepted advance bookings minimized from Home; discovery must not re-open them.
  minimizedAdvanceBookingIds: [],
  // Snapshots for minimized advance bookings (still polled in the background).
  parkedAdvanceBookings: [],
  // Completed bookings the passenger already rated or skipped (no re-prompt).
  ratedBookingIds: [],
  // Promos the passenger has seen on Promo & referrals: the Account page
  // counts the others as "NEW".
  seenPromoIds: [],
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUserInfo: (state, action) => {
      // a different account (or a re-created one after a DB reset) must not
      // inherit remembered booking ids
      if (state.userInfo?.id !== action.payload?.id) {
        state.ratedBookingIds = [];
        state.acknowledgedScheduledIds = [];
        state.minimizedAdvanceBookingIds = [];
        state.parkedAdvanceBookings = [];
        state.seenPromoIds = [];
        state.sessionToken = null;
      }
      state.userInfo = action.payload;
    },
    setSessionToken: (state, action) => {
      state.sessionToken = action.payload || null;
    },
    clearUserInfo: state => {
      state.userInfo = null;
      state.sessionToken = null;
      state.ratedBookingIds = [];
      state.acknowledgedScheduledIds = [];
      state.minimizedAdvanceBookingIds = [];
      state.parkedAdvanceBookings = [];
      state.recentPlaces = [];
    },
    setHasShownLoginSuccess: (state, action) => {
      state.hasShownLoginSuccess = action.payload;
    },

    // Saved Places Actions
    addSavedPlace: (state, action) => {
      const place = action.payload;

      if (!place.label || !place.address || !place.lat || !place.long) {
        console.warn('Invalid place data:', place);
        return;
      }
      state.savedPlaces.push(place);
    },
    updateSavedPlace: (state, action) => {
      const updatedPlace = action.payload;

      if (
        !updatedPlace.label ||
        !updatedPlace.address ||
        !updatedPlace.lat ||
        !updatedPlace.long
      ) {
        console.warn('Invalid place data:', updatedPlace);
        return;
      }

      const index = state.savedPlaces.findIndex(
        place => place.id === updatedPlace.id,
      );
      if (index !== -1) {
        state.savedPlaces[index] = updatedPlace;
      }
    },
    removeSavedPlace: (state, action) => {
      state.savedPlaces = state.savedPlaces.filter(
        place => place.id !== action.payload,
      );
    },
    clearSavedPlaces: state => {
      state.savedPlaces = [];
    },
    setRecentPlaces: (state, action) => {
      state.recentPlaces = Array.isArray(action.payload) ? action.payload : [];
    },

    // ✅ NEW: Customer Booking Actions
    setActiveBooking: (state, action) => {
      state.activeBooking = action.payload;
    },
    setBookingStatus: (state, action) => {
      state.bookingStatus = action.payload;
    },
    setRiderDetails: (state, action) => {
      state.riderDetails = normalizeRiderDetails(action.payload);
    },
    setPickupLocation: (state, action) => {
      state.pickupLocation = action.payload;
    },
    setDropoffLocation: (state, action) => {
      state.dropoffLocation = action.payload;
    },
    setSelectedService: (state, action) => {
      state.selectedService = action.payload;
    },
    setIsBooked: (state, action) => {
      state.isBooked = action.payload;
    },
    setIsConfirmed: (state, action) => {
      state.isConfirmed = action.payload;
    },
    setInquireBookingResponse: (state, action) => {
      state.inquireBookingResponse = action.payload;
    },
    addAcknowledgedScheduledId: (state, action) => {
      const id = action.payload;
      if (!id) {
        return;
      }
      if (!state.acknowledgedScheduledIds.includes(id)) {
        state.acknowledgedScheduledIds.push(id);
      }
      if (state.acknowledgedScheduledIds.length > 50) {
        state.acknowledgedScheduledIds =
          state.acknowledgedScheduledIds.slice(-50);
      }
    },
    clearAcknowledgedScheduledForBooking: (state, action) => {
      const bookingId = String(action.payload ?? '');
      if (!bookingId) {
        return;
      }
      state.acknowledgedScheduledIds = state.acknowledgedScheduledIds.filter(
        id =>
          String(id) !== bookingId && !String(id).startsWith(`${bookingId}:`),
      );
    },
    addMinimizedAdvanceBookingId: (state, action) => {
      const id = String(action.payload ?? '');
      if (!id) {
        return;
      }
      const list = state.minimizedAdvanceBookingIds || [];
      if (!list.includes(id)) {
        list.push(id);
      }
      state.minimizedAdvanceBookingIds = list.slice(-50);
    },
    removeMinimizedAdvanceBookingId: (state, action) => {
      const id = String(action.payload ?? '');
      state.minimizedAdvanceBookingIds = (
        state.minimizedAdvanceBookingIds || []
      ).filter(x => x !== id);
    },
    parkAdvanceBooking: (state, action) => {
      const snapshot = action.payload;
      const bookingId = String(snapshot?.booking?.id ?? '');
      if (!bookingId) {
        return;
      }
      const list = (state.parkedAdvanceBookings || []).filter(
        p => String(p.booking?.id) !== bookingId,
      );
      list.push(snapshot);
      state.parkedAdvanceBookings = list.slice(-ADVANCE_PARK_LIMIT);
    },
    updateParkedAdvanceBooking: (state, action) => {
      const { bookingId, patch } = action.payload || {};
      const id = String(bookingId ?? '');
      if (!id || !patch) {
        return;
      }
      const idx = (state.parkedAdvanceBookings || []).findIndex(
        p => String(p.booking?.id) === id,
      );
      if (idx === -1) {
        return;
      }
      state.parkedAdvanceBookings[idx] = {
        ...state.parkedAdvanceBookings[idx],
        ...patch,
      };
    },
    removeParkedAdvanceBooking: (state, action) => {
      const id = String(action.payload ?? '');
      state.parkedAdvanceBookings = (state.parkedAdvanceBookings || []).filter(
        p => String(p.booking?.id) !== id,
      );
    },
    addRatedBookingId: (state, action) => {
      const id = String(action.payload ?? '');
      if (!id) {
        return;
      }
      const list = state.ratedBookingIds || [];
      if (!list.includes(id)) {
        list.push(id);
      }
      state.ratedBookingIds = list.slice(-50);
    },
    markPromosSeen: (state, action) => {
      const list = (state.seenPromoIds || []).slice();
      (action.payload || []).forEach(raw => {
        const id = String(raw ?? '');
        if (id && !list.includes(id)) {
          list.push(id);
        }
      });
      state.seenPromoIds = list.slice(-200);
    },
    // A rider cancel re-pools the trip under a NEW booking id (old one is
    // cancelled with replaced_by). Swap every saved reference to the new id.
    replaceBookingId: (state, action) => {
      const { oldId, newId, newRefCode } = action.payload || {};
      const from = String(oldId ?? '');
      const to = String(newId ?? '');
      if (!from || !to || from === to) {
        return;
      }
      if (state.activeBooking && String(state.activeBooking.id) === from) {
        state.activeBooking = {
          ...state.activeBooking,
          id: Number(newId),
          ref_code: newRefCode || state.activeBooking.ref_code,
          status: 5,
          replaced_by: null,
          is_replaced: false,
        };
      }
      state.parkedAdvanceBookings = (state.parkedAdvanceBookings || []).map(p =>
        String(p.booking?.id) === from
          ? {
              ...p,
              booking: {
                ...p.booking,
                id: Number(newId),
                ref_code: newRefCode || p.booking.ref_code,
                status: 5,
                replaced_by: null,
                is_replaced: false,
              },
              riderDetails: null,
            }
          : p,
      );
      state.minimizedAdvanceBookingIds = (
        state.minimizedAdvanceBookingIds || []
      ).map(x => (x === from ? to : x));
      // "id:riderId" acks belong to the old rider assignment: drop them so
      // the next rider's accepted modal shows on the new booking.
      state.acknowledgedScheduledIds = (
        state.acknowledgedScheduledIds || []
      ).filter(id => String(id) !== from && !String(id).startsWith(`${from}:`));
    },
    // ✅ Clear all booking state (on completion/cancellation)
    clearBookingState: state => {
      state.activeBooking = null;
      state.bookingStatus = 0;
      state.riderDetails = null;
      state.pickupLocation = null;
      state.dropoffLocation = null;
      state.selectedService = null;
      state.isBooked = false;
      state.isConfirmed = false;
      state.inquireBookingResponse = null;
    },
  },
});

export const {
  setUserInfo,
  setSessionToken,
  clearUserInfo,
  setHasShownLoginSuccess,
  addSavedPlace,
  updateSavedPlace,
  removeSavedPlace,
  clearSavedPlaces,
  setRecentPlaces,
  // ✅ NEW: Booking actions
  setActiveBooking,
  setBookingStatus,
  setRiderDetails,
  addRatedBookingId,
  markPromosSeen,
  setPickupLocation,
  setDropoffLocation,
  setSelectedService,
  setIsBooked,
  setIsConfirmed,
  setInquireBookingResponse,
  addAcknowledgedScheduledId,
  clearAcknowledgedScheduledForBooking,
  replaceBookingId,
  addMinimizedAdvanceBookingId,
  removeMinimizedAdvanceBookingId,
  parkAdvanceBooking,
  updateParkedAdvanceBooking,
  removeParkedAdvanceBooking,
  clearBookingState,
} = userSlice.actions;

// Existing selectors
export const selectUserInfo = state => state.user.userInfo;
export const selectSessionToken = state => state.user.sessionToken;
export const selectHasShownLoginSuccess = state =>
  state.user.hasShownLoginSuccess;
export const selectSavedPlaces = state => state.user.savedPlaces;
export const selectRecentPlaces = state => state.user.recentPlaces || [];

// ✅ NEW: Booking selectors
export const selectActiveBooking = state => state.user.activeBooking;
export const selectBookingStatus = state => state.user.bookingStatus;
export const selectRiderDetails = state => state.user.riderDetails;
export const selectPickupLocation = state => state.user.pickupLocation;
export const selectDropoffLocation = state => state.user.dropoffLocation;
export const selectSelectedService = state => state.user.selectedService;
export const selectIsBooked = state => state.user.isBooked;
export const selectIsConfirmed = state => state.user.isConfirmed;
export const selectInquireBookingResponse = state =>
  state.user.inquireBookingResponse;
export const selectAcknowledgedScheduledIds = state =>
  state.user.acknowledgedScheduledIds;
export const selectMinimizedAdvanceBookingIds = state =>
  state.user.minimizedAdvanceBookingIds || [];
export const selectParkedAdvanceBookings = state =>
  state.user.parkedAdvanceBookings || [];

export default userSlice.reducer;

export const selectRatedBookingIds = state => state.user.ratedBookingIds || [];
export const selectSeenPromoIds = state => state.user.seenPromoIds || [];
