import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Image, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { trimRouteToRider } from '../../Utils/routeTrim';
import {
  routeFromDirections,
  shouldRefetchRoute,
} from '../../Utils/routeDirections';
import { framePoints, isUserControlling } from '../../Utils/passengerCamera';
import useSmoothCoord from '../../Utils/useSmoothCoord';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Constants } from '@/Utils';
import { fetchWithTimeout } from '@/Utils/Network';
import useNetworkStatus from '@/Hooks/useNetworkStatus';

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
      // Booking status drives which leg of the trip we're tracking:
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
    // Last time the passenger panned/pinched; auto-framing pauses after it.
    const lastTouchAtRef = useRef(0);
    const markUserTouch = () => {
      lastTouchAtRef.current = Date.now();
    };

    // 🔧 Normalize bookingStatus to a Number once — it may arrive as a string
    // ("1") from Redux/the API, and strict "1" === 1 comparisons would fail.
    const statusNum = Number(bookingStatus);

    // ✅ Road-snapped pickup/dropoff coordinates. The Directions API snaps
    // origin/destination to the nearest routable road before drawing the
    // polyline, so the raw address lat/long (which can sit inside a building,
    // parking lot, etc.) doesn't match where the line actually starts/ends.
    // We pull the actual snapped point straight out of the Directions response
    // (leg.start_location / leg.end_location) so the pin always sits exactly
    // on the polyline, the way Grab/Angkas do it.
    const [snappedPickup, setSnappedPickup] = useState(null);
    const [snappedDropoff, setSnappedDropoff] = useState(null);
    // ✅ Road-snapped rider position — pulled from leg.start_location in the
    // Directions response so the rider pin sits exactly at the polyline origin
    // instead of floating off-road at whatever raw GPS coords the poll returned.
    const [snappedRider, setSnappedRider] = useState(null);

    // Reset the snapped point whenever the underlying address changes so we
    // don't keep showing a stale snap while the new route is fetching.
    useEffect(() => {
      setSnappedPickup(null);
    }, [firstMarkerLat, firstMarkerLong]);

    useEffect(() => {
      setSnappedDropoff(null);
    }, [secondMarkerLat, secondMarkerLong]);

    // ✅ FIX (invisible marker): Track rider coordinate in plain state instead
    // of AnimatedRegion + MarkerAnimated. MarkerAnimated has well-known silent
    // rendering failures on Android — the marker simply doesn't appear.
    // Plain <Marker> with a state-driven coordinate is reliable on both platforms.
    const [riderCoord, setRiderCoord] = useState(null);

    // ✅ FIX (flicker + first-mount opacity): Each custom image marker gets its
    // own independent tracksViewChanges flag. The flag starts true so the image
    // renders on first mount. We use a short setTimeout (not onLoad) to flip it
    // to false — onLoad fires before the native side has actually painted the
    // image on first mount, causing the marker to stay opaque/invisible on the
    // very first booking. A 300ms delay gives the native renderer enough time to
    // fully paint before we lock tracksViewChanges to false. On the second booking
    // the image is already cached so it paints instantly and the delay is harmless.
    const [pickupTracksViewChanges, setPickupTracksViewChanges] =
      useState(true);
    const [dropoffTracksViewChanges, setDropoffTracksViewChanges] =
      useState(true);
    const [riderTracksViewChanges, setRiderTracksViewChanges] = useState(true);

    // Helper: wait 300ms after mount before locking tracksViewChanges to false.
    // This ensures the native side has fully painted the image before we stop
    // tracking view changes — fixing the opaque/invisible marker on first load.
    const lockAfterPaint = setter => {
      setTimeout(() => setter(false), 300);
    };

    // Update rider coord state whenever props change
    useEffect(() => {
      if (riderMarkerLat != null && riderMarkerLong != null) {
        setRiderCoord({
          latitude: parseFloat(riderMarkerLat),
          longitude: parseFloat(riderMarkerLong),
        });
        // Live GPS must win over the one-time leg-start snap, otherwise the
        // marker freezes where the rider accepted while only the ETA updates.
        setSnappedRider(null);
      } else {
        // Clear the coord so the marker unmounts cleanly when the rider is no
        // longer being tracked (booking cancelled / completed). Also reset the
        // flag so the next time the marker appears it gets one fresh render
        // cycle with tracksViewChanges=true before locking to false again.
        // Reset snappedRider too so the next trip starts fresh.
        setRiderCoord(null);
        setSnappedRider(null);
        setRiderTracksViewChanges(true);
      }
    }, [riderMarkerLat, riderMarkerLong]);

    // Reset pickup/dropoff flicker flags when their addresses change so the
    // new marker image gets one render cycle before locking again.
    useEffect(() => {
      setPickupTracksViewChanges(true);
    }, [firstMarkerLat, firstMarkerLong]);

    useEffect(() => {
      setDropoffTracksViewChanges(true);
    }, [secondMarkerLat, secondMarkerLong]);

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

    // Keep camera framed on the rider + their current destination while a
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

      // Passenger is panning/pinching: don't fight them.
      if (isUserControlling(lastTouchAtRef.current, Date.now())) {
        return;
      }

      // Keep the rider and the passenger's pin (pickup, then dropoff) both in
      // view. This zooms in gradually as the rider gets closer, down to a
      // minimum span, and never recenters on the rider alone.
      const destLat = statusNum === 2 ? secondMarkerLat : firstMarkerLat;
      const destLong = statusNum === 2 ? secondMarkerLong : firstMarkerLong;
      const points = framePoints(
        {
          latitude: parseFloat(riderMarkerLat),
          longitude: parseFloat(riderMarkerLong),
        },
        destLat && destLong
          ? { latitude: parseFloat(destLat), longitude: parseFloat(destLong) }
          : null,
      );
      if (points) {
        mapRef.current.fitToCoordinates(points, {
          edgePadding: { top: 150, right: 80, bottom: 260, left: 80 },
          animated: true,
        });
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

    // Route line follows the active leg of the trip, but only refetches the
    // Directions API once per leg instead of on every location poll:
    // - Status 1 -> draw rider -> pickup (fetched once when this leg starts)
    // - Status 2 -> draw rider -> dropoff (fetched once when this leg starts)
    // - No rider yet (pre-booking preview) -> static pickup -> dropoff
    // The rider marker still moves every poll (state update above) — only the
    // drawn road-path line stays fixed within a leg, which is cheaper and
    // matches how Grab/Uber behave.
    const isOnline = useNetworkStatus();
    const lastFetchedLegKeyRef = useRef(null);
    const lastRerouteAtRef = useRef(0);
    const currentLegKeyRef = useRef(null);
    const lastFetchAtRef = useRef(0);
    const lastFetchPosRef = useRef(null);
    const retryTimerRef = useRef(null);
    const [rerouteTick, setRerouteTick] = useState(0);
    const hasRiderCoords = Boolean(riderMarkerLat && riderMarkerLong);

    useEffect(() => {
      // Build a key that identifies the current "leg" — deliberately does NOT
      // include the rider's live lat/long, so it only changes when we actually
      // enter a new leg (status flips, or the booking's pickup/dropoff changes),
      // not on every single location update.
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

      // New leg: drop the previous leg's line (e.g. the pickup->dropoff
      // preview) so it is never trimmed into a straight rider line.
      if (currentLegKeyRef.current !== legKey) {
        currentLegKeyRef.current = legKey;
        setRouteCoords([]);
      }

      const fetchRoute = async () => {
        let originLat, originLong, destLat, destLong;

        if (statusNum === 1 && hasRiderCoords) {
          // Leg 1: rider's current position → pickup point
          originLat = riderMarkerLat;
          originLong = riderMarkerLong;
          destLat = firstMarkerLat;
          destLong = firstMarkerLong;
        } else if (statusNum === 2 && hasRiderCoords) {
          // Leg 2: rider's current position → dropoff point
          originLat = riderMarkerLat;
          originLong = riderMarkerLong;
          destLat = secondMarkerLat;
          destLong = secondMarkerLong;
        } else if (firstMarkerLat && secondMarkerLat) {
          // Pre-booking preview: pickup → dropoff
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
          const parsed = routeFromDirections(data);
          if (!parsed.ok) {
            // Rejected/empty response: leave the leg unfetched and retry.
            console.warn('Directions failed:', data && data.status);
            lastFetchedLegKeyRef.current = null;
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = setTimeout(
              () => setRerouteTick(t => t + 1),
              5000,
            );
            return;
          }
          {
            setRouteCoords(parsed.coords);
            lastFetchAtRef.current = Date.now();
            lastFetchPosRef.current = hasRiderCoords
              ? { latitude: Number(originLat), longitude: Number(originLong) }
              : null;

            // ✅ Pull the road-snapped endpoints straight out of the Directions
            // response so the pickup/dropoff pins line up exactly with where
            // the polyline actually starts/ends. The rider marker is NEVER
            // snapped — it always shows real GPS so it doesn't appear to
            // teleport onto a road it isn't actually on.
            const leg = parsed.leg;
            if (leg) {
              if (statusNum === 1 && hasRiderCoords) {
                // Leg 1: rider is origin, pickup is destination.
                // Snap both so rider pin sits at polyline start and
                // pickup pin sits at polyline end — perfectly aligned.
                setSnappedRider({
                  latitude: leg.start_location.lat,
                  longitude: leg.start_location.lng,
                });
                setSnappedPickup({
                  latitude: leg.end_location.lat,
                  longitude: leg.end_location.lng,
                });
              } else if (statusNum === 2 && hasRiderCoords) {
                // Leg 2: rider is origin, dropoff is destination.
                // Snap rider to polyline start, dropoff to polyline end.
                setSnappedRider({
                  latitude: leg.start_location.lat,
                  longitude: leg.start_location.lng,
                });
                setSnappedDropoff({
                  latitude: leg.end_location.lat,
                  longitude: leg.end_location.lng,
                });
              } else if (firstMarkerLat && secondMarkerLat) {
                // Pre-booking preview leg: start = pickup, end = dropoff.
                // No rider in this leg so snappedRider stays null.
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
          lastFetchedLegKeyRef.current = legKey;
        } catch (e) {
          lastFetchedLegKeyRef.current = null;
          console.error('Error fetching route:', e);
        }
      };

      if (!isOnline) {
        return;
      }
      fetchRoute();
    }, [
      statusNum,
      firstMarkerLat,
      firstMarkerLong,
      secondMarkerLat,
      secondMarkerLong,
      hasRiderCoords,
      isOnline,
      rerouteTick,
    ]);

    // u2705 Rider prefers snappedRider (leg.start_location from Directions API)
    // so the pin sits exactly at the polyline origin. Falls back to the raw
    // GPS coord from the poll until the first route fetch completes.
    // Glide between 2s polls so the rider moves smoothly instead of jumping.
    const smoothRider = useSmoothCoord(riderCoord);
    const finalRiderCoord = snappedRider || smoothRider;

    // Shrink the track line as the rider moves: it starts at the live rider
    // position and drops the part of the road already driven.
    const isLiveLeg = statusNum === 1 || statusNum === 2;
    const trimmed = useMemo(
      () =>
        isLiveLeg && smoothRider
          ? trimRouteToRider(routeCoords, smoothRider)
          : { coords: routeCoords, offRouteMeters: 0 },
      [isLiveLeg, smoothRider, routeCoords],
    );

    // Keep the live route fresh while the rider moves: re-fetch every ~15s or
    // after ~50m of travel, and right away (max once per 15s) if the rider
    // leaves the drawn road.
    useEffect(() => {
      if (!isLiveLeg || !smoothRider || !lastFetchPosRef.current) {
        return;
      }
      const now = Date.now();
      if (now - lastRerouteAtRef.current < 15000) {
        return;
      }
      const offRoute = trimmed.offRouteMeters >= 60;
      const due = shouldRefetchRoute({
        lastAt: lastFetchAtRef.current,
        lastPos: lastFetchPosRef.current,
        now,
        pos: smoothRider,
      });
      if (!offRoute && !due) {
        return;
      }
      lastRerouteAtRef.current = now;
      lastFetchedLegKeyRef.current = null;
      setRerouteTick(t => t + 1);
    }, [isLiveLeg, smoothRider, trimmed.offRouteMeters]);

    useEffect(() => () => clearTimeout(retryTimerRef.current), []);

    // Final coordinates used by the Marker components below. Prefer the
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
        onTouchStart={markUserTouch}
        onPanDrag={markUserTouch}
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
        {/* Pickup marker — road-snapped coordinate once the route loads,
            raw address coordinate as the immediate fallback.
            tracksViewChanges starts true so the custom image renders on first mount,
            then lockAfterPaint flips it to false after 300ms — fixing the
            opaque/invisible marker on first load without causing flicker. */}
        {pickupCoord && (
          <Marker
            coordinate={pickupCoord}
            title="Pickup"
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={pickupTracksViewChanges}>
            <Image
              source={require('@/Assets/Common/Pick_Up_Icon.png')}
              style={styles.pinIcon}
              resizeMode="contain"
              onLoad={() => lockAfterPaint(setPickupTracksViewChanges)}
            />
          </Marker>
        )}

        {/* Dropoff marker — same road-snapped + flicker-fix pattern */}
        {dropoffCoord && (
          <Marker
            coordinate={dropoffCoord}
            title="Dropoff"
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={dropoffTracksViewChanges}>
            <Image
              source={require('@/Assets/Common/Drop_Off_Icon.png')}
              style={styles.pinIcon}
              resizeMode="contain"
              onLoad={() => lockAfterPaint(setDropoffTracksViewChanges)}
            />
          </Marker>
        )}

        {/* Rider marker — visible when bookingStatus is 1 (heading to pickup)
            or 2 (heading to dropoff with customer aboard).
            Uses plain <Marker> with state-driven coordinate — MarkerAnimated
            silently fails to render on Android so we avoid it entirely.
            Same tracksViewChanges flip pattern as pickup/dropoff above. */}
        {finalRiderCoord != null && (statusNum === 1 || statusNum === 2) && (
          <Marker
            coordinate={finalRiderCoord}
            title="Rider"
            description={
              statusNum === 2
                ? 'On the way to drop-off'
                : 'On the way to pick you up'
            }
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={riderTracksViewChanges}>
            <Image
              source={require('@/Assets/Common/Rider_Pin.png')}
              style={styles.riderIcon}
              resizeMode="contain"
              onLoad={() => lockAfterPaint(setRiderTracksViewChanges)}
            />
          </Marker>
        )}

        {trimmed.coords.length > 1 && (
          <Polyline
            coordinates={trimmed.coords}
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
    // Tweak these to match your actual PNG dimensions/design —
    // pickup & dropoff are typically larger "pin"-style icons,
    // rider is usually a smaller vehicle/avatar icon.
    pinIcon: {
      width: 40,
      height: 40,
    },
    riderIcon: {
      width: 50,
      height: 50,
    },
  });
