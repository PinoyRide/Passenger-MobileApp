import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { selectSavedPlaces } from '@/Redux/Slices/userSlice';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { bottomSpace } from '@/Utils/bottomSpace';
import { formatPeso } from '@/Utils/formatPeso';
import { fareNoteText } from '@/Utils/tripText';
import { modern } from '@/Theme/modern';
import ServiceList, { serviceById } from './Components/ServiceList';
import FindingRider from './Components/FindingRider';

// Line icons (MaterialCommunityIcons), as on the design canvas.
const PAYMENT_METHOD_CONFIG = {
  cash: { label: 'Cash', icon: 'cash' },
  wallet: { label: 'Wallet', icon: 'wallet-outline' },
};

// A place's first part, for the one-line route: "SM Mall of Asia".
const placeName = place =>
  (place?.description || place?.address || '').split(',')[0].trim();
const placeText = place => place?.description || place?.address || '';

// The booking sheet (docs/booking-redesign-spec.md, "BottomModal"). Top to
// bottom: the route, the title with Schedule, the rides, the payment, promo
// and note pills, the fare, and one button. Until pickup and drop-off are
// both set it shows only "Where to?", a search field and the Home, Work and
// Saved shortcuts (the design canvas's first screen, which the owner chose
// over the spec's two fields): no rides, no fares.
// The fare it is given is always the one for the trip on screen (HomeScreen
// prices the trip by itself and drops a fare asked for another one).
const BottomModal = ({
  onLayout,
  services,
  selectedService,
  onSelectService,
  onBackToEdit,
  onInquireBooking,
  onCreateBooking,
  onCancelBooking,
  onBackToConfirm,
  onPickupChange,
  onDropoffChange,
  pickup,
  dropoff,
  isBooked,
  isConfirmed,
  setShowPaymentModal,
  setShowPromoModal,
  setShowNoteModal,
  selectedPayment = 'cash',
  selectedPromo,
  noteToRider,
  inquireBookingResponse,
  fareProblem,
  isLoading,
  isPricing = false,
  isOnline = true,
  showAdvanceBooking = false,
  onAdvanceBooking,
  advanceCashOnlyNote = false,
  fareIsEstimate = false,
  showMinimizeButton = false,
  onMinimizePress,
  searching = false,
}) => {
  // The navigation bar may cover the bottom of the screen: keep the bottom content clear of it
  const { bottom: bottomInset } = useSafeAreaInsets();
  const theme = useTheme();
  const look = modern(theme);
  const styles = getStyles(look, theme.colors.blue ?? '#084CF7');
  const navigation = useNavigation();
  const [showBreakdown, setShowBreakdown] = useState(false);

  const fare = inquireBookingResponse;
  const routeComplete = Boolean(pickup && dropoff);
  const confirming = isBooked && !isConfirmed;
  // The ride can change until the booking is placed, but not while a
  // booking request is on its way (pricing alone does not hold it).
  const ridesLocked = isConfirmed || (isLoading && !isPricing);

  const paymentConfig =
    PAYMENT_METHOD_CONFIG[selectedPayment] || PAYMENT_METHOD_CONFIG.cash;

  // Payment, promo and note. An added promo or note shows as a gold dot after
  // its name, so the three pills keep their width; the payment pill opens a
  // choice, hence its chevron ("Cash ▾").
  const buttons = [
    {
      id: 'payment',
      icon: paymentConfig.icon,
      text: paymentConfig.label,
      chevron: true,
      added: false,
      label: `Payment: ${paymentConfig.label}`,
      onPress: () => setShowPaymentModal(true),
    },
    {
      id: 'promo',
      icon: 'tag-outline',
      text: 'Promo',
      added: Boolean(selectedPromo),
      label: selectedPromo
        ? `Promo ${selectedPromo.code} applied`
        : 'Add a promo',
      onPress: () => setShowPromoModal(true),
    },
    {
      id: 'note',
      icon: 'square-edit-outline',
      text: 'Note',
      added: Boolean(noteToRider),
      label: noteToRider
        ? 'Note to the rider added'
        : 'Add a note to the rider',
      onPress: () => setShowNoteModal(true),
    },
  ];

  // The same three steps as before; only the look changed. "No Internet"
  // moved into the fare caption, so the button always names its action.
  // "Book Motorcycle", "Book Car": the button names the ride it books.
  const ride = serviceById(selectedService?.id);
  const actionButtons = [
    {
      visible: !isBooked,
      title: ride?.short ? `Book ${ride.short}` : 'Book',
      onPress: onInquireBooking,
      // no ride picked yet: Book waits, as it did when the rides were a modal
      disabled:
        !pickup || !dropoff || isLoading || !isOnline || !selectedService,
    },
    {
      visible: confirming,
      title: 'Confirm',
      onPress: onCreateBooking,
      disabled: isLoading || !isOnline || !inquireBookingResponse,
    },
    {
      visible: isConfirmed,
      title: 'Cancel',
      onPress: onBackToConfirm,
      danger: true,
      disabled: isLoading || !isOnline,
    },
  ];
  const action = actionButtons.find(b => b.visible);

  // The line under "Total fare".
  const fareCaption = () => {
    if (!isOnline) {
      return 'No Internet';
    }
    if (fareProblem) {
      return fareProblem;
    }
    if (!selectedService) {
      return 'Choose a ride to see the fare';
    }
    if (!fare) {
      return 'Getting the fare…';
    }
    if (advanceCashOnlyNote) {
      return 'Cash only for advance bookings';
    }
    if (fareIsEstimate) {
      return 'Estimated — final fare may change';
    }
    // "Incl. booking fee · no surge", as far as the fare's answer shows it
    return fareNoteText(fare);
  };
  const caption = fareCaption();
  const figure = fare ? formatPeso(fare.total_amount) : '—';

  const breakdown = fare
    ? [
        { label: 'Fare', value: formatPeso(fare.total_amount_wo_promo) },
        selectedPromo && Number(fare.promo_discount) > 0
          ? {
              label: `Promo ${selectedPromo.code}`,
              value: `−${formatPeso(fare.promo_discount)}`,
            }
          : null,
        { label: 'Total', value: formatPeso(fare.total_amount), strong: true },
      ].filter(Boolean)
    : [];

  // The place picker (InputLocation). `dropoffNow` hands it a drop-off just
  // set here, before this sheet's props have caught up.
  const openPlaces = ({ focusDropoff = false, dropoffNow } = {}) => {
    navigation.navigate('InputLocation', {
      pickup,
      dropoff: dropoffNow || dropoff,
      focusDropoff,
      onPickupSelect: item => onPickupChange?.(item),
      onDropoffSelect: item => onDropoffChange?.(item),
      // X buttons on the location screen clear the saved points too.
      onPickupClear: () => onPickupChange?.(null),
      onDropoffClear: () => onDropoffChange?.(null),
    });
  };

  // Edit: while choosing, change the places; from Confirm, back to choosing.
  const onEdit = confirming ? onBackToEdit : () => openPlaces();

  // Home and Work go straight to the saved place (then ask for the pickup if
  // there is none yet); one not saved yet is added first, as on the place
  // picker. Saved opens the picker, which lists every saved place.
  const savedPlaces = useSelector(selectSavedPlaces) || [];
  const goToSaved = type => {
    const place = savedPlaces.find(p => p.type === type);
    if (!place) {
      navigation.navigate('SaveLocationScreen', { locationType: type });
      return;
    }
    const target = { address: place.address, lat: place.lat, long: place.long };
    onDropoffChange?.(target);
    if (!pickup) {
      openPlaces({ dropoffNow: target });
    }
  };
  const savedLabel = (type, name) => {
    const place = savedPlaces.find(p => p.type === type);
    return place ? `${name}: ${place.address}` : `Add your ${name} address`;
  };
  const shortcuts = [
    {
      id: 'home',
      icon: 'home-outline',
      text: 'Home',
      label: savedLabel('home', 'home'),
      onPress: () => goToSaved('home'),
    },
    {
      id: 'work',
      icon: 'briefcase-outline',
      text: 'Work',
      label: savedLabel('work', 'work'),
      onPress: () => goToSaved('work'),
    },
    {
      id: 'saved',
      icon: 'bookmark-outline',
      text: 'Saved',
      label: 'Saved places',
      onPress: () => openPlaces({ focusDropoff: true }),
    },
  ];

  // The search field asks for the destination; with only the destination
  // set, it asks for the pickup instead.
  const renderWhereTo = () => (
    <>
      <Pressable
        onPress={() =>
          openPlaces({ focusDropoff: !dropoff || Boolean(pickup) })
        }
        accessibilityRole="search"
        accessibilityLabel={
          dropoff
            ? `Destination: ${placeText(dropoff)}`
            : 'Enter your destination'
        }
        style={({ pressed }) => [styles.search, pressed && styles.pressed]}>
        <Icon name="magnify" size={20} color={look.inkSoft} />
        <Text
          style={[styles.searchText, dropoff && styles.searchValue]}
          numberOfLines={1}>
          {dropoff ? placeText(dropoff) : 'Enter your destination'}
        </Text>
      </Pressable>
      <View style={styles.pillRow}>
        {shortcuts.map(item => (
          <Pressable
            key={item.id}
            onPress={item.onPress}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
            <Icon
              name={item.icon}
              size={17}
              color={look.inkSoft}
              style={styles.pillIcon}
            />
            <Text style={styles.pillText} numberOfLines={1}>
              {item.text}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
  );

  const renderRouteLine = () => (
    <View style={styles.routeLine}>
      <View style={styles.dot} />
      <Text style={styles.routeName} numberOfLines={1}>
        {placeName(pickup)}
      </Text>
      <Icon
        name="arrow-right"
        size={15}
        color={look.muted}
        style={styles.routeArrow}
      />
      <View style={styles.square} />
      <Text style={styles.routeName} numberOfLines={1}>
        {placeName(dropoff)}
      </Text>
      <View style={styles.flex} />
      {!isConfirmed ? (
        <Pressable
          onPress={onEdit}
          disabled={isLoading}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={
            confirming ? 'Edit the booking' : 'Edit pick-up and drop-off'
          }>
          <Text style={styles.edit}>Edit</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerRow}>
      {!isConfirmed ? (
        <Text style={styles.title} maxFontSizeMultiplier={1.3}>
          Choose a ride
        </Text>
      ) : (
        <View style={styles.flex} />
      )}
      {showAdvanceBooking ? (
        <Pressable
          onPress={onAdvanceBooking}
          disabled={!isOnline || isLoading}
          accessibilityRole="button"
          accessibilityLabel="Schedule the ride for later"
          style={({ pressed }) => [
            styles.smallPill,
            pressed && styles.pressed,
          ]}>
          <Icon name="calendar-blank-outline" size={16} color={look.ink} />
          <Text style={styles.smallPillText}>Schedule</Text>
        </Pressable>
      ) : null}
      {showMinimizeButton ? (
        <Pressable
          testID="advance-tracking-minimize"
          onPress={onMinimizePress}
          hitSlop={8}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.smallPill,
            pressed && styles.pressed,
          ]}>
          <Text style={styles.smallPillText}>Close</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const renderPills = () => (
    <View style={styles.pillRow}>
      {buttons.map(btn => (
        <Pressable
          key={btn.id}
          onPress={btn.onPress}
          accessibilityRole="button"
          accessibilityLabel={btn.label}
          style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
          <Icon
            name={btn.icon}
            size={17}
            color={look.inkSoft}
            style={styles.pillIcon}
          />
          <Text style={styles.pillText} numberOfLines={1}>
            {btn.text}
          </Text>
          {btn.chevron ? (
            <Icon
              name="chevron-down"
              size={16}
              color={look.inkSoft}
              style={styles.pillChevron}
            />
          ) : null}
          {btn.added ? <View style={styles.addedDot} /> : null}
        </Pressable>
      ))}
    </View>
  );

  const renderFare = () => (
    <View>
      <Pressable
        onPress={() => setShowBreakdown(open => !open)}
        disabled={!fare}
        accessibilityRole="button"
        accessibilityLabel={`Total fare ${figure}${
          caption ? `, ${caption}` : ''
        }`}
        accessibilityHint={
          fare
            ? showBreakdown
              ? 'Hides the breakdown'
              : 'Shows the breakdown'
            : undefined
        }
        accessibilityState={{ expanded: showBreakdown, disabled: !fare }}
        style={styles.fareBlock}>
        <View style={styles.flex}>
          <Text style={styles.fareLabel}>Total fare</Text>
          {caption ? <Text style={styles.fareCaption}>{caption}</Text> : null}
        </View>
        <Text style={styles.fareFigure} maxFontSizeMultiplier={1.3}>
          {figure}
        </Text>
        {fare ? (
          <Icon
            name={showBreakdown ? 'chevron-up' : 'chevron-down'}
            size={22}
            color={look.inkSoft}
          />
        ) : null}
      </Pressable>
      {fare && showBreakdown ? (
        <View style={styles.breakdown}>
          {breakdown.map(row => (
            <View key={row.label} style={styles.breakdownRow}>
              <Text style={[styles.breakdownText, row.strong && styles.strong]}>
                {row.label}
              </Text>
              <Text style={[styles.breakdownText, row.strong && styles.strong]}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );

  const renderAction = () =>
    action ? (
      <Pressable
        onPress={action.onPress}
        disabled={action.disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: action.disabled }}
        style={({ pressed }) => [
          styles.cta,
          action.danger ? styles.ctaQuiet : styles.ctaMain,
          action.disabled && styles.ctaDisabled,
          pressed && styles.pressed,
        ]}>
        <Text
          style={[
            styles.ctaText,
            action.danger && styles.ctaDangerText,
            action.disabled && styles.ctaDisabledText,
          ]}>
          {action.title}
        </Text>
      </Pressable>
    ) : null;

  // An instant booking waiting for a rider (the design canvas's "Finding your
  // rider"): the moving bar, then the trip in one line, then Cancel booking.
  const renderSearching = () => (
    <View style={styles.stack}>
      <FindingRider />
      <View style={styles.hairline} />
      <View style={styles.tripSummary}>
        <View style={styles.tripTile}>
          <Icon name={ride?.icon || 'moped'} size={22} color={look.chipInk} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.tripName} numberOfLines={1}>
            {ride?.title || selectedService?.title || 'Your ride'}
          </Text>
          <Text style={styles.tripMeta} numberOfLines={1}>
            {`${paymentConfig.label} · ${placeName(pickup)} → ${placeName(
              dropoff,
            )}`}
          </Text>
        </View>
        {fare ? (
          <Text style={styles.tripName}>{formatPeso(fare.total_amount)}</Text>
        ) : null}
      </View>
      <Pressable
        onPress={onBackToConfirm}
        disabled={isLoading || !isOnline}
        accessibilityRole="button"
        accessibilityState={{ disabled: isLoading || !isOnline }}
        style={({ pressed }) => [
          styles.cancelBooking,
          (isLoading || !isOnline) && styles.ctaDisabled,
          pressed && styles.pressed,
        ]}>
        <Text
          style={[
            styles.ctaDangerText,
            styles.cancelBookingText,
            (isLoading || !isOnline) && styles.ctaDisabledText,
          ]}>
          Cancel booking
        </Text>
      </Pressable>
    </View>
  );

  return (
    <View
      style={[
        styles.sheet,
        { paddingBottom: bottomSpace(bottomInset, 24, 24) },
      ]}
      onLayout={onLayout}>
      <View style={styles.handle} />
      {searching && routeComplete ? (
        renderSearching()
      ) : routeComplete ? (
        <View style={styles.stack}>
          {renderRouteLine()}
          {!isConfirmed || showMinimizeButton ? renderHeader() : null}
          <ServiceList
            services={services}
            selectedService={selectedService}
            fare={fare}
            onSelect={onSelectService}
            disabled={ridesLocked}
            selectedOnly={isConfirmed}
          />
          {!isConfirmed ? renderPills() : null}
          {renderFare()}
          {renderAction()}
        </View>
      ) : (
        <View style={styles.stack}>
          <Text style={styles.display} maxFontSizeMultiplier={1.3}>
            Where to?
          </Text>
          {renderWhereTo()}
        </View>
      )}
    </View>
  );
};

export default BottomModal;

const getStyles = (look, blue) =>
  StyleSheet.create({
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
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
    stack: {
      gap: 16,
    },
    flex: {
      flex: 1,
    },
    pressed: {
      opacity: 0.85,
    },
    // Display and Title roles
    display: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 25,
      lineHeight: 30,
      letterSpacing: -0.6,
      color: look.ink,
    },
    title: {
      flex: 1,
      fontFamily: 'Poppins SemiBold',
      fontSize: 22,
      lineHeight: 27,
      letterSpacing: -0.5,
      color: look.ink,
    },
    // the route: a blue dot for the pickup, a dark square for the drop-off
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
      minHeight: 42,
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
    edit: {
      marginLeft: 12,
      fontFamily: 'Poppins SemiBold',
      fontSize: 13,
      lineHeight: 18,
      color: blue,
    },
    // "Where to?": the search field
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 56,
      paddingHorizontal: 16,
      borderRadius: look.radiusTile,
      backgroundColor: look.soft,
    },
    // inkSoft, not muted, on `soft`
    searchText: {
      flex: 1,
      fontFamily: 'Poppins Regular',
      fontSize: 15,
      lineHeight: 20,
      color: look.inkSoft,
    },
    searchValue: {
      color: look.ink,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    smallPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 36,
      paddingHorizontal: 14,
      borderRadius: look.radiusPill,
      backgroundColor: look.soft,
    },
    smallPillText: {
      fontFamily: 'Poppins Medium',
      fontSize: 13,
      lineHeight: 18,
      color: look.ink,
    },
    pillRow: {
      flexDirection: 'row',
      gap: 9,
    },
    pill: {
      flex: 1,
      minHeight: 46,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
      borderRadius: look.radiusPill,
      backgroundColor: look.soft,
    },
    pillIcon: {
      marginRight: 6,
    },
    pillChevron: {
      marginLeft: 2,
    },
    pillText: {
      flexShrink: 1,
      fontFamily: 'Poppins Medium',
      fontSize: 13,
      lineHeight: 18,
      color: look.ink,
    },
    addedDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginLeft: 5,
      backgroundColor: look.accent,
    },
    fareBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    // Body strong, inkSoft
    fareLabel: {
      fontFamily: 'Poppins Medium',
      fontSize: 15,
      lineHeight: 20,
      letterSpacing: -0.2,
      color: look.inkSoft,
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
    breakdown: {
      marginTop: 10,
      paddingTop: 10,
      gap: 4,
      borderTopWidth: 1,
      borderTopColor: look.hairline,
    },
    breakdownRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    breakdownText: {
      fontFamily: 'Poppins Regular',
      fontSize: 13,
      lineHeight: 18,
      color: look.inkSoft,
    },
    strong: {
      fontFamily: 'Poppins Medium',
      color: look.ink,
    },
    // "Finding your rider": the trip in one line
    hairline: {
      height: 1,
      backgroundColor: look.hairline,
    },
    tripSummary: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    tripTile: {
      width: 44,
      height: 44,
      borderRadius: look.radiusTile,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: look.chip,
    },
    tripName: {
      fontFamily: 'Poppins Medium',
      fontSize: 15,
      lineHeight: 20,
      letterSpacing: -0.2,
      color: look.ink,
    },
    tripMeta: {
      fontFamily: 'Poppins Regular',
      fontSize: 13,
      lineHeight: 18,
      color: look.muted,
    },
    cancelBooking: {
      marginTop: 8,
      minHeight: 54,
      borderRadius: look.radiusCard - 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: look.soft,
    },
    cancelBookingText: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 15,
      lineHeight: 20,
    },
    // the one button
    cta: {
      minHeight: 58,
      borderRadius: look.radiusCard - 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    ctaMain: {
      backgroundColor: look.accent,
    },
    ctaQuiet: {
      backgroundColor: look.soft,
    },
    ctaDisabled: {
      backgroundColor: look.soft,
    },
    ctaText: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 16,
      lineHeight: 22,
      color: look.onAccent,
    },
    ctaDangerText: {
      color: look.danger,
    },
    ctaDisabledText: {
      color: look.muted,
    },
  });
