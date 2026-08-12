import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Image, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import MapView, {
  AnimatedRegion,
  Marker,
  MarkerAnimated,
  Polyline,
} from 'react-native-maps';
import { Constants } from '@/Utils';
import { fetchWithTimeout } from '@/Utils/Network';

const AppMap = forwardRef(
  (
    {
      initialLat,
      initialLong,
      locationReady,
      firstMarkerLat,
      firstMarkerLong,
      secondMarkerLat,
      secondMarkerLong,
      // Rider marker props (only meaningful when bookingStatus === 1 or 2)
      riderMarkerLat,
      riderMarkerLong,
      // 🆕 Booking status drives which leg of the trip we're tracking:
      // 1 = rider heading to pickup, 2 = rider (with customer) heading to dropoff
      bookingStatus,
      minDelta = 0.02,
      latOffset = -0.01,
      onMapPress,
      interactive = true,
      style,
    },
    ref,
  ) => {
    const { colors } = useTheme();
    const styles = getStyles({ colors });
    const mapRef = useRef(null);
    const [mapReady, setMapReady] = useState(false);
    const [routeCoords, setRouteCoords] = useState([]);

    // 🆕 Road-snapped pickup/dropoff coordinates. The Directions API snaps
    // origin/destination to the nearest routable road before drawing the
    // polyline, so the raw address lat/long (which can sit inside a
    // building, parking lot, etc.) doesn't match where the line actually
    // starts/ends. We pull the *actual* snapped point straight out of the
    // Directions response (leg.start_location / leg.end_location) so the
    // pin always sits exactly on the polyline, the way Grab/Angkas do it.
    const [snappedPickup, setSnappedPickup] = useState(null);
    const [snappedDropoff, setSnappedDropoff] = useState(null);

    // Reset the snapped point whenever the underlying address changes, so
    // we don't keep showing a stale snap while the new route is fetching.
    useEffect(() => {
      setSnappedPickup(null);
    }, [firstMarkerLat, firstMarkerLong]);

    useEffect(() => {
      setSnappedDropoff(null);
    }, [secondMarkerLat, secondMarkerLong]);

    // 🔧 Normalize bookingStatus to a Number once — it may arrive as a string
    // ("1") from Redux/the API, and strict "1" === 1 comparisons would fail.
    const statusNum = Number(bookingStatus);

    // 🆕 Animated coordinate for the rider marker. Instead of the marker
    // snapping instantly to each new poll result, this glides smoothly
    // between the old and new position — like Grab/Uber's live tracking.
    const riderAnimatedCoordRef = useRef(
      new AnimatedRegion({
        latitude: 0,
        longitude: 0,
        latitudeDelta: 0,
        longitudeDelta: 0,
      }),
    );
    // Tracks whether we've placed the marker at least once, so the very
    // first appearance snaps directly instead of gliding in from (0,0).
    const riderCoordInitializedRef = useRef(false);

    useEffect(() => {
      if (!riderMarkerLat || !riderMarkerLong) {
        // Rider marker isn't showing right now — reset so that if/when it
        // reappears (new trip, status flips back to 1/2), it snaps into
        // place instead of gliding in from wherever it last was.
        riderCoordInitializedRef.current = false;
        return;
      }

      const newCoordinate = {
        latitude: parseFloat(riderMarkerLat),
        longitude: parseFloat(riderMarkerLong),
      };

      if (!riderCoordInitializedRef.current) {
        riderAnimatedCoordRef.current.setValue({
          ...newCoordinate,
          latitudeDelta: 0,
          longitudeDelta: 0,
        });
        riderCoordInitializedRef.current = true;
        return;
      }

      // Glide to the new position over 1.5s — tune this to roughly match
      // however often the location poll actually updates, so the marker
      // finishes one glide right around when the next update arrives.
      riderAnimatedCoordRef.current
        .timing({
          latitude: newCoordinate.latitude,
          longitude: newCoordinate.longitude,
          duration: 1500,
          useNativeDriver: false,
        })
        .start();
    }, [riderMarkerLat, riderMarkerLong]);

    useImperativeHandle(ref, () => ({
      fitToMarkers: () => {
        if (mapRef.current && firstMarkerLat && secondMarkerLat) {
          mapRef.current.fitToCoordinates(
            [
              {
                latitude: parseFloat(firstMarkerLat),
                longitude: parseFloat(firstMarkerLong),
              },
              {
                latitude: parseFloat(secondMarkerLat),
                longitude: parseFloat(secondMarkerLong),
              },
            ],
            {
              edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
              animated: true,
            },
          );
        }
      },
    }));

    // Initial camera framing (pickup/dropoff pins) before a rider is assigned
    useEffect(() => {
      if (!mapReady || !mapRef.current || !locationReady) {
        return;
      }

      // Once a rider is actively being tracked, the rider-follow effect below
      // takes over framing — don't fight it with this effect.
      if (
        riderMarkerLat &&
        riderMarkerLong &&
        (statusNum === 1 || statusNum === 2)
      ) {
        return;
      }

      if (firstMarkerLat && secondMarkerLat) {
        mapRef.current.fitToCoordinates(
          [
            {
              latitude: parseFloat(firstMarkerLat),
              longitude: parseFloat(firstMarkerLong),
            },
            {
              latitude: parseFloat(secondMarkerLat),
              longitude: parseFloat(secondMarkerLong),
            },
          ],
          {
            edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
            animated: true,
          },
        );
      } else if (firstMarkerLat) {
        mapRef.current.animateToRegion(
          {
            latitude: parseFloat(firstMarkerLat),
            longitude: parseFloat(firstMarkerLong),
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          },
          500,
        );
      } else {
        mapRef.current.animateToRegion(
          {
            latitude: initialLat,
            longitude: initialLong,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          },
          500,
        );
      }
    }, [
      mapReady,
      locationReady,
      firstMarkerLat,
      firstMarkerLong,
      secondMarkerLat,
      secondMarkerLong,
      initialLat,
      initialLong,
      riderMarkerLat,
      riderMarkerLong,
      bookingStatus,
    ]);

    // 🆕 Keep camera framed on the rider + their current destination while a
    // trip is active. Status 1 = rider heading to pickup, status 2 = rider
    // (with the customer aboard) heading to dropoff. Mirrors Grab/FoodPanda
    // style live-tracking camera behavior.
    useEffect(() => {
      if (
        !mapReady ||
        !mapRef.current ||
        !riderMarkerLat ||
        !riderMarkerLong ||
        (statusNum !== 1 && statusNum !== 2)
      ) {
        return;
      }

      const destLat = statusNum === 2 ? secondMarkerLat : firstMarkerLat;
      const destLong = statusNum === 2 ? secondMarkerLong : firstMarkerLong;

      if (destLat && destLong) {
        mapRef.current.fitToCoordinates(
          [
            {
              latitude: parseFloat(riderMarkerLat),
              longitude: parseFloat(riderMarkerLong),
            },
            {
              latitude: parseFloat(destLat),
              longitude: parseFloat(destLong),
            },
          ],
          {
            edgePadding: { top: 150, right: 80, bottom: 260, left: 80 },
            animated: true,
          },
        );
      } else {
        mapRef.current.animateToRegion(
          {
            latitude: parseFloat(riderMarkerLat),
            longitude: parseFloat(riderMarkerLong),
            latitudeDelta: minDelta,
            longitudeDelta: minDelta,
          },
          500,
        );
      }
    }, [
      mapReady,
      riderMarkerLat,
      riderMarkerLong,
      bookingStatus,
      firstMarkerLat,
      firstMarkerLong,
      secondMarkerLat,
      secondMarkerLong,
      minDelta,
    ]);

    // 🆕 Route line follows the active leg of the trip, but only refetches
    // the Directions API once per leg instead of on every location poll:
    // - Rider assigned + status 1 -> draw rider -> pickup (fetched once when this leg starts)
    // - Rider assigned + status 2 -> draw rider -> dropoff (fetched once when this leg starts)
    // - No rider yet (pre-booking preview) -> static pickup -> dropoff
    // The rider's marker still moves every poll (see the animation effect
    // above) — only the drawn road-path line stays fixed within a leg,
    // which is both cheaper (fewer Directions API calls) and matches how
    // Grab/Uber behave (the planned route doesn't redraw itself constantly).
    const lastFetchedLegKeyRef = useRef(null);
    const hasRiderCoords = Boolean(riderMarkerLat && riderMarkerLong);

    useEffect(() => {
      // Build a key that identifies the current "leg" — deliberately does
      // NOT include the rider's live lat/long, so it only changes when we
      // actually enter a new leg (status flips, or the booking's pickup/
      // dropoff points change), not on every single location update.
      let legKey = null;
      if (statusNum === 1 && hasRiderCoords) {
        legKey = `pickup:${firstMarkerLat},${firstMarkerLong}`;
      } else if (statusNum === 2 && hasRiderCoords) {
        legKey = `dropoff:${secondMarkerLat},${secondMarkerLong}`;
      } else if (firstMarkerLat && secondMarkerLat) {
        legKey = `preview:${firstMarkerLat},${firstMarkerLong}-${secondMarkerLat},${secondMarkerLong}`;
      }

      if (!legKey || legKey === lastFetchedLegKeyRef.current) {
        // Either nothing to draw, or we've already fetched this exact leg —
        // skip the API call entirely.
        return;
      }

      const fetchRoute = async () => {
        let originLat, originLong, destLat, destLong;

        if (statusNum === 1 && hasRiderCoords) {
          originLat = riderMarkerLat;
          originLong = riderMarkerLong;
          destLat = firstMarkerLat;
          destLong = firstMarkerLong;
        } else if (statusNum === 2 && hasRiderCoords) {
          originLat = riderMarkerLat;
          originLong = riderMarkerLong;
          destLat = secondMarkerLat;
          destLong = secondMarkerLong;
        } else if (firstMarkerLat && secondMarkerLat) {
          originLat = firstMarkerLat;
          originLong = firstMarkerLong;
          destLat = secondMarkerLat;
          destLong = secondMarkerLong;
        } else {
          return;
        }

        if (!originLat || !originLong || !destLat || !destLong) {
          return;
        }

        try {
          const response = await fetchWithTimeout(
            `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLong}&destination=${destLat},${destLong}&mode=driving&key=${Constants.GOOGLE_MAP_API_KEY}`,
          );
          const data = await response.json();
          if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            setRouteCoords(decodePolyline(route.overview_polyline.points));

            // 🆕 Pull the road-snapped endpoints straight out of the
            // Directions response so the pickup/dropoff pins line up
            // exactly with where the polyline actually starts/ends.
            // The rider marker is NEVER snapped — it should always show
            // real GPS, or it would appear to teleport onto roads.
            const leg = route.legs && route.legs[0];
            if (leg) {
              if (statusNum === 1 && hasRiderCoords) {
                // This leg's destination IS the pickup point
                setSnappedPickup({
                  latitude: leg.end_location.lat,
                  longitude: leg.end_location.lng,
                });
              } else if (statusNum === 2 && hasRiderCoords) {
                // This leg's destination IS the dropoff point
                setSnappedDropoff({
                  latitude: leg.end_location.lat,
                  longitude: leg.end_location.lng,
                });
              } else if (firstMarkerLat && secondMarkerLat) {
                // Pre-booking preview leg: start = pickup, end = dropoff
                setSnappedPickup({
                  latitude: leg.start_location.lat,
                  longitude: leg.start_location.lng,
                });
                setSnappedDropoff({
                  latitude: leg.end_location.lat,
                  longitude: leg.end_location.lng,
                });
              }
            }
          }
        } catch (e) {
          console.error('Error fetching route:', e);
        }
      };

      fetchRoute();
      lastFetchedLegKeyRef.current = legKey;
    }, [
      statusNum,
      firstMarkerLat,
      firstMarkerLong,
      secondMarkerLat,
      secondMarkerLong,
      hasRiderCoords,
    ]);

    const decodePolyline = encoded => {
      let points = [],
        index = 0,
        lat = 0,
        lng = 0;
      while (index < encoded.length) {
        let b,
          shift = 0,
          result = 0;
        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        const dlat = result & 1 ? ~(result >> 1) : result >> 1;
        lat += dlat;
        shift = 0;
        result = 0;
        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        const dlng = result & 1 ? ~(result >> 1) : result >> 1;
        lng += dlng;
        points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
      }
      return points;
    };

    // 🆕 Final coordinates used by the Marker components below. Prefer the
    // road-snapped point (matches the polyline exactly); fall back to the
    // raw address lat/long until the route has loaded for the first time.
    const pickupCoord =
      snappedPickup ||
      (firstMarkerLat && firstMarkerLong
        ? {
            latitude: parseFloat(firstMarkerLat),
            longitude: parseFloat(firstMarkerLong),
          }
        : null);

    const dropoffCoord =
      snappedDropoff ||
      (secondMarkerLat && secondMarkerLong
        ? {
            latitude: parseFloat(secondMarkerLat),
            longitude: parseFloat(secondMarkerLong),
          }
        : null);

    return (
      <MapView
        ref={mapRef}
        style={[styles.container, style]}
        provider="google"
        onMapReady={() => setMapReady(true)}
        initialRegion={{
          latitude: 14.5995,
          longitude: 120.9842,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={interactive}
        toolbarEnabled={interactive}
        showsPointsOfInterest={true}
        mapType="standard"
        onPress={
          interactive && onMapPress
            ? e => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                onMapPress({ latitude, longitude });
              }
            : null
        }>
        {pickupCoord && (
          <Marker
            coordinate={pickupCoord}
            title="Pickup"
            anchor={{ x: 0.5, y: 0.5 }} // bottom-center — the icon's point touches the exact coordinate
          >
            <Image
              source={require('@/Assets/Common/Pick_Up_Icon.png')}
              style={styles.pinIcon}
              resizeMode="contain"
            />
          </Marker>
        )}
        {dropoffCoord && (
          <Marker
            coordinate={dropoffCoord}
            title="Dropoff"
            anchor={{ x: 0.5, y: 0.5 }}>
            <Image
              source={require('@/Assets/Common/Drop_Off_Icon.png')}
              style={styles.pinIcon}
              resizeMode="contain"
            />
          </Marker>
        )}
        {/* Rider marker - visible when bookingStatus === 1 (heading to pickup)
            or bookingStatus === 2 (heading to dropoff with customer aboard).
            Uses MarkerAnimated so it glides between location updates instead
            of snapping instantly. */}
        {riderMarkerLat && riderMarkerLong && (
          <MarkerAnimated
            coordinate={riderAnimatedCoordRef.current}
            title="Rider"
            description={
              statusNum === 2
                ? 'On the way to drop-off'
                : 'On the way to pick you up'
            }
            anchor={{ x: 0.5, y: 0.5 }} // center-anchored — a vehicle icon sits ON the coordinate, not above it
          >
            <Image
              source={require('@/Assets/Common/Rider_Icon.png')}
              style={styles.riderIcon}
              resizeMode="contain"
            />
          </MarkerAnimated>
        )}
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={colors.primary}
            strokeWidth={5}
          />
        )}
      </MapView>
    );
  },
);

export default AppMap;

const getStyles = ({ colors }) =>
  StyleSheet.create({
    container: { flex: 1 },
    // 🆕 Custom marker icon sizes. Tweak these to match your actual PNG
    // dimensions/design — pickup & dropoff are typically a bit larger
    // "pin"-style icons, rider is usually a smaller vehicle/avatar icon.
    pinIcon: {
      width: 40,
      height: 40,
    },
    riderIcon: {
      width: 50,
      height: 50,
    },
  });
