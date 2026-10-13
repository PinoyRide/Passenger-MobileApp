import { createSlice } from '@reduxjs/toolkit';

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
  savedPlaces: [], // Array of saved locations

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
  // Completed bookings the passenger already rated or skipped (no re-prompt).
  ratedBookingIds: [],
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
      }
      state.userInfo = action.payload;
    },
    clearUserInfo: state => {
      state.userInfo = null;
      state.ratedBookingIds = [];
      state.acknowledgedScheduledIds = [];
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
  clearUserInfo,
  setHasShownLoginSuccess,
  addSavedPlace,
  updateSavedPlace,
  removeSavedPlace,
  clearSavedPlaces,
  // ✅ NEW: Booking actions
  setActiveBooking,
  setBookingStatus,
  setRiderDetails,
  addRatedBookingId,
  setPickupLocation,
  setDropoffLocation,
  setSelectedService,
  setIsBooked,
  setIsConfirmed,
  setInquireBookingResponse,
  addAcknowledgedScheduledId,
  clearBookingState,
} = userSlice.actions;

// Existing selectors
export const selectUserInfo = state => state.user.userInfo;
export const selectHasShownLoginSuccess = state =>
  state.user.hasShownLoginSuccess;
export const selectSavedPlaces = state => state.user.savedPlaces;

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

export default userSlice.reducer;

export const selectRatedBookingIds = state => state.user.ratedBookingIds || [];
