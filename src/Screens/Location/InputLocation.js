import React, { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Geolocation from 'react-native-geolocation-service';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppMap } from '@/Components';
import useApiRequest from '@/Services/ApiV2';
import { Constants } from '@/Utils';
import { fetchWithTimeout } from '@/Utils/Network';
import {
  removeSavedPlace,
  selectRecentPlaces,
  selectSavedPlaces,
  setDropoffLocation as storeDropoff,
  setPickupLocation as storePickup,
} from '@/Redux/Slices/userSlice';
import { bottomSpace } from '@/Utils/bottomSpace';
import { distanceKm, distanceText } from '@/Utils/tripText';
import {
  nearOf,
  placeFrom,
  sessionFor,
  suggestionsFrom,
} from '@/Utils/placeSession';
import {
  subtitleOf as recentSubtitle,
  titleOf as recentTitle,
} from '@/Utils/recentPlaces';
import { modern } from '@/Theme/modern';
import appAlert from '@/Utils/appAlert';

// Manila, while neither point is known.
const DEFAULT_CENTER = { lat: 14.5995, long: 120.9842 };

const SAVED_TYPES = [
  { type: 'home', icon: 'home-outline', name: 'Home' },
  { type: 'work', icon: 'briefcase-outline', name: 'Work' },
  { type: 'school', icon: 'school-outline', name: 'School' },
];

// A search result's name and the rest of its address. The backend sends the
// address as the name, a line break, then the full address.
const titleOf = item =>
  item.display_name || (item.address || '').split(/[\n,]/)[0].trim();
const subtitleOf = item => {
  const lines = (item.address || '').split('\n');
  if (lines.length > 1 && lines.slice(1).join(' ').trim()) {
    return lines.slice(1).join(', ').trim();
  }
  const text = item.description || item.address || '';
  const title = titleOf(item);
  return text.startsWith(title)
    ? text.slice(title.length).replace(/^[\s,]+/, '')
    : text;
};
// What a chosen result reads as in its field: one line.
const fieldTextOf = item =>
  item.description || (item.address || '').replace(/\n/g, ', ');

// The place picker, as the design canvas draws "Set route": the map with
// the route, and a sheet with the two points in one card (pick-up over
// drop-off, joined by a line, with a swap button), suggestions with their
// distance while typing, and one button that confirms the point. Choosing a
// place fills its field and moves on to the other point when that one is
// still empty; the button confirms. Everything the screen did before stays:
// search, my current location, the map picker, saved places.
const InputLocation = () => {
  // The navigation bar may cover the bottom of the screen: keep the bottom content clear of it
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();
  const look = modern(useTheme());
  const styles = getStyles(look);
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const savedPlaces = useSelector(selectSavedPlaces) || [];
  const recentPlaces = useSelector(selectRecentPlaces);

  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [pickupLocation, setPickupLocation] = useState(null);
  const [dropoffLocation, setDropoffLocation] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  // the field being typed in (suggestions show for it)
  const [focusedField, setFocusedField] = useState(null);
  // the point the button confirms and a saved place or my location fills
  const [activeField, setActiveField] = useState(() => {
    if (route.params?.focusDropoff) {
      return 'dropoff';
    }
    if (route.params?.returnAfterPickup || !route.params?.pickup) {
      return 'pickup';
    }
    return 'dropoff';
  });
  const [isLocatingCurrentPosition, setIsLocatingCurrentPosition] =
    useState(false);
  const [sheetHeight, setSheetHeight] = useState(0);

  const searchLocationRequest = useApiRequest();
  const placeDetailsRequest = useApiRequest();
  // This search's Google session (placeSession.js): ended by the place picked
  const placeSessionRef = useRef(null);
  const pickingRef = useRef(false);
  const debounceRef = useRef(null);
  const pickupInputRef = useRef(null);
  const dropoffInputRef = useRef(null);

  // With the keyboard up, the navigation bar's room under the button is
  // covered anyway.
  const [keyboardShown, setKeyboardShown] = useState(false);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () =>
      setKeyboardShown(true),
    );
    // Android's back closes the keyboard but leaves the field focused: let
    // go of it, so the sheet knows typing is over.
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardShown(false);
      pickupInputRef.current?.blur();
      dropoffInputRef.current?.blur();
    });
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  useEffect(() => {
    if (route.params?.pickup) {
      const pickupData = route.params.pickup;
      setPickup(pickupData.description || pickupData.address || '');
      setPickupLocation(pickupData);
    }
    if (route.params?.dropoff) {
      const dropoffData = route.params.dropoff;
      setDropoff(dropoffData.description || dropoffData.address || '');
      setDropoffLocation(dropoffData);
    }
  }, [route.params?.pickup, route.params?.dropoff]);

  const focusField = field => {
    setActiveField(field);
    setTimeout(() => {
      (field === 'pickup' ? pickupInputRef : dropoffInputRef).current?.focus();
    }, 350);
  };

  // BUG-2: after Confirm Date and Time, open with the drop-off field focused
  // and no pickup suggestions showing.
  useEffect(() => {
    if (!route.params?.focusDropoff) {
      return undefined;
    }
    setSearchResults([]);
    const t = setTimeout(() => {
      setFocusedField('dropoff');
      setActiveField('dropoff');
      dropoffInputRef.current?.focus();
    }, 350);
    return () => clearTimeout(t);
  }, [route.params?.focusDropoff]);

  // Suggestions only: the place picked is looked up alone (handleSelectItem),
  // and each suggestion says how far it is from the trip's other point.
  const searchLocation = (query, field) => {
    if (!query) {
      setSearchResults([]);
      return;
    }
    placeSessionRef.current = sessionFor(placeSessionRef.current, Date.now());
    const other = field === 'pickup' ? dropoffLocation : pickupLocation;
    searchLocationRequest.request(
      'GET',
      Constants.API.PLACE_AUTOCOMPLETE(
        query,
        placeSessionRef.current.token,
        nearOf(other),
      ),
    );
  };

  const handleSearchLocationRequest = async () => {
    if (searchLocationRequest.error) {
      console.error('Search location error:', searchLocationRequest.error);
      // don't fall through to the previous (stale) response's results
      setSearchResults([]);
      return;
    }
    const results = suggestionsFrom(searchLocationRequest.response?.data);
    // BUG-2: ignore late responses once no field is being edited
    setSearchResults(focusedField ? results : []);
  };

  useEffect(() => {
    handleSearchLocationRequest();
  }, [searchLocationRequest.response, searchLocationRequest.error]);

  const handleTextChange = (text, field) => {
    if (field === 'pickup') {
      setPickup(text);
    } else {
      setDropoff(text);
    }
    // drop the previous search's list right away; the new query refills it
    setSearchResults([]);
    setFocusedField(field);
    setActiveField(field);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      if (text) {
        searchLocation(text, field);
      }
    }, 300);
  };

  const handleBack = () => navigation.goBack();

  // Back empties the trip (the owner, 2026-11-22: "when i click the back
  // pick-up and drop-off should automatically be empty"): both points go,
  // whatever this screen opened with, and the opener's `onBackOut` drops
  // what it had begun for them (a schedule). The button keeps the points,
  // and so does a point confirmed on the map screen above, which closes this
  // screen too.
  const paramsRef = useRef(route.params);
  paramsRef.current = route.params;
  const keepRef = useRef(false);
  useEffect(
    () =>
      navigation.addListener('beforeRemove', () => {
        if (keepRef.current || !navigation.isFocused()) {
          return;
        }
        dispatch(storePickup(null));
        dispatch(storeDropoff(null));
        paramsRef.current?.onBackOut?.();
      }),
    [navigation, dispatch],
  );

  const handleOpenMap = () => {
    setFocusedField(null);
    setSearchResults([]);
    navigation.navigate('MapSelectionScreen', {
      onPickupSelect: route.params?.onPickupSelect,
      onDropoffSelect: route.params?.onDropoffSelect,
    });
  };

  // Web: the input blurs on mousedown, before the suggestion's click lands.
  // Closing the list right away made a real tap miss the item, so close it
  // a moment later and cancel that when a suggestion is picked.
  const blurTimerRef = useRef(null);
  const clearBlurTimer = () => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
  };
  const handleFieldFocus = field => {
    clearBlurTimer();
    setFocusedField(field);
    setActiveField(field);
  };
  const handleFieldBlur = () => {
    clearBlurTimer();
    blurTimerRef.current = setTimeout(() => {
      blurTimerRef.current = null;
      setFocusedField(null);
      setSearchResults([]);
    }, 300);
  };
  useEffect(() => clearBlurTimer, []);

  // A point chosen (a suggestion, a saved place, my location): fill its
  // field, tell the booking sheet, and move on to the other point when that
  // one is still empty (not when only the pickup was asked for).
  const choosePoint = (field, location, text) => {
    clearBlurTimer();
    // BUG-2: a pending debounced search must not reopen the list after a pick
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (field === 'pickup') {
      setPickup(text);
      setPickupLocation(location);
      route.params?.onPickupSelect?.(location);
    } else {
      setDropoff(text);
      setDropoffLocation(location);
      route.params?.onDropoffSelect?.(location);
    }
    setSearchResults([]);
    setFocusedField(null);
    setActiveField(field);
    Keyboard.dismiss();

    const otherSet = field === 'pickup' ? dropoffLocation : pickupLocation;
    const pickupOnly = field === 'pickup' && route.params?.returnAfterPickup;
    if (!otherSet && !pickupOnly) {
      focusField(field === 'pickup' ? 'dropoff' : 'pickup');
    }
  };

  const clearPoint = field => {
    if (field === 'pickup') {
      setPickup('');
      setPickupLocation(null);
      route.params?.onPickupClear?.();
    } else {
      setDropoff('');
      setDropoffLocation(null);
      route.params?.onDropoffClear?.();
    }
    focusField(field);
  };

  // The picked suggestion's location, the one paid lookup of the search; it
  // ends the search's Google session.
  const handleSelectItem = async item => {
    const field = focusedField || activeField;
    if (item.lat != null && item.long != null) {
      choosePoint(field, item, fieldTextOf(item));
      return;
    }
    if (pickingRef.current) {
      return;
    }
    pickingRef.current = true;
    const session = placeSessionRef.current;
    placeSessionRef.current = null;
    try {
      const { response, error } = await placeDetailsRequest.request(
        'GET',
        Constants.API.PLACE_DETAILS(item.place_id, session?.token),
      );
      const place = error ? null : placeFrom(response?.data, item);
      if (place) {
        choosePoint(field, place, fieldTextOf(item));
      } else {
        appAlert(
          'Place Not Found',
          'Unable to get that place. Please try again.',
        );
      }
    } finally {
      pickingRef.current = false;
    }
  };

  const handleSwap = () => {
    const [nextPickup, nextDropoff] = [dropoffLocation, pickupLocation];
    const [nextPickupText, nextDropoffText] = [dropoff, pickup];
    setPickup(nextPickupText);
    setPickupLocation(nextPickup);
    setDropoff(nextDropoffText);
    setDropoffLocation(nextDropoff);
    if (nextPickup) {
      route.params?.onPickupSelect?.(nextPickup);
    } else {
      route.params?.onPickupClear?.();
    }
    if (nextDropoff) {
      route.params?.onDropoffSelect?.(nextDropoff);
    } else {
      route.params?.onDropoffClear?.();
    }
  };

  const handleUseCurrentLocation = async () => {
    if (isLocatingCurrentPosition) {
      return;
    }
    setIsLocatingCurrentPosition(true);
    const field = focusedField || activeField;

    Geolocation.getCurrentPosition(
      async position => {
        const { latitude, longitude } = position.coords;

        try {
          const response = await fetchWithTimeout(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${Constants.GOOGLE_MAP_API_KEY}`,
          );
          const data = await response.json();

          const currentAddress =
            data.results[0]?.formatted_address || 'Current Location';

          const locationData = {
            address: currentAddress,
            lat: latitude,
            long: longitude,
          };
          choosePoint(field, locationData, currentAddress);
        } catch (error) {
          // Offline, timed out, or Google API error
          console.error('Reverse geocode error:', error);
          appAlert('Address Not Found', 'Unable to get address from location.');
        } finally {
          setIsLocatingCurrentPosition(false);
        }
      },
      error => {
        console.error('Location error:', error);
        appAlert(
          'Location Not Found',
          'Unable to get location. Please try again.',
        );
        setIsLocatingCurrentPosition(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  };

  const handleAddSavedPlace = type => {
    // Check if this type already exists (only for non-"other" types)
    if (type !== 'other') {
      const existingPlace = savedPlaces.find(place => place.type === type);

      if (existingPlace) {
        // Navigate to edit existing place
        navigation.navigate('SaveLocationScreen', {
          locationType: type,
          existingPlace: existingPlace,
        });
        return;
      }
    }

    // Navigate to add new place (for "other" type or non-existing places)
    navigation.navigate('SaveLocationScreen', {
      locationType: type,
    });
  };

  const handleSelectSavedPlace = place => {
    const locationData = {
      address: place.address,
      lat: place.lat,
      long: place.long,
    };
    choosePoint(focusedField || activeField, locationData, place.address);
  };

  const handleDeleteSavedPlace = placeId => {
    appAlert(
      'Delete Saved Place',
      'Are you sure you want to delete this saved place?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => dispatch(removeSavedPlace(placeId)),
        },
      ],
      { icon: 'trash-can-outline' },
    );
  };

  // The button: confirms the point being set, then back to the booking
  // sheet once both are known (or the pickup alone, when only it was asked).
  const fieldLocation = field =>
    field === 'pickup' ? pickupLocation : dropoffLocation;
  const confirmLabel =
    activeField === 'pickup' ? 'Confirm pick-up' : 'Confirm drop-off';
  const canConfirm = Boolean(fieldLocation(activeField));
  const handleConfirm = () => {
    Keyboard.dismiss();
    if (activeField === 'pickup') {
      if (dropoffLocation || route.params?.returnAfterPickup) {
        keepRef.current = true;
        navigation.goBack();
      } else {
        focusField('dropoff');
      }
    } else if (pickupLocation) {
      keepRef.current = true;
      navigation.goBack();
    } else {
      focusField('pickup');
    }
  };

  const query = focusedField === 'pickup' ? pickup : dropoff;
  const showSuggestions =
    Boolean(focusedField) && query.length > 0 && searchResults.length > 0;
  // Both points chosen and nothing being typed: only the card and the
  // button, so the map shows the route. Tapping a field brings the rest back.
  const compact = Boolean(pickupLocation && dropoffLocation) && !focusedField;
  // distances from the other point, when it is known
  const origin = focusedField === 'pickup' ? dropoffLocation : pickupLocation;

  const renderField = field => {
    const isPickup = field === 'pickup';
    const value = isPickup ? pickup : dropoff;
    const highlighted = focusedField === field || activeField === field;
    return (
      <View
        style={[
          styles.field,
          isPickup ? null : styles.fieldGap,
          highlighted && styles.fieldActive,
        ]}>
        <View style={styles.flex}>
          <Text style={[styles.fieldLabel, highlighted && styles.labelOnWhite]}>
            {isPickup ? 'PICK-UP' : 'DROP-OFF'}
          </Text>
          <TextInput
            ref={isPickup ? pickupInputRef : dropoffInputRef}
            value={value}
            onChangeText={text => handleTextChange(text, field)}
            onFocus={() => handleFieldFocus(field)}
            onBlur={handleFieldBlur}
            // a long address reads from its start while not being edited
            selection={focusedField === field ? undefined : { start: 0 }}
            placeholder={isPickup ? 'Where from?' : 'Where to?'}
            placeholderTextColor={look.inkSoft}
            style={styles.input}
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            accessibilityLabel={isPickup ? 'Pick-up' : 'Drop-off'}
          />
        </View>
        {value.length > 0 ? (
          <Pressable
            onPress={() => clearPoint(field)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={isPickup ? 'Clear pick-up' : 'Clear drop-off'}>
            <Icon name="close-circle" size={18} color={look.muted} />
          </Pressable>
        ) : null}
      </View>
    );
  };

  const renderRail = () => (
    <View style={styles.rail}>
      <View style={styles.railMarks}>
        <View style={styles.dot} />
        <View style={styles.railLine} />
        <View style={styles.square} />
      </View>
      <View style={styles.flex}>
        {renderField('pickup')}
        {renderField('dropoff')}
      </View>
      <Pressable
        onPress={handleSwap}
        disabled={!pickupLocation && !dropoffLocation}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel="Swap pick-up and drop-off"
        style={({ pressed }) => [styles.swap, pressed && styles.pressed]}>
        <Icon name="swap-vertical" size={20} color={look.ink} />
      </Pressable>
    </View>
  );

  const renderRow = ({ key, icon, title, subtitle, right, onPress, label }) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label || [title, subtitle].filter(Boolean).join(', ')}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rowTile}>
        <Icon name={icon} size={20} color={look.ink} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  );

  const renderSuggestions = () => (
    <>
      <Text style={styles.sectionLabel}>SUGGESTIONS</Text>
      {searchResults.map((item, index) => {
        const km = distanceText(item.distance_km ?? distanceKm(origin, item));
        return renderRow({
          key: item.place_id || String(index),
          icon: 'map-marker-outline',
          title: titleOf(item),
          subtitle: subtitleOf(item),
          right: km ? <Text style={styles.distance}>{km}</Text> : null,
          onPress: () => handleSelectItem(item),
          label: [titleOf(item), subtitleOf(item), km]
            .filter(Boolean)
            .join(', '),
        });
      })}
    </>
  );

  const renderEditDelete = place => (
    <View style={styles.rowActions}>
      <Pressable
        onPress={() =>
          navigation.navigate('SaveLocationScreen', {
            locationType: place.type,
            existingPlace: place,
          })
        }
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${place.label || 'place'}`}>
        <Icon name="pencil-outline" size={19} color={look.inkSoft} />
      </Pressable>
      <Pressable
        onPress={() => handleDeleteSavedPlace(place.id)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${place.label || 'place'}`}>
        <Icon name="trash-can-outline" size={19} color={look.inkSoft} />
      </Pressable>
    </View>
  );

  const renderPlaces = () => {
    const otherPlaces = savedPlaces.filter(place => place.type === 'other');
    return (
      <>
        {renderRow({
          key: 'current',
          icon: 'crosshairs-gps',
          title: isLocatingCurrentPosition
            ? 'Locating…'
            : 'Use my current location',
          onPress: handleUseCurrentLocation,
        })}
        {renderRow({
          key: 'map',
          icon: 'map-outline',
          title: 'Choose from map',
          right: <Icon name="chevron-right" size={20} color={look.muted} />,
          onPress: handleOpenMap,
        })}

        {recentPlaces.length > 0 ? (
          <>
            {/* the drop-offs and pick-ups of recent trips, for either point:
                no search, no paid lookup (recentPlaces.js) */}
            <Text style={styles.sectionLabel}>RECENT</Text>
            {recentPlaces.slice(0, 5).map(place =>
              renderRow({
                key: `recent:${place.lat},${place.long}`,
                icon: 'history',
                title: recentTitle(place),
                subtitle: recentSubtitle(place) || undefined,
                onPress: () =>
                  choosePoint(
                    focusedField || activeField,
                    place,
                    place.address,
                  ),
              }),
            )}
          </>
        ) : null}

        <Text style={styles.sectionLabel}>SAVED PLACES</Text>
        {SAVED_TYPES.map(({ type, icon, name }) => {
          const place = savedPlaces.find(p => p.type === type);
          return place
            ? renderRow({
                key: type,
                icon,
                title: place.label || name,
                subtitle: place.address,
                right: renderEditDelete(place),
                onPress: () => handleSelectSavedPlace(place),
              })
            : renderRow({
                key: type,
                icon,
                title: `Add ${name}`,
                right: <Icon name="plus" size={20} color={look.muted} />,
                onPress: () => handleAddSavedPlace(type),
              });
        })}
        {otherPlaces.map(place =>
          renderRow({
            key: String(place.id),
            icon: 'map-marker-outline',
            title: place.label || 'Saved place',
            subtitle: place.address,
            right: renderEditDelete(place),
            onPress: () => handleSelectSavedPlace(place),
          }),
        )}
        {renderRow({
          key: 'other',
          icon: 'bookmark-plus-outline',
          title: 'Add another place',
          right: <Icon name="plus" size={20} color={look.muted} />,
          onPress: () => handleAddSavedPlace('other'),
        })}
      </>
    );
  };

  const center = pickupLocation || dropoffLocation || DEFAULT_CENTER;

  return (
    <View style={styles.container}>
      <AppMap
        initialLat={Number(center.lat)}
        initialLong={Number(center.long)}
        locationReady
        // the blue dot only until a pickup is set: the pickup pin often
        // sits on it ("Use my current location")
        showsUser={!pickupLocation}
        firstMarkerLat={pickupLocation?.lat}
        firstMarkerLong={pickupLocation?.long}
        secondMarkerLat={dropoffLocation?.lat}
        secondMarkerLong={dropoffLocation?.long}
        bottomInset={sheetHeight}
        interactive
        style={StyleSheet.absoluteFill}
      />

      <Pressable
        onPress={handleBack}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={[styles.back, { top: topInset + 12 }]}>
        <Icon name="chevron-left" size={28} color={look.ink} />
      </Pressable>

      {/* The sheet rides above the keyboard: the app draws edge to edge,
          and recent Android leaves the window full height under it.
          KeyboardAvoidingView pads only by what the keyboard really
          covers, so a phone that does shrink the window is not lifted twice. */}
      <KeyboardAvoidingView
        behavior="padding"
        // only while the keyboard is up: on hiding, edge to edge leaves the
        // navigation bar's height behind as padding otherwise
        enabled={keyboardShown}
        pointerEvents="box-none"
        style={[styles.sheetLayer, { paddingTop: topInset + 72 }]}>
        <View
          style={styles.sheet}
          onLayout={e => setSheetHeight(e.nativeEvent.layout.height)}>
          <View style={styles.handle} />
          <ScrollView
            style={styles.sheetScroll}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.sheetContent}>
            {renderRail()}
            {compact
              ? null
              : showSuggestions
              ? renderSuggestions()
              : renderPlaces()}
          </ScrollView>
          <View
            style={[
              styles.ctaWrap,
              {
                paddingBottom: keyboardShown
                  ? 12
                  : bottomSpace(bottomInset, 16, 16),
              },
            ]}>
            <Pressable
              onPress={handleConfirm}
              disabled={!canConfirm}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canConfirm }}
              style={({ pressed }) => [
                styles.cta,
                !canConfirm && styles.ctaDisabled,
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.ctaText, !canConfirm && styles.ctaTextOff]}>
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default InputLocation;

const getStyles = look =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: look.surface,
    },
    flex: {
      flex: 1,
    },
    pressed: {
      opacity: 0.85,
    },
    back: {
      position: 'absolute',
      left: 20,
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: look.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 6,
    },
    // the layer the sheet sits at the bottom of; never higher than just
    // under the back button
    sheetLayer: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
    },
    sheet: {
      flexShrink: 1,
      paddingTop: 10,
      backgroundColor: look.surface,
      borderTopLeftRadius: look.radiusSheet,
      borderTopRightRadius: look.radiusSheet,
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
    sheetScroll: {
      flexGrow: 0,
      flexShrink: 1,
    },
    sheetContent: {
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    // the two points in one card
    rail: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: look.radiusCard,
      backgroundColor: look.soft,
    },
    railMarks: {
      alignSelf: 'stretch',
      alignItems: 'center',
      // the dot and the square sit level with the middle of each field
      paddingVertical: 24,
      marginRight: 10,
    },
    railLine: {
      flex: 1,
      width: 2,
      marginVertical: 4,
      backgroundColor: look.hairline,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#084CF7',
    },
    square: {
      width: 10,
      height: 10,
      borderRadius: 2,
      backgroundColor: look.ink,
    },
    field: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: look.radiusTile - 2,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    fieldGap: {
      marginTop: 6,
    },
    fieldActive: {
      backgroundColor: look.surface,
      borderColor: look.accent,
    },
    // Label role; inkSoft, not muted, on `soft`
    fieldLabel: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 11,
      lineHeight: 14,
      letterSpacing: 1.2,
      color: look.inkSoft,
    },
    labelOnWhite: {
      color: look.muted,
    },
    input: {
      padding: 0,
      fontFamily: 'Poppins Medium',
      fontSize: 15,
      lineHeight: 20,
      color: look.ink,
    },
    swap: {
      width: 40,
      height: 40,
      marginLeft: 10,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: look.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 2,
    },
    // Label role
    sectionLabel: {
      marginTop: 20,
      marginBottom: 6,
      fontFamily: 'Poppins SemiBold',
      fontSize: 11,
      lineHeight: 14,
      letterSpacing: 1.2,
      color: look.muted,
    },
    row: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 8,
    },
    rowTile: {
      width: 44,
      height: 44,
      borderRadius: look.radiusTile - 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: look.soft,
    },
    rowTitle: {
      fontFamily: 'Poppins Medium',
      fontSize: 15,
      lineHeight: 20,
      letterSpacing: -0.2,
      color: look.ink,
    },
    rowSubtitle: {
      fontFamily: 'Poppins Regular',
      fontSize: 13,
      lineHeight: 18,
      color: look.muted,
    },
    rowActions: {
      flexDirection: 'row',
      gap: 16,
    },
    distance: {
      fontFamily: 'Poppins Medium',
      fontSize: 13,
      lineHeight: 18,
      color: look.inkSoft,
    },
    ctaWrap: {
      paddingHorizontal: 20,
      paddingTop: 10,
    },
    cta: {
      minHeight: 58,
      borderRadius: look.radiusCard - 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: look.accent,
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
    ctaTextOff: {
      color: look.muted,
    },
  });
