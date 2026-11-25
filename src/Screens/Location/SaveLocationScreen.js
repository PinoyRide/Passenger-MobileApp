import { AppButton, AppMap } from '@/Components';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { openSettings } from 'react-native-permissions';
import { Constants } from '@/Utils';
import { addSavedPlace, updateSavedPlace } from '@/Redux/Slices/userSlice';
import { useLocation } from '@/Hooks/useLocation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomSpace } from '@/Utils/bottomSpace';
import appAlert from '@/Utils/appAlert';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useApiRequest from '@/Services/ApiV2';
import {
  distanceLabel,
  nearOf,
  placeFrom,
  placeLine,
  sessionFor,
  suggestionsFrom,
} from '@/Utils/placeSession';
import { modern } from '@/Theme/modern';

// One suggestion of the search: what the place is, where, and how far.
const ResultRow = ({
  styles,
  look,
  icon,
  title,
  subtitle,
  distance,
  onPress,
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.resultRow, pressed && styles.resultPressed]}
    accessibilityRole="button"
    accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')}>
    <View style={styles.resultIcon}>
      <Icon name={icon} size={18} color={look.chipInk} />
    </View>
    <View style={styles.resultWords}>
      <Text style={styles.resultTitle} numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.resultSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
    {distance ? <Text style={styles.resultDistance}>{distance}</Text> : null}
  </Pressable>
);

const getIconForType = type => {
  switch (type) {
    case 'home':
      return require('@/Assets/Common/Location/Home.png');
    case 'work':
      return require('@/Assets/Common/Location/Suitcase.png');
    case 'school':
      return require('@/Assets/Common/Location/School.png');
    default:
      return require('@/Assets/Common/Location/Location.png');
  }
};

const SaveLocationScreen = () => {
  // The navigation bar may cover the bottom of the screen: keep the bottom content clear of it
  const { bottom: bottomInset } = useSafeAreaInsets();
  const theme = useTheme();
  const { colors } = theme;
  const look = modern(theme);
  const styles = getStyles({ colors, look });
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();

  const { locationType, existingPlace } = route.params || {};

  // Use location hook
  const { location, permissionStatus } = useLocation();

  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [label, setLabel] = useState('');
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  // Search for the place by name or address, or tap it on the map (the owner,
  // 2026-11-23: "adding a location search bar in Add Saved Place for faster
  // and more accurate address selection"). The suggestions while typing, then
  // the place picked looked up alone: one Google session, as the booking
  // search does (Utils/placeSession.js), asked 300 ms after the last key.
  const searchRequest = useApiRequest();
  const detailsRequest = useApiRequest();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searching, setSearching] = useState(false);
  const sessionRef = useRef(null);
  const typingRef = useRef(null);
  const pickingRef = useRef(false);
  const searchInputRef = useRef(null);

  // Default location (Manila)
  const defaultLocation = {
    lat: 14.5995,
    lng: 120.9842,
  };

  const currentLocation = location
    ? { lat: location.latitude, lng: location.longitude }
    : defaultLocation;

  useEffect(() => {
    // Set initial label based on location type
    if (locationType && !existingPlace) {
      setLabel(locationType.charAt(0).toUpperCase() + locationType.slice(1));
    }

    // If editing existing place, populate fields
    if (existingPlace) {
      setLabel(existingPlace.label);
      setSelectedAddress(existingPlace.address);
      setSelectedLocation({
        latitude: existingPlace.lat,
        longitude: existingPlace.long,
      });
    }
  }, [locationType, existingPlace]);

  // ✅ Track keyboard visibility
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      },
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      },
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

  // Check permission on mount
  useEffect(() => {
    if (permissionStatus === 'blocked') {
      appAlert(
        'Location Access Blocked',
        'Please enable location in Settings to save locations.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => navigation.goBack(),
          },
          { text: 'Open Settings', onPress: () => openSettings() },
        ],
        { icon: 'map-marker-off-outline' },
      );
    } else if (permissionStatus === 'denied') {
      appAlert(
        'Location Required',
        'Location access helps you save locations more easily.',
        [{ text: 'OK' }],
        { icon: 'map-marker-off-outline' },
      );
    }
  }, [permissionStatus]);

  useEffect(() => () => clearTimeout(typingRef.current), []);

  const onQuery = text => {
    setQuery(text);
    clearTimeout(typingRef.current);
    const typed = text.trim();
    if (!typed) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    typingRef.current = setTimeout(async () => {
      sessionRef.current = sessionFor(sessionRef.current, Date.now());
      const near = nearOf(
        location ? { lat: location.latitude, long: location.longitude } : null,
      );
      const { response, error, stale } = await searchRequest.request(
        'GET',
        Constants.API.PLACE_AUTOCOMPLETE(typed, sessionRef.current.token, near),
      );
      if (stale) {
        return;
      }
      setSearching(false);
      setSuggestions(error ? [] : suggestionsFrom(response?.data));
    }, 300);
  };

  const closeSearch = () => {
    clearTimeout(typingRef.current);
    setQuery('');
    setSuggestions([]);
    setSearching(false);
    searchInputRef.current?.blur();
    Keyboard.dismiss();
  };

  // the back button closes the search first
  useEffect(() => {
    if (!searchFocused) {
      return undefined;
    }
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      closeSearch();
      return true;
    });
    return () => back.remove();
  }, [searchFocused]);

  const pickSuggestion = async item => {
    if (pickingRef.current) {
      return;
    }
    pickingRef.current = true;
    const session = sessionRef.current;
    sessionRef.current = null;
    try {
      const { response, error } = await detailsRequest.request(
        'GET',
        Constants.API.PLACE_DETAILS(item.place_id, session?.token),
      );
      const place = error ? null : placeFrom(response?.data, item);
      if (!place) {
        appAlert(
          'Place not found',
          'Unable to get that place. Please try again.',
        );
        return;
      }
      setSelectedLocation({ latitude: place.lat, longitude: place.long });
      setSelectedAddress(placeLine(place));
      closeSearch();
    } finally {
      pickingRef.current = false;
    }
  };

  const pickCurrentLocation = () => {
    if (!location) {
      return;
    }
    closeSearch();
    handleMapPress({
      latitude: location.latitude,
      longitude: location.longitude,
    });
  };

  const handleMapPress = async ({ latitude, longitude }) => {
    setSelectedLocation({ latitude, longitude });
    reverseGeocode(latitude, longitude);
  };

  const reverseGeocode = async (latitude, longitude) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${Constants.GOOGLE_ROUTES_API_KEY}`,
      );
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        setSelectedAddress(data.results[0].formatted_address);
      } else {
        setSelectedAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      setSelectedAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
    }
  };

  // ✅ Enhanced validation
  const handleSave = () => {
    // Validate label
    if (!label.trim()) {
      appAlert(
        'Label Required',
        'Please enter a label for this location (e.g., Home, Office, Gym).',
        [{ text: 'OK' }],
      );
      return;
    }

    // ✅ Validate that user actually selected a location on the map
    if (!selectedLocation || !selectedAddress) {
      appAlert(
        'Location Required',
        'Search for the place, or tap it on the map, before saving.',
        [{ text: 'OK' }],
        { icon: 'map-marker-off-outline' },
      );
      return;
    }

    // ✅ Additional validation: Check if address is not just coordinates
    // This prevents saving locations with generic "lat, lng" addresses
    if (
      selectedAddress.includes(',') &&
      selectedAddress.split(',').length === 2
    ) {
      const parts = selectedAddress.split(',');
      const isCoordinates = parts.every(
        part => !isNaN(parseFloat(part.trim())),
      );

      if (isCoordinates) {
        appAlert(
          'Invalid Location',
          'Unable to get address for this location. Please try selecting a different location or check your internet connection.',
          [{ text: 'OK' }],
        );
        return;
      }
    }

    const savedPlace = {
      id: existingPlace?.id || `saved_${Date.now()}`,
      type: locationType || existingPlace?.type || 'other',
      label: label.trim(),
      address: selectedAddress,
      lat: selectedLocation.latitude,
      long: selectedLocation.longitude,
    };

    if (existingPlace) {
      dispatch(updateSavedPlace(savedPlace));
    } else {
      dispatch(addSavedPlace(savedPlace));
    }

    navigation.goBack();
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          {/* Header with back button */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Image
                source={require('@/Assets/Common/Back_2.png')}
                style={styles.backIcon}
                resizeMode="contain"
              />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {existingPlace ? 'Edit Saved Place' : 'Add Saved Place'}
            </Text>
            <View style={styles.backButton} />
          </View>

          <View style={styles.searchArea}>
            <View style={styles.searchBar}>
              <Icon name="magnify" size={20} color={look.muted} />
              <TextInput
                ref={searchInputRef}
                value={query}
                onChangeText={onQuery}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search for a place or address"
                placeholderTextColor={look.muted}
                style={styles.searchInput}
                returnKeyType="search"
                autoCorrect={false}
                accessibilityLabel="Search for a place or address"
              />
              {query ? (
                <Pressable
                  onPress={() => onQuery('')}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Clear the search">
                  <Icon name="close-circle" size={18} color={look.faint} />
                </Pressable>
              ) : null}
            </View>
            {searchFocused ? (
              <Pressable
                onPress={closeSearch}
                hitSlop={8}
                style={styles.searchCancel}
                accessibilityRole="button">
                <Text style={styles.searchCancelText}>Cancel</Text>
              </Pressable>
            ) : null}
          </View>

          {searchFocused ? (
            <ScrollView
              style={styles.results}
              contentContainerStyle={styles.resultsContent}
              keyboardShouldPersistTaps="handled">
              {!query.trim() && location ? (
                <ResultRow
                  styles={styles}
                  look={look}
                  icon="crosshairs-gps"
                  title="Use my current location"
                  onPress={pickCurrentLocation}
                />
              ) : null}
              {!query.trim() ? (
                <Text style={styles.searchHint}>
                  Type the name of a place, a building or a street.
                </Text>
              ) : null}
              {query.trim() && searching ? (
                <ActivityIndicator
                  style={styles.searchSpinner}
                  color={look.accent}
                />
              ) : null}
              {query.trim() && !searching && suggestions.length === 0 ? (
                <Text style={styles.searchHint}>
                  No places found. Try another name, or tap the map.
                </Text>
              ) : null}
              {suggestions.map(item => (
                <ResultRow
                  key={item.place_id}
                  styles={styles}
                  look={look}
                  icon="map-marker-outline"
                  title={item.display_name || item.description}
                  subtitle={item.address}
                  distance={distanceLabel(item.distance_km)}
                  onPress={() => pickSuggestion(item)}
                />
              ))}
            </ScrollView>
          ) : null}

          {/* ✅ Hide map when keyboard is visible to save space */}
          {!searchFocused && !isKeyboardVisible && (
            <View style={styles.mapWrapper}>
              <AppMap
                initialLat={existingPlace?.lat || currentLocation.lat}
                initialLong={existingPlace?.long || currentLocation.lng}
                locationReady={permissionStatus === 'granted'}
                firstMarkerLat={selectedLocation?.latitude}
                firstMarkerLong={selectedLocation?.longitude}
                onMapPress={handleMapPress}
                interactive={true}
                latOffset={-5}
                style={{ flex: 1 }}
              />

              {/* ✅ Visual indicator when no location selected */}
              {!selectedLocation && (
                <View style={styles.mapOverlay}>
                  <View style={styles.instructionBubble}>
                    <Text style={styles.instructionText}>
                      Search above, or tap the map
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {searchFocused ? null : (
            <View
              style={[
                styles.bottomPanel,
                isKeyboardVisible && styles.bottomPanelExpanded,
              ]}>
              <ScrollView
                contentContainerStyle={[
                  styles.scrollContent,
                  { paddingBottom: bottomSpace(bottomInset, 20) },
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled">
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>Label *</Text>
                  <View style={styles.inputRow}>
                    <Image
                      source={getIconForType(
                        locationType || existingPlace?.type || 'other',
                      )}
                      style={styles.inputIcon}
                      resizeMode="contain"
                    />
                    <TextInput
                      value={label}
                      onChangeText={setLabel}
                      placeholder="e.g., Home, Office, Gym"
                      style={styles.inputText}
                      placeholderTextColor={colors.grey3}
                      returnKeyType="done"
                      blurOnSubmit={true}
                    />
                  </View>
                </View>

                <View style={styles.addressContainer}>
                  <Text style={styles.inputLabel}>Selected Location *</Text>
                  <View
                    style={[
                      styles.addressRow,
                      !selectedAddress && styles.addressRowEmpty,
                    ]}>
                    <Image
                      source={require('@/Assets/Common/Location/Location.png')}
                      style={styles.addressIcon}
                      resizeMode="contain"
                    />
                    <Text
                      style={[
                        styles.addressText,
                        !selectedAddress && styles.addressTextPlaceholder,
                      ]}
                      numberOfLines={2}>
                      {selectedAddress || 'Search or tap the map'}
                    </Text>
                  </View>
                </View>

                {/* ✅ Show hint when keyboard is visible */}
                {isKeyboardVisible && !selectedLocation && (
                  <View style={styles.keyboardHint}>
                    <Text style={styles.keyboardHintText}>
                      💡 Close keyboard to select location on map
                    </Text>
                  </View>
                )}

                <AppButton
                  title="Save Location"
                  onPress={handleSave}
                  isBold
                  // ✅ Disable button if required fields are empty
                  disabled={
                    !label.trim() || !selectedLocation || !selectedAddress
                  }
                />
              </ScrollView>
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default SaveLocationScreen;

const { width } = Dimensions.get('window');

const getStyles = ({ colors, look }) =>
  StyleSheet.create({
    searchArea: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.background,
    },
    searchBar: {
      flex: 1,
      height: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: look.hairline,
      backgroundColor: look.soft,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 0,
      fontFamily: 'Poppins Regular',
      fontSize: 15,
      color: look.ink,
    },
    searchCancel: {
      paddingVertical: 8,
    },
    searchCancelText: {
      fontFamily: 'Poppins Medium',
      fontSize: 14,
      color: look.link,
    },
    results: {
      flex: 1,
      backgroundColor: colors.background,
    },
    resultsContent: {
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: look.hairline,
    },
    resultPressed: {
      opacity: 0.7,
    },
    resultIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: look.chip,
    },
    resultWords: {
      flex: 1,
    },
    resultTitle: {
      fontFamily: 'Poppins Medium',
      fontSize: 15,
      lineHeight: 21,
      color: look.ink,
    },
    resultSubtitle: {
      fontFamily: 'Poppins Regular',
      fontSize: 13,
      lineHeight: 18,
      color: look.muted,
    },
    resultDistance: {
      fontFamily: 'Poppins Regular',
      fontSize: 12,
      color: look.faint,
    },
    searchHint: {
      paddingVertical: 14,
      fontFamily: 'Poppins Regular',
      fontSize: 13,
      lineHeight: 19,
      color: look.muted,
    },
    searchSpinner: {
      marginTop: 20,
    },
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 10,
      paddingTop: 60,
      paddingBottom: 16,
      backgroundColor: colors.primary,
    },
    backButton: {
      width: 52,
      height: 52,
      justifyContent: 'center',
      alignItems: 'center',
    },
    backIcon: {
      width: 23,
      height: 23,
      tintColor: '#fff',
    },
    headerTitle: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 18,
      fontWeight: '600',
      color: '#fff',
    },
    // the map takes what the panel leaves
    mapWrapper: {
      flex: 1,
      width,
      position: 'relative',
    },
    mapOverlay: {
      position: 'absolute',
      top: 20,
      left: 20,
      right: 20,
      alignItems: 'center',
      pointerEvents: 'none',
    },
    instructionBubble: {
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 20,
    },
    instructionText: {
      color: 'white',
      fontFamily: 'Poppins Medium',
      fontSize: 14,
      textAlign: 'center',
    },
    // As tall as what it holds, so Save Location always shows above
    // Android's navigation bar (the owner, 2026-11-22: "fix this page it is
    // overlapping"). A fixed 40% of the screen was shorter than the fields
    // and the button, which ended under the bar. On a short screen it stops
    // at 60% and scrolls, so some map stays.
    bottomPanel: {
      maxHeight: '60%',
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 10,
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    // ✅ Expand bottom panel when keyboard is visible
    bottomPanelExpanded: {
      flex: 1,
      maxHeight: '100%',
    },
    scrollContent: {
      paddingBottom: 20,
    },
    inputSection: {
      marginBottom: 16,
    },
    inputLabel: {
      fontFamily: 'Poppins Medium',
      fontSize: 12,
      fontWeight: '500',
      color: colors.grey3,
      marginBottom: 8,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: colors.grey2,
      borderRadius: 10,
    },
    inputIcon: {
      width: 16,
      height: 16,
      marginRight: 12,
    },
    inputText: {
      flex: 1,
      fontFamily: 'Poppins Medium',
      fontSize: 14,
      color: colors.grey3,
    },
    addressContainer: {
      marginBottom: 16,
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: colors.grey2,
      borderRadius: 10,
      minHeight: 50,
    },
    // ✅ New style for empty address state
    addressRowEmpty: {
      borderWidth: 1,
      borderColor: colors.primary,
      borderStyle: 'dashed',
    },
    addressIcon: {
      width: 16,
      height: 16,
      marginRight: 12,
    },
    addressText: {
      flex: 1,
      fontFamily: 'Poppins Regular',
      fontSize: 12,
      color: colors.grey3,
    },
    // ✅ New style for placeholder text
    addressTextPlaceholder: {
      fontStyle: 'italic',
      opacity: 0.6,
    },
    // ✅ Hint shown when keyboard is visible
    keyboardHint: {
      backgroundColor: colors.grey2,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      marginBottom: 16,
    },
    keyboardHintText: {
      fontFamily: 'Poppins Regular',
      fontSize: 12,
      color: colors.grey4,
      textAlign: 'center',
    },
  });
