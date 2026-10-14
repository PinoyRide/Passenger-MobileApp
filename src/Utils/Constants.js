const IS_DEV = true;

const PROD_URL = '';
// PR CHECK: revert DEV_URL to remote before opening a PR — do not commit localhost/LAN URLs.
// const DEV_URL = 'https://riderapp.escarez.com/api/';
// Local only — iOS Simulator: 127.0.0.1 | Android Emulator: 10.0.2.2 | Physical device: Mac LAN IP
const DEV_URL = 'http://127.0.0.1:8001/api/';

const BASE_DEV = {
  API_OK: 1,
  API_NOT_OK: 0,
  OTP_ERROR: -7,
  WU_ERROR: 0,
  WU_TIME_OUT_ERROR: -9,

  API_KEY: 'e6b9d7987f6d0633c31556a428a6197ef11f3b5be8ed8b3bc8a16c92e560e775',
  GOOGLE_MAP_API_KEY: 'AIzaSyAlpSoXuJzvo8uR1qbdtbbbk1sx4MHKIQk',
  BASE_URI: IS_DEV ? DEV_URL : PROD_URL,

  ENDPOINT: {
    //AUTH
    LOGIN: 'customers/login/',
    SIGN_UP: 'customers/sign_up/',
    LOGOUT: 'customers/logout/',
    GET_CUSTOMER_DETAILS: 'customers/get_customer_details/',
    //OTP
    GENERATE_LOGIN: 'otp/generate-login/',
    VERIFY_LOGIN: 'otp/verify-login/',
    GENERATE_OTP: 'otp/generate/',
    VERIFY_OTP: 'otp/verify/',
    //BOOKING
    SEARCH_LOCATION: 'booking/search_location/',
    INQUIRE_BOOKING: 'booking/inquire/',
    CREATE_BOOKING: 'booking/create/',
    UPDATE_BOOKING_STATUS: 'booking/update_status_for_customer/',
    GET_BOOKING_HISTORY: 'booking/get_history/',
    GET_BOOKING_DETAILS: 'booking/get_details/',
    GET_BOOKING_CONTACT: 'booking/get_contact/',
    GET_BOOKING_CONFIG: 'booking/get_config/',
    GET_UPCOMING_BOOKINGS: 'booking/get_upcoming/',
    GET_ACTIVE_BOOKING: 'booking/get_customer_active/',
    REPORT_AN_ISSUE: 'booking/report_issue/',
    RATE_BOOKING: 'booking/rate/',
    GET_PROMO_LIST: 'booking/get_promo_list/',
    CHECK_PROMO_CODE: 'booking/check_promo_code/',
    GET_RIDER_LOCATION: 'customers/get_rider_location',

    ADD_TIP: 'booking/add_tip/',
    RETRY_BOOKING: 'booking/retry/',
    CANCEL_ADVANCE: 'booking/cancel_advance/',
    GET_ETA: 'booking/get_eta/',
    //EKYC
    GET_EKYC_URL: 'ekyc/get-ekyc-url/',
    EKYC_CHECK_STATUS: 'ekyc/check_status/',
    //PAYMENT
    QRPH_REQUEST_TO_PAY: 'qrph/request-to-pay/',
    QRPH_CHECK_STATUS: 'qrph/check_status/',

    //MESSAGES (in-app booking chat)
    GET_CONVERSATION: 'messages/conversation/',
    MARK_MESSAGES_READ: 'messages/mark-read/',
    SEND_MESSAGE: 'messages/send/',
    GET_UNREAD_MESSAGE_COUNT: 'messages/unread-count/',
  },

  FEATURE_STATUS: {
    BOOK_LATER: true,
  },

  MODULES_IDENTIFIERS: {},
};

const Constants = { ...BASE_DEV, IS_DEV };

export default Constants;
