import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { routeFromDirections } from '../../Utils/routeDirections';
import { remember, routeAvoiding, stillClosed } from '../../Utils/closedRoad';
import {
  followCamera,
  followsByDefault,
  framePoints,
  isUserControlling,
  needsFollowStep,
  needsReframe,
} from '../../Utils/passengerCamera';
import { overviewPadding } from '../../Utils/overviewPadding';
import useVehicleTracker from '../../Utils/useVehicleTracker';
import NavArrow from './NavArrow';
import MapView, { Circle, Marker, Polyline } from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { modern } from '@/Theme/modern';
import { SWEEP_MS, boundsAround, ringsAt } from '../../Utils/radarPing';
import { Constants } from '@/Utils';
import { fetchWithTimeout } from '@/Utils/Network';
import useNetworkStatus from '@/Hooks/useNetworkStatus';

// Reroute when the rider is this far off the drawn road (at most every 10 s).
const REROUTE_OFF_ROUTE_METERS = 50;
const REROUTE_MIN_INTERVAL_MS = 10000;
// Camera refresh while a rider is tracked.
// Follow view: how often to check whether the camera should step, and how
// long a step takes.
const FOLLOW_CHECK_MS = 500;
const FOLLOW_STEP_MS = 700;
// Follow view: map area (dp) hidden under the header and Emergency buttons.
const FOLLOW_TOP_PADDING = 90;
const OVERVIEW_CAMERA_MS = 3000;
// When the rider fix carries no timing (older data), assume this age.
const UNKNOWN_FIX_AGE_MS = 1500;

// A rider from the "Riders nearby" button: a dark disc with a gold motorbike,
// in a white ring, drawn above the route (the owner, 2026-11-22: "can we make
// the riders be seen more", it was a small dot; then "down size a little").
// Painted once the icon font has drawn, then left alone (tracksViewChanges).
const NearbyDot = ({ coordinate }) => {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTracks(false), 1000);
    return () => clearTimeout(t);
  }, []);
  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={5}
      tracksViewChanges={tracks}>
      {/* room around the disc, so its shadow is not cut off */}
      <View style={dotStyles.room}>
        <View style={dotStyles.disc}>
          <Icon name="motorbike" size={16} color="#FEC107" />
        </View>
      </View>
    </Marker>
  );
};

// The radar ping while a rider is being found: gold rings sweeping out from
// the pickup to the reach of the request (Utils/radarPing.js), and nothing
// else: no fixed line where the reach ends (the owner, 2026-11-22: "only the
// radar should be showing"). On a phone set to reduce motion the rings hold
// still.
const RADAR_FRAME_MS = 40;
const RADAR_STILL_MS = SWEEP_MS * 0.3;
const gold = alpha => `rgba(254, 193, 7, ${alpha.toFixed(3)})`;
const RadarPing = ({ center, radiusM }) => {
  const [still, setStill] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(reduce => alive && setStill(Boolean(reduce)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (still) {
      return undefined;
    }
    const start = Date.now();
    const timer = setInterval(
      () => setElapsed(Date.now() - start),
      RADAR_FRAME_MS,
    );
    return () => clearInterval(timer);
  }, [still]);
  return (
    <>
      {ringsAt(still ? RADAR_STILL_MS : elapsed).map((ring, i) => (
        <Circle
          key={`ring-${i}`}
          center={center}
          radius={Math.max(1, ring.share * radiusM)}
          strokeWidth={2}
          strokeColor={gold(0.9 * ring.alpha)}
          fillColor={gold(0.2 * ring.alpha)}
          zIndex={2}
        />
      ))}
    </>
  );
};

const dotStyles = StyleSheet.create({
  room: {
    padding: 3,
  },
  disc: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17171C',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 4,
  },
});

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
      // Rider GPS fix (only meaningful when bookingStatus === 1 or 2).
      // riderFixAt: local time (ms) the fix was taken; riderFixId: identifies
      // the fix so the same one polled twice is not counted as two;
      // riderHeardAt: local time (ms) the rider's phone last reported in.
      riderMarkerLat,
      riderMarkerLong,
      riderFixAt,
      riderFixId,
      riderHeardAt,
      // Booking status drives which leg of the trip we're tracking:
      // 1 = rider heading to pickup, 2 = rider (with customer) heading to dropoff
      bookingStatus,
      // Height of the sheet covering the bottom of the map, so the camera
      // frames the rider in the part of the map that is actually visible.
      bottomInset = 0,
      onMapPress,
      interactive = true,
      // the person's own position, Google's blue dot (needs location access)
      showsUser = true,
      // the "Riders nearby" button's riders ([{ lat, long }], useNearbyRiders)
      nearbyRiders = null,
      // while a rider is being found: { lat, long, radiusM }, the pickup and
      // the reach of the request, drawn as a radar ping and kept in view
      radar = null,
      style,
    },
    ref,
  ) => {
    const theme = useTheme();
    const { colors } = theme;
    const look = modern(theme);
    const styles = getStyles({ colors, look });
    // the rider coming to the pick-up (the owner's design "8 · Rider found",
    // 2026-11-23): a black motorcycle and a dotted line to the pick-up; during
    // the trip itself, the heading arrow and the solid line
    const riderComing = Number(bookingStatus) === 1;
    const mapRef = useRef(null);
    const [mapReady, setMapReady] = useState(false);
    const mapHeightRef = useRef(0); // dp, for the overview framing
    const mapWidthRef = useRef(0); // dp
    // where the map's blue dot last put the person
    const userCoordRef = useRef(null);
    // the radar ping, in plain numbers so effects and markers can follow it
    const radarLat = radar ? Number(radar.lat) : NaN;
    const radarLong = radar ? Number(radar.long) : NaN;
    const radarRadius = radar ? Number(radar.radiusM) : NaN;
    const radarOn =
      Number.isFinite(radarLat) &&
      Number.isFinite(radarLong) &&
      radarRadius > 0;
    const radarCenter = useMemo(
      () => (radarOn ? { latitude: radarLat, longitude: radarLong } : null),
      [radarOn, radarLat, radarLong],
    );
    const [routeCoords, setRouteCoords] = useState([]);
    // Last time the passenger panned/pinched; auto-framing pauses after it.
    const lastTouchAtRef = useRef(0);
    const markUserTouch = () => {
      lastTouchAtRef.current = Date.now();
    };

    // bookingStatus may arrive as a string ("1") from Redux/the API.
    const statusNum = Number(bookingStatus);
    const isLiveLeg = statusNum === 1 || statusNum === 2;
    const hasRiderCoords = Boolean(riderMarkerLat && riderMarkerLong);

    // Road-snapped pickup/dropoff coordinates: the Directions API snaps the
    // origin/destination to the nearest road, so the pins are placed on the
    // actual ends of the drawn line instead of inside a building.
    const [snappedPickup, setSnappedPickup] = useState(null);
    const [snappedDropoff, setSnappedDropoff] = useState(null);

    useEffect(() => {
      setSnappedPickup(null);
    }, [firstMarkerLat, firstMarkerLong]);

    useEffect(() => {
      setSnappedDropoff(null);
    }, [secondMarkerLat, secondMarkerLong]);

    // Default: Grab-style overview (flat, north-up, rider + pickup/drop-off in
    // frame). "Follow driver" switches to a tilted, heading-up follow camera.
    // Follow view or overview. Each leg starts with its own default (follow
    // in transit, overview while the rider is coming); the button overrides
    // it for the rest of that leg.
    const [followChoice, setFollowChoice] = useState(null);
    useEffect(() => {
      setFollowChoice(null);
    }, [statusNum]);
    const followDriver =
      followChoice != null ? followChoice : followsByDefault(statusNum);

    // Custom image markers need one painted frame before tracksViewChanges is
    // turned off, or they stay invisible on Android.
    const [pickupTracksViewChanges, setPickupTracksViewChanges] =
      useState(true);
    const [dropoffTracksViewChanges, setDropoffTracksViewChanges] =
      useState(true);
    const [riderTracksViewChanges, setRiderTracksViewChanges] = useState(true);
    const lockAfterPaint = setter => {
      setTimeout(() => setter(false), 300);
    };

    useEffect(() => {
      setPickupTracksViewChanges(true);
    }, [firstMarkerLat, firstMarkerLong]);

    // While the rider comes, the pick-up is a plain View (the blue dot below,
    // no image onLoad): paint it, then lock it. Leaving that look paints the
    // pin again (its image's onLoad locks it).
    useEffect(() => {
      setPickupTracksViewChanges(true);
      if (!riderComing) {
        return undefined;
      }
      const t = setTimeout(() => setPickupTracksViewChanges(false), 1000);
      return () => clearTimeout(t);
    }, [riderComing, firstMarkerLat, firstMarkerLong]);

    useEffect(() => {
      setDropoffTracksViewChanges(true);
    }, [secondMarkerLat, secondMarkerLong]);

    // ---- live rider tracking -------------------------------------------
    // One source of truth: the rider's reported GPS. The tracker pins it to
    // the route, runs it forward at the rider's speed to cover the reporting
    // delay, never moves it backwards, and points it along the road.
    const riderFix = useMemo(() => {
      if (!isLiveLeg || !hasRiderCoords) {
        return null;
      }
      return {
        latitude: parseFloat(riderMarkerLat),
        longitude: parseFloat(riderMarkerLong),
        at: riderFixAt != null ? riderFixAt : Date.now() - UNKNOWN_FIX_AGE_MS,
        id:
          riderFixId != null
            ? riderFixId
            : `${riderMarkerLat},${riderMarkerLong}`,
        heardAt: riderHeardAt != null ? riderHeardAt : null,
      };
    }, [
      isLiveLeg,
      hasRiderCoords,
      riderMarkerLat,
      riderMarkerLong,
      riderFixAt,
      riderFixId,
      riderHeardAt,
    ]);

    const tracked = useVehicleTracker({
      routeCoords,
      fix: riderFix,
      enabled: isLiveLeg,
    });

    const riderCoord =
      tracked.coord ||
      (riderFix
        ? { latitude: riderFix.latitude, longitude: riderFix.longitude }
        : null);
    const riderShown = isLiveLeg && riderCoord != null;

    // Latest tracked values for the camera timer (it must not restart on
    // every frame of rider movement).
    const riderCoordRef = useRef(null);
    const riderHeadingRef = useRef(0);
    riderCoordRef.current = riderShown ? riderCoord : null;
    riderHeadingRef.current = tracked.heading;

    // The arrow marker is a plain View (no image onLoad): once it is on the
    // map, give it time to paint, then lock it.
    // The marker changes look once the passenger is picked up: paint again.
    useEffect(() => {
      setRiderTracksViewChanges(true);
      if (!riderShown) {
        return undefined;
      }
      const t = setTimeout(() => setRiderTracksViewChanges(false), 1000);
      return () => clearTimeout(t);
    }, [riderShown, riderComing]);

    useImperativeHandle(ref, () => ({
      // The locate button: back to where the person is, as the map's own
      // blue dot knows it (else as the caller does).
      centerOn: fallback => {
        // the caller's position first: the map stops reporting one while
        // its dot is hidden
        const { latitude, longitude } =
          (fallback?.latitude != null ? fallback : userCoordRef.current) || {};
        if (mapRef.current && latitude != null && longitude != null) {
          mapRef.current.animateToRegion(
            {
              latitude: Number(latitude),
              longitude: Number(longitude),
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            },
            400,
          );
        }
      },
      // Where the map's blue dot puts the person, { lat, long }, or null.
      userPoint: () => {
        const { latitude, longitude } = userCoordRef.current || {};
        return latitude != null && longitude != null
          ? { lat: latitude, long: longitude }
          : null;
      },
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

    // ---- camera ----------------------------------------------------------
    // Before a rider is tracked: frame the pickup/dropoff pins.
    useEffect(() => {
      if (!mapReady || !mapRef.current || !locationReady) {
        return;
      }
      // Once a rider is tracked, the live camera below takes over.
      if (hasRiderCoords && isLiveLeg) {
        return;
      }

      // A region that puts one point in the middle of what the sheet leaves
      // visible, rather than the middle of the whole map. The map fits a
      // square region to its width, so it shows delta / width latitude per dp.
      const regionAbove = (lat, long, delta = 0.05) => {
        const width = mapWidthRef.current;
        const height = mapHeightRef.current;
        const covered = Math.min(Math.max(0, bottomInset || 0), height * 0.85);
        const shift = width > 0 ? (delta * covered) / (2 * width) : 0;
        return {
          latitude: lat - shift,
          longitude: long,
          latitudeDelta: delta,
          longitudeDelta: delta,
        };
      };

      if (radarOn) {
        // a rider is being found: the whole reach of the request in view
        mapRef.current.fitToCoordinates(
          boundsAround(radarLat, radarLong, radarRadius),
          {
            edgePadding: overviewPadding(mapHeightRef.current, bottomInset),
            animated: true,
          },
        );
      } else if (firstMarkerLat && secondMarkerLat) {
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
            // Above the booking sheet, not behind it: it can cover most of
            // the map (the same padding as the rider overview).
            edgePadding: overviewPadding(mapHeightRef.current, bottomInset),
            animated: true,
          },
        );
      } else if (firstMarkerLat) {
        mapRef.current.animateToRegion(
          regionAbove(parseFloat(firstMarkerLat), parseFloat(firstMarkerLong)),
          500,
        );
      } else {
        mapRef.current.animateToRegion(
          regionAbove(Number(initialLat), Number(initialLong)),
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
      hasRiderCoords,
      isLiveLeg,
      // the sheet grew or shrank: frame the trip above it again
      bottomInset,
      radarOn,
      radarLat,
      radarLong,
      radarRadius,
    ]);

    // While a rider is tracked.
    //  - Overview (default while the rider is coming): flat, north-up, the
    //    rider and the passenger's pin both in view, zooming in as they get
    //    closer.
    //  - Follow (default in transit): behind the vehicle, facing the way it
    //    is going, so the passenger sees the trip moving forward. The map
    //    holds still while the vehicle drives up the screen and steps
    //    forward every so often (see passengerCamera.js for why).
    // Either way the camera leaves the map alone for 10 s after the passenger
    // pans or pinches.
    const destLat = statusNum === 2 ? secondMarkerLat : firstMarkerLat;
    const destLong = statusNum === 2 ? secondMarkerLong : firstMarkerLong;
    useEffect(() => {
      if (!mapReady || !riderShown) {
        return undefined;
      }
      const dest =
        destLat && destLong
          ? { latitude: parseFloat(destLat), longitude: parseFloat(destLong) }
          : null;

      // What the camera was last aimed at (null = aim it again).
      let last = null;
      const update = () => {
        const map = mapRef.current;
        const rider = riderCoordRef.current;
        if (!map || !rider) {
          return;
        }
        if (isUserControlling(lastTouchAtRef.current, Date.now())) {
          last = null; // come back to the vehicle once they let go
          return;
        }
        const heading = riderHeadingRef.current;
        if (followDriver) {
          // The map holds still while the vehicle drives up the screen, and
          // steps forward when it has gone far enough or has turned.
          if (needsFollowStep(last, rider, heading)) {
            last = { rider, heading };
            map.animateCamera(followCamera(rider, heading), {
              duration: FOLLOW_STEP_MS,
            });
          }
          return;
        }
        // Overview: nothing to re-frame until the rider has moved.
        if (!needsReframe(last && last.rider, rider)) {
          return;
        }
        last = { rider, heading };
        // Fitting bounds also resets the map to flat and north-up.
        const points = framePoints(rider, dest);
        if (points) {
          map.fitToCoordinates(points, {
            // bottomInset: what covers the bottom of the map (trip sheet,
            // floating banners).
            edgePadding: overviewPadding(mapHeightRef.current, bottomInset),
            animated: true,
          });
        } else {
          map.animateCamera(
            { center: rider, pitch: 0, heading: 0 },
            { duration: 500 },
          );
        }
      };

      update();
      const timer = setInterval(
        update,
        followDriver ? FOLLOW_CHECK_MS : OVERVIEW_CAMERA_MS,
      );
      return () => clearInterval(timer);
    }, [mapReady, riderShown, followDriver, destLat, destLong, bottomInset]);

    // ---- route line --------------------------------------------------------
    // One Directions request per leg (rider -> pickup, rider -> drop-off, or
    // the pickup -> drop-off preview before a rider is assigned), plus a
    // reroute only when the rider actually leaves the drawn road.
    const isOnline = useNetworkStatus();
    const lastFetchedLegKeyRef = useRef(null);
    // the leg a Directions request is on its way for: the effect can run
    // twice before the first answer, and each run was a paid request
    const inFlightLegKeyRef = useRef(null);
    const currentLegKeyRef = useRef(null);
    const lastRerouteAtRef = useRef(0);
    const retryTimerRef = useRef(null);
    const [rerouteTick, setRerouteTick] = useState(0);
    // The line ahead while the rider was last on it, and the stretches of road
    // they left on this leg, which reroutes keep off (Utils/closedRoad: a road
    // left may be closed, and Google may not know).
    const lastAheadRef = useRef(null);
    const closedStretchesRef = useRef([]);

    useEffect(() => {
      if (tracked.onRoute && tracked.remaining) {
        lastAheadRef.current = tracked.remaining;
      }
    }, [tracked.onRoute, tracked.remaining]);

    useEffect(() => {
      if (riderFix) {
        closedStretchesRef.current = stillClosed(closedStretchesRef.current, {
          latitude: riderFix.latitude,
          longitude: riderFix.longitude,
        });
      }
    }, [riderFix]);

    useEffect(() => {
      // The key identifies the leg, not the rider's live position, so it only
      // changes when a new leg starts or the pins change.
      let legKey = null;
      if (statusNum === 1 && hasRiderCoords) {
        legKey = `pickup:${firstMarkerLat},${firstMarkerLong}`;
      } else if (statusNum === 2 && hasRiderCoords) {
        legKey = `dropoff:${secondMarkerLat},${secondMarkerLong}`;
      } else if (firstMarkerLat && secondMarkerLat) {
        legKey = `preview:${firstMarkerLat},${firstMarkerLong}-${secondMarkerLat},${secondMarkerLong}`;
      }

      // No leg any more (a point was cleared, or the trip ended): take the
      // old line off the map, and fetch afresh if the same leg comes back.
      if (!legKey) {
        if (currentLegKeyRef.current !== null) {
          currentLegKeyRef.current = null;
          lastFetchedLegKeyRef.current = null;
          setRouteCoords([]);
        }
        return;
      }
      if (
        legKey === lastFetchedLegKeyRef.current ||
        legKey === inFlightLegKeyRef.current
      ) {
        return;
      }

      // New leg: drop the previous leg's line (e.g. the pickup -> drop-off
      // preview) so the rider is never tracked along the wrong road.
      if (currentLegKeyRef.current !== legKey) {
        currentLegKeyRef.current = legKey;
        setRouteCoords([]);
        lastAheadRef.current = null;
        closedStretchesRef.current = [];
      }

      const fetchRoute = async () => {
        let originLat, originLong, destinationLat, destinationLong;
        const riderLeg = isLiveLeg && hasRiderCoords;

        if (statusNum === 1 && hasRiderCoords) {
          originLat = riderMarkerLat;
          originLong = riderMarkerLong;
          destinationLat = firstMarkerLat;
          destinationLong = firstMarkerLong;
        } else if (statusNum === 2 && hasRiderCoords) {
          originLat = riderMarkerLat;
          originLong = riderMarkerLong;
          destinationLat = secondMarkerLat;
          destinationLong = secondMarkerLong;
        } else if (firstMarkerLat && secondMarkerLat) {
          originLat = firstMarkerLat;
          originLong = firstMarkerLong;
          destinationLat = secondMarkerLat;
          destinationLong = secondMarkerLong;
        } else {
          return;
        }

        if (!originLat || !originLong || !destinationLat || !destinationLong) {
          return;
        }

        // The rider's own legs: traffic as it is now, as the Rider app asks,
        // so both maps draw the same road (and the rider is not "off" a line
        // drawn through a jam). Roads the rider left on this leg: Google's
        // other ways too, the same request at the same price, and the fastest
        // that keeps off them is drawn.
        const avoid = riderLeg ? closedStretchesRef.current : [];
        const extra = riderLeg
          ? `&departure_time=now${avoid.length ? '&alternatives=true' : ''}`
          : '';
        inFlightLegKeyRef.current = legKey;
        try {
          const response = await fetchWithTimeout(
            `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLong}&destination=${destinationLat},${destinationLong}&mode=driving${extra}&key=${Constants.GOOGLE_MAP_API_KEY}`,
          );
          const data = await response.json();
          const choices = ((data && data.routes) || []).map(route =>
            routeFromDirections({ ...data, routes: [route] }),
          );
          const parsed = choices.length
            ? choices[
                routeAvoiding(
                  choices.map(choice => choice.coords),
                  avoid,
                )
              ]
            : routeFromDirections(data);
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
          if (currentLegKeyRef.current !== legKey) {
            return; // the leg changed while this request was in flight
          }
          setRouteCoords(parsed.coords);

          // Put the pins on the road-snapped ends of the line.
          const leg = parsed.leg;
          if (leg) {
            const end = {
              latitude: leg.end_location.lat,
              longitude: leg.end_location.lng,
            };
            if (riderLeg && statusNum === 1) {
              setSnappedPickup(end);
            } else if (riderLeg && statusNum === 2) {
              setSnappedDropoff(end);
            } else {
              setSnappedPickup({
                latitude: leg.start_location.lat,
                longitude: leg.start_location.lng,
              });
              setSnappedDropoff(end);
            }
          }
          lastFetchedLegKeyRef.current = legKey;
        } catch (e) {
          lastFetchedLegKeyRef.current = null;
          console.error('Error fetching route:', e);
        } finally {
          if (inFlightLegKeyRef.current === legKey) {
            inFlightLegKeyRef.current = null;
          }
        }
      };

      if (!isOnline) {
        return;
      }
      fetchRoute();
      // riderMarkerLat/Long are read at fetch time on purpose (see legKey).
      // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // Reroute when the rider has left the drawn road.
    useEffect(() => {
      if (
        !isLiveLeg ||
        routeCoords.length < 2 ||
        tracked.onRoute ||
        tracked.offRouteMeters < REROUTE_OFF_ROUTE_METERS
      ) {
        return;
      }
      const now = Date.now();
      if (now - lastRerouteAtRef.current < REROUTE_MIN_INTERVAL_MS) {
        return;
      }
      lastRerouteAtRef.current = now;
      closedStretchesRef.current = remember(
        closedStretchesRef.current,
        lastAheadRef.current,
      );
      lastAheadRef.current = null;
      lastFetchedLegKeyRef.current = null;
      setRerouteTick(t => t + 1);
    }, [isLiveLeg, routeCoords, tracked.onRoute, tracked.offRouteMeters]);

    useEffect(() => () => clearTimeout(retryTimerRef.current), []);

    // The line starts at the rider while one is tracked on the road; the
    // whole route otherwise (preview, or rider off the road until rerouted).
    const lineCoords =
      isLiveLeg && tracked.onRoute && tracked.remaining
        ? tracked.remaining
        : routeCoords;

    // Road-snapped pin positions once the route has loaded; the raw address
    // coordinate until then.
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
      <View
        style={[styles.container, style]}
        onLayout={e => {
          mapHeightRef.current = e.nativeEvent.layout.height;
          mapWidthRef.current = e.nativeEvent.layout.width;
        }}>
        <MapView
          ref={mapRef}
          style={styles.container}
          provider="google"
          onMapReady={() => setMapReady(true)}
          // In the follow view the header buttons cover the top of the map
          // and the trip sheet the bottom: pad it so the camera centers on the
          // part that is visible.
          mapPadding={
            riderShown && followDriver
              ? {
                  top: FOLLOW_TOP_PADDING,
                  right: 0,
                  bottom: bottomInset,
                  left: 0,
                }
              : undefined
          }
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
          // where the person is: the blue dot, once location is allowed
          showsUserLocation={Boolean(locationReady) && showsUser}
          showsMyLocationButton={false}
          onUserLocationChange={e => {
            const coordinate = e?.nativeEvent?.coordinate;
            if (coordinate?.latitude != null) {
              userCoordRef.current = coordinate;
            }
          }}
          showsPointsOfInterest={true}
          // Flat, clean map (no 3D building blocks) so the route stands out.
          showsBuildings={false}
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
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={pickupTracksViewChanges}>
              {riderComing ? (
                // where the rider is coming to: a blue dot in a white ring,
                // as the owner's design draws it ("8 · Rider found")
                <View style={styles.pickupDot} />
              ) : (
                <Image
                  source={require('@/Assets/Common/Pick_Up_Icon.png')}
                  style={styles.pinIcon}
                  resizeMode="contain"
                  onLoad={() => lockAfterPaint(setPickupTracksViewChanges)}
                />
              )}
            </Marker>
          )}

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

          {radarCenter ? (
            <RadarPing center={radarCenter} radiusM={radarRadius} />
          ) : null}

          {(nearbyRiders || []).map((r, i) =>
            r?.lat != null && r?.long != null ? (
              <NearbyDot
                key={`nearby-${i}`}
                coordinate={{
                  latitude: Number(r.lat),
                  longitude: Number(r.long),
                }}
              />
            ) : null,
          )}

          {/* Rider: a direction arrow lying flat on the map, turned to the
              rider's heading. Plain <Marker> with a state-driven coordinate
              (MarkerAnimated silently fails to render on Android). */}
          {riderShown && (
            <Marker
              coordinate={riderCoord}
              title="Rider"
              description={
                statusNum === 2
                  ? 'On the way to drop-off'
                  : 'On the way to pick you up'
              }
              anchor={{ x: 0.5, y: 0.5 }}
              flat={!riderComing}
              rotation={riderComing ? 0 : tracked.heading}
              tracksViewChanges={riderTracksViewChanges}>
              {riderComing ? (
                <View style={styles.riderComing}>
                  <Icon name="motorbike" size={20} color="#FFFFFF" />
                </View>
              ) : (
                <NavArrow />
              )}
            </Marker>
          )}

          {lineCoords.length > 1 &&
            (riderComing ? (
              // dots on a white line, so they read over any street (the
              // design); round caps turn the dashes into dots (react-native-maps)
              <>
                <Polyline
                  coordinates={lineCoords}
                  strokeColor="#FFFFFF"
                  strokeWidth={12}
                  lineCap="round"
                  zIndex={1}
                />
                <Polyline
                  coordinates={lineCoords}
                  strokeColor={RIDER_INK}
                  strokeWidth={6}
                  lineCap="round"
                  lineDashPattern={[1, 14]}
                  zIndex={2}
                />
              </>
            ) : (
              <Polyline
                coordinates={lineCoords}
                strokeColor={colors.primary}
                strokeWidth={5}
              />
            ))}
        </MapView>
        {riderShown && (
          <TouchableOpacity
            style={styles.followButton}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={
              followDriver ? 'Show the whole trip' : 'Follow rider'
            }
            onPress={() => {
              lastTouchAtRef.current = 0;
              setFollowChoice(!followDriver);
            }}>
            <Icon
              name={followDriver ? 'map-outline' : 'crosshairs-gps'}
              size={18}
              color={look.ink}
            />
            <Text style={styles.followText}>
              {followDriver ? 'Overview' : 'Follow rider'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  },
);

export default AppMap;

// The rider's marker and dotted line while they come: black on the map,
// which stays light in the dark look too
const RIDER_INK = '#17171C';
// the pick-up's dot meanwhile: the design's blue (the rider's initials circle)
const PICKUP_BLUE = '#3A5AF6';

const getStyles = ({ colors, look }) =>
  StyleSheet.create({
    riderComing: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: RIDER_INK,
      borderWidth: 3,
      borderColor: '#FFFFFF',
    },
    pickupDot: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: PICKUP_BLUE,
      borderWidth: 4,
      borderColor: '#FFFFFF',
    },
    container: { flex: 1 },
    pinIcon: {
      width: 40,
      height: 40,
    },
    // level with the trip's close button on Home (top 61), as the design draws it
    followButton: {
      position: 'absolute',
      right: 28,
      top: 61,
      height: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      borderRadius: 24,
      backgroundColor: look.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 6,
    },
    followText: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 14,
      lineHeight: 20,
      color: look.ink,
    },
  });
