import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import BookingCard from './Components/BookingCard';
import usePostRequest from '@/Services/Api';
import { AppUtil, Constants } from '@/Utils';
import { useSelector } from 'react-redux';
import { selectUserInfo } from '@/Redux/Slices/userSlice';
import { AlertBox } from '@/Components';
import {
  setDropoffLocation,
  setPickupLocation,
  setSelectedService,
} from '@/Redux/Slices/userSlice';
import {
  getBookingTypeLabel,
  transformBooking,
} from '@/Hooks/bookingTransform';

// Pending advance bookings (status 5, 1 or 2) always go on top: accepted ones
// (rider assigned, or status 1/2) first, then unaccepted, each by pickup time.
// Everything else keeps the backend's order. Works on raw (untransformed) rows.
const isPendingAdvance = b =>
  b?.is_advance && [5, 1, 2].includes(Number(b.status));
const isAcceptedAdvance = b =>
  Number(b.status) !== 5 ||
  !!b.rider_assigned ||
  !!(b.rider_details && Object.keys(b.rider_details).length);
const pickupMs = b => {
  const t = new Date(b?.scheduled_pickup_at).getTime();
  return Number.isNaN(t) ? Infinity : t;
};
export const sortPendingAdvanceFirst = (history = [], upcoming = []) => {
  const seen = new Set(history.map(b => b.id));
  const all = [
    ...history,
    ...upcoming.filter(b => isPendingAdvance(b) && !seen.has(b.id)),
  ];
  const pending = all.filter(isPendingAdvance);
  const rest = history.filter(b => !isPendingAdvance(b));
  const byPickup = (a, b) => pickupMs(a) - pickupMs(b);
  return [
    ...pending.filter(isAcceptedAdvance).sort(byPickup),
    ...pending.filter(b => !isAcceptedAdvance(b)).sort(byPickup),
    ...rest,
  ];
};

const BookingHistoryScreen = () => {
  const { colors } = useTheme();
  const styles = getStyles({ colors });
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const userInfo = useSelector(selectUserInfo);

  const [alertMessage, setAlertMessage] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const [bookingData, setBookingData] = useState([]);

  const getBookingHistory = usePostRequest();
  // History is paginated (10 per page, newest-updated first) and the screen only
  // loads page 1, so pending advance bookings are also pulled from get_upcoming.
  const getUpcoming = usePostRequest();

  // Refetch every time the screen gains focus (first open and on return from
  // Booking Details, e.g. after a cancel). Pinned ordering is applied on reply.
  useFocusEffect(
    React.useCallback(() => {
      triggerGetBookingHistory();
    }, [userInfo?.id]),
  );

  const triggerGetBookingHistory = () => {
    getBookingHistory.makePostRequest(Constants.ENDPOINT.GET_BOOKING_HISTORY, {
      customer_id: userInfo.id,
    });
    getUpcoming.makePostRequest(Constants.ENDPOINT.GET_UPCOMING_BOOKINGS, {
      customer_id: userInfo.id,
    });
  };

  const handleBookingHistory = () => {
    if (getBookingHistory.error) {
      setAlertMessage(getBookingHistory.error);
      setShowAlert(true);
      return;
    }

    if (!getBookingHistory.response) {
      return;
    }

    const result = getBookingHistory?.response;

    if (result?.code === 200 && result?.data?.bookings) {
      const transformedBookings = sortPendingAdvanceFirst(
        result.data.bookings,
        getUpcoming.response?.code === 200
          ? getUpcoming.response?.data?.bookings || []
          : [],
      ).map(transformBooking);

      setBookingData(transformedBookings);
      AppUtil.debugDeep(transformedBookings);
    }
  };

  useEffect(() => {
    handleBookingHistory();
  }, [
    getBookingHistory.response,
    getBookingHistory.error,
    getUpcoming.response,
  ]);

  const handleRebook = item => {
    dispatch(
      setPickupLocation({
        address: item.pickup_location,
        lat: item.pickup_lat,
        long: item.pickup_long,
      }),
    );
    dispatch(
      setDropoffLocation({
        address: item.dropoff_location,
        lat: item.dropoff_lat,
        long: item.dropoff_long,
      }),
    );
    dispatch(
      setSelectedService({
        id: item.booking_type,
        title: getBookingTypeLabel(item.booking_type),
      }),
    );
    navigation.navigate('HomeScreen');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleCardPress = item => {
    navigation.navigate('BookingDetailsScreen', { bookingDetails: item });
  };

  const renderCards = ({ item }) => (
    <TouchableOpacity onPress={() => handleCardPress(item)} activeOpacity={0.8}>
      <BookingCard
        image={item.image}
        title={item.title}
        status={item.status}
        destination={item.destination}
        date={item.date}
        price={item.price}
        penaltyAmount={item.penalty_amount}
        onRebook={() => handleRebook(item)}
      />
    </TouchableOpacity>
  );

  if (getBookingHistory.loading) {
    return (
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={handleBack} style={styles.iconButton}>
              <Image
                source={require('@/Assets/Common/Back_2.png')}
                style={styles.backIcon}
                resizeMode="contain"
              />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Booking History</Text>
            <View style={styles.spacing} />
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading bookings...</Text>
        </View>
      </View>
    );
  }

  if (bookingData.length === 0 && !getBookingHistory.loading) {
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
        <View style={styles.container}>
          <View style={styles.headerContainer}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={handleBack} style={styles.iconButton}>
                <Image
                  source={require('@/Assets/Common/Back_2.png')}
                  style={styles.backIcon}
                  resizeMode="contain"
                />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Booking History</Text>
              <View style={styles.spacing} />
            </View>
          </View>
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No booking history yet</Text>
            <Text style={styles.emptySubtext}>
              Your completed and cancelled rides will appear here
            </Text>
          </View>
        </View>
      </>
    );
  }

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
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={handleBack} style={styles.iconButton}>
              <Image
                source={require('@/Assets/Common/Back_2.png')}
                style={styles.backIcon}
                resizeMode="contain"
              />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Booking History</Text>
            <View style={styles.spacing} />
          </View>
        </View>

        <FlatList
          data={bookingData}
          keyExtractor={item => item.id.toString()}
          renderItem={renderCards}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={getBookingHistory.loading}
          onRefresh={triggerGetBookingHistory}
        />
      </View>
    </>
  );
};

export default BookingHistoryScreen;

const getStyles = ({ colors }) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerContainer: {
      backgroundColor: colors.primary,
      paddingTop: 60,
      paddingBottom: 20,
      paddingHorizontal: 20,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    iconButton: {
      width: 25,
    },
    spacing: {
      width: 25,
    },
    backIcon: {
      width: 23,
      height: 23,
    },
    headerTitle: {
      fontFamily: 'Poppins Regular',
      fontSize: 16,
      fontWeight: '400',
      color: colors.onPrimary,
      textAlign: 'center',
      flex: 1,
    },
    listContent: {
      marginTop: 12,
      paddingBottom: 20,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontFamily: 'Poppins Regular',
      fontSize: 14,
      color: colors.shadow,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyText: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 18,
      color: colors.shadow,
      marginBottom: 8,
    },
    emptySubtext: {
      fontFamily: 'Poppins Regular',
      fontSize: 14,
      color: colors.onSurfaceGrey,
      textAlign: 'center',
    },
  });
