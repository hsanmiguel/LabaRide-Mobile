import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, View } from 'react-native';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';
import { Button, Txt, styles, usePalette } from './ui';
import JobRouteMap from './JobRouteMap';
import { message } from './data';
import { navigationPoint, parseNavigationRoute, riderDirectionsUrl, type NavigationStop } from './rider-navigation';
import type { RoutePoint } from './job-route';

const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
type Fix = RoutePoint & { accuracy: number | null; timestamp: number };

export function RiderNavigationPanel({ stop, destinationKind, onBack }: {
  stop: NavigationStop; destinationKind: 'customer' | 'shop'; onBack: () => void;
}) {
  const palette = usePalette();
  const destination = useMemo(() => navigationPoint(stop), [stop.latitude, stop.longitude]);
  const [fix, setFix] = useState<Fix | null>(null);
  const [origin, setOrigin] = useState<RoutePoint | null>(null);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [now, setNow] = useState(Date.now());
  const lastRouting = useRef(0);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => setForeground(state === 'active'));
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => { listener.remove(); clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (!destination || !token || !foreground) { setLocating(false); return; }
    let live = true;
    let watcher: Location.LocationSubscription | undefined;
    setLocating(true); setError(''); setFix(null); setOrigin(null); lastRouting.current = 0;
    let received = false;
    function receive(reading: Location.LocationObject) {
      if (!live) return;
      const point = navigationPoint(reading.coords);
      if (!point || Date.now() - reading.timestamp > 45000) return;
      received = true;
      setFix({ ...point, accuracy: reading.coords.accuracy, timestamp: reading.timestamp });
      setNow(Date.now()); setLocating(false); setError('');
      // Keep the marker live; request directions at most once every 30 seconds.
      if (Date.now() - lastRouting.current >= 30000) { lastRouting.current = Date.now(); setOrigin(point); }
    }
    const timeout = setTimeout(() => { if (live && !received) { setLocating(false); setError('GPS is taking longer than expected. Check location permission or retry.'); } }, 20000);
    void (async () => {
      try {
        if (Platform.OS === 'web' && !window.isSecureContext) throw new Error('GPS needs HTTPS or localhost in a browser.');
        if ((await Location.requestForegroundPermissionsAsync()).status !== 'granted') throw new Error('Allow location access to create a route from your position.');
        if (!live) return;
        watcher = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 5000 }, receive);
        if (!live) { watcher.remove(); return; }
        void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).then(receive).catch(() => {
          // The watcher can still provide a fix when the initial request fails.
        });
      } catch (failure) { if (live) { setError(message(failure)); setLocating(false); } }
    })();
    return () => { live = false; clearTimeout(timeout); watcher?.remove(); };
  }, [destination?.latitude, destination?.longitude, foreground, attempt]);
  const fresh = !!fix && foreground && now - fix.timestamp <= 45000;
  const route = useQuery({ queryKey: ['rider-mapbox-route', origin, destination], enabled: !!origin && !!destination && !!token && fresh,
    queryFn: async ({ signal }) => {
      const controller = new AbortController();
      const cancel = () => controller.abort(); signal.addEventListener('abort', cancel);
      const timer = setTimeout(cancel, 15000);
      try {
        const response = await fetch(riderDirectionsUrl(origin!, destination!, token), { signal: controller.signal });
        if (!response.ok) throw new Error('Mapbox could not load the route. Check your connection and retry.');
        return parseNavigationRoute(await response.json());
      } finally { clearTimeout(timer); signal.removeEventListener('abort', cancel); }
    }, retry: false, staleTime: 30000, gcTime: 0,
  });
  const mapData = useMemo(() => ({ stage: 'Pickup' as const, navigation: true, destinationKind, origin: fresh ? fix : null,
    destination, coordinates: fresh && !route.isError ? route.data?.coordinates || [] : [],
  }), [destinationKind, fix, fresh, destination, route.data, route.isError]);
  return <View testID="rider-navigation-panel" style={{ gap: 16 }}>
    <Button title="Back to order details" outline compact onPress={onBack} />
    <View style={{ gap: 5 }}><Txt accessibilityRole="header" style={styles.heading}>Mapbox navigation</Txt><Txt style={{ fontWeight: '600' }}>To {stop.name || (destinationKind === 'shop' ? 'laundry shop' : 'customer')}</Txt><Txt style={styles.muted}>{stop.address || 'Saved map pin'}</Txt></View>
    {!token && <Txt accessibilityRole="alert" style={{ color: palette.warning }}>Mapbox is not configured. Add the public map token and restart the app.</Txt>}
    {!destination && <Txt accessibilityRole="alert" style={{ color: palette.warning }}>This stop has no valid saved map pin. Ask the customer or shop to update it before navigating.</Txt>}
    {!!token && !!destination && <View style={{ height: 360, borderRadius: 14, overflow: 'hidden', backgroundColor: palette.soft }}><JobRouteMap data={mapData} /></View>}
    {locating && <View style={styles.row}><ActivityIndicator color={palette.primary} /><Txt style={styles.muted}>Getting your GPS position...</Txt></View>}
    {!!error && <Txt accessibilityRole="alert" style={{ color: palette.warning }}>{error}</Txt>}
    {!foreground && <Txt style={{ color: palette.warning }}>Navigation is paused. Return to the app to update your GPS position.</Txt>}
    {!!fix && !fresh && foreground && <Txt style={{ color: palette.warning }}>GPS position is out of date. Refresh your position before following a route.</Txt>}
    {fresh && <Txt style={styles.muted}>Your GPS position{fix?.accuracy != null ? ` (accuracy about ${Math.round(fix.accuracy)} m)` : ''}. Blue route leads to the selected stop.</Txt>}
    {route.isFetching && fresh && <View style={styles.row}><ActivityIndicator color={palette.primary} /><Txt style={styles.muted}>Finding the road route...</Txt></View>}
    {route.error && fresh && <Txt accessibilityRole="alert" style={{ color: palette.warning }}>{message(route.error)} No road route is shown.</Txt>}
    {route.data && !route.isError && fresh && <View style={{ gap: 12 }}>
      <Txt testID="rider-navigation-summary" style={{ color: palette.primary, fontSize: 20, fontWeight: '700' }}>{(route.data.distanceMeters / 1000).toFixed(1)} km · about {Math.max(1, Math.ceil(route.data.durationSeconds / 60))} min driving</Txt>
      <Txt style={styles.heading}>Driving directions</Txt>
      {route.data.steps.map((step, index) => <View key={index} style={{ flexDirection: 'row', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: palette.line }}><Txt style={{ color: palette.primary, fontWeight: '700' }}>{index + 1}.</Txt><View style={{ flex: 1, gap: 4 }}><Txt>{step.instruction}</Txt><Txt style={styles.muted}>{step.distanceMeters >= 1000 ? `${(step.distanceMeters / 1000).toFixed(1)} km` : `${Math.round(step.distanceMeters)} m`}</Txt></View></View>)}
    </View>}
    {!!token && !!destination && <Button title="Refresh GPS & route" outline busy={locating} onPress={() => setAttempt(value => value + 1)} />}
    <Txt style={styles.muted}>GPS is used here to calculate your route. To share your position with the customer and shop, turn on Live location sharing in My deliveries.</Txt>
  </View>;
}
