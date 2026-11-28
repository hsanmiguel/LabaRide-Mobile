import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import { CarFront, Clock3, MapPin, Navigation } from 'lucide-react-native';
import { message } from './data';
import { API_URL } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { Button, Card, Section, Txt, styles, usePalette } from './ui';
import RiderTrackingMap from './RiderTrackingMap';
import type { TrackingPoint } from './riderTrackingMapHtml';

type Tracking = { state: 'waiting' | 'finished' | 'paused' | 'sharing' | 'stale'; rider: { name: string; stage: string } | null; location: (TrackingPoint & { accuracy: number | null; capturedAt: string; receivedAt: string }) | null; customer: TrackingPoint | null; shop: TrackingPoint | null; destination: 'customer' | 'shop'; staleAfterMs: number; serverTime: string };
const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
const routePoints = [{ x: 26, y: 518 }, { x: 88, y: 470 }, { x: 124, y: 405 }, { x: 191, y: 374 }, { x: 224, y: 300 }, { x: 298, y: 260 }, { x: 330, y: 190 }, { x: 374, y: 156 }, { x: 350, y: 78 }];
const routePolyline = routePoints.map(point => `${point.x},${point.y}`).join(' ');
const routeLength = routePoints.slice(1).reduce((total, point, index) => total + Math.hypot(point.x - routePoints[index].x, point.y - routePoints[index].y), 0);
const routeFractions = [0];
routePoints.slice(1).forEach((point, index) => routeFractions.push(routeFractions[index] + Math.hypot(point.x - routePoints[index].x, point.y - routePoints[index].y) / routeLength));
function routeProgress(current: TrackingPoint | null, start: TrackingPoint | null, end: TrackingPoint | null) {
  if (!current || !start || !end) return 0;
  const latitudeScale = Math.cos(start.latitude * Math.PI / 180);
  const sx = start.longitude * latitudeScale, sy = start.latitude;
  const ex = end.longitude * latitudeScale, ey = end.latitude;
  const px = current.longitude * latitudeScale, py = current.latitude;
  const dx = ex - sx, dy = ey - sy;
  const denominator = dx * dx + dy * dy;
  return denominator ? Math.max(0, Math.min(1, ((px - sx) * dx + (py - sy) * dy) / denominator)) : 0;
}
function distanceKm(a: TrackingPoint | null, b: TrackingPoint | null) {
  if (!a || !b) return null;
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad, dLon = (b.longitude - a.longitude) * rad;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function CustomerRiderTracking({ orderId, orderStatus, viewer = 'customer' }: { orderId: number; orderStatus: string; viewer?: 'customer' | 'shop' | 'rider' }) {
  const user = useAuthStore(state => state.user);
  const token = useAuthStore(state => state.token);
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const query = useQuery<Tracking>({ queryKey: ['delivery', 'tracking', orderId, user?.id], enabled: !!token,
    queryFn: async ({ signal }) => {
      // A job can finish or be reassigned while this map is mounted. A denied
      // tracking resource must not log the rider out of their whole account.
      const response = await fetch(API_URL + '/api/delivery/orders/' + orderId + '/tracking', {
        headers: { Authorization: 'Bearer ' + token }, signal, cache: 'no-store',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(response.status === 403 ? 'Live location is no longer available for this assignment.' : result.error?.message || 'Could not refresh the rider location.');
      return result.data;
    }, refetchInterval: 5000, retry: false });
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const tracking = query.data;
  const age = tracking?.location ? Math.max(0, Date.parse(tracking.serverTime) - Date.parse(tracking.location.capturedAt) + Math.max(0, now - query.dataUpdatedAt)) : 0;
  const stale = !!query.error || tracking?.state === 'stale' || !!tracking?.location && age > tracking.staleAfterMs;
  const mapData = useMemo(() => ({ rider: tracking?.location || null, customer: tracking?.customer || null, shop: tracking?.shop || null, stale }), [tracking, stale]);
  const processing = ['AtPartner', 'LaundryReceived', 'Washing', 'Drying', 'Folding'].includes(orderStatus);
  const title = stale && tracking?.location ? 'Last known rider location' : tracking?.state === 'sharing' ? 'Rider location updating' : tracking?.state === 'finished' ? 'Trip finished' : tracking?.state === 'paused' ? 'Waiting for a location update' : processing ? 'Laundry is at the shop' : 'Waiting for your rider';
  if (viewer === 'customer' && tracking) return <CustomerRideTrackingPanel tracking={tracking} stale={stale} now={now} />;
  return <Card><Section title={viewer === 'rider' ? 'Your trip map' : viewer === 'shop' ? 'Assigned rider location' : 'Track your rider'} />
    {viewer === 'rider' && <Txt style={styles.muted}>Start sharing location above to show your GPS marker. Only this order's customer, laundry shop and admins can view the position you share.</Txt>}
    {query.isLoading && <ActivityIndicator accessibilityLabel="Loading rider tracking" />}
    {!!query.error && <View style={{ gap: 10 }}><Txt accessibilityRole="alert" style={{ color: palette.danger }}>Could not refresh rider location. {message(query.error)}</Txt><Button title="Retry rider location" compact outline onPress={() => { void query.refetch(); }} /></View>}
    {tracking && <>
      <Txt accessibilityLiveRegion="polite" style={{ fontWeight: '700', color: stale ? palette.warning : palette.primary }}>{title}</Txt>
      {!!tracking.rider && <Txt>{tracking.rider.name} · {tracking.rider.stage}</Txt>}
      {tracking.location ? <View style={{ gap: 5 }}>
        <Txt style={styles.muted}>Last GPS update {Math.floor(age / 1000) < 60 ? `${Math.floor(age / 1000)} seconds ago` : `${Math.floor(age / 60000)} minutes ago`} · {new Date(tracking.location.capturedAt).toLocaleTimeString([], { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', second: '2-digit' })}</Txt>
        {tracking.location.accuracy != null && <Txt style={styles.muted}>GPS accuracy: approximately {Math.round(tracking.location.accuracy)} metres</Txt>}
        {stale && <Txt style={{ color: palette.warning }}>This is a saved position, not the rider’s confirmed current location. Updates may pause if the rider switches apps or loses GPS or internet.</Txt>}
        <Txt style={{ fontSize: 12, color: palette.muted }}>Rider coordinates: {tracking.location.latitude.toFixed(5)}, {tracking.location.longitude.toFixed(5)}</Txt>
      </View> : <Txt style={styles.muted}>{tracking.state === 'finished' ? 'Location sharing has ended for this order.' : tracking.state === 'paused' ? viewer === 'rider' ? 'Enable Start sharing location above and keep LabaRide open to share your current position.' : 'The rider needs to enable location sharing and keep LabaRide open. No live position is available yet.' : processing ? 'Tracking resumes when a rider claims the return delivery and shares their location.' : 'A rider’s position appears after they accept or claim your job and enable location sharing.'}</Txt>}
      {(mapData.rider || mapData.customer || mapData.shop) && <><View testID="customer-rider-map" style={{ height: width < 480 ? 300 : 360, borderRadius: 12, overflow: 'hidden', backgroundColor: palette.surface }}><RiderTrackingMap data={mapData} /></View><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>{[['Rider', stale ? '#A05A00' : '#2457AD'], ['Customer address', '#12805C'], ['Laundry shop', '#6236A5']].map(([label, color]) => <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color }} /><Txt style={{ fontSize: 11, color: palette.muted }}>{label}</Txt></View>)}</View></>}
      <Txt style={{ fontSize: 12, lineHeight: 19, color: palette.muted }}>Locations refresh about every 5 seconds. Pins show reported positions, not a road route or arrival-time estimate.</Txt>
      <Button title="Refresh rider location" compact outline busy={query.isFetching} onPress={() => { void query.refetch(); }} />
    </>}
  </Card>;
}

function CustomerRideTrackingPanel({ tracking, stale, now }: { tracking: Tracking; stale: boolean; now: number }) {
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const start = tracking.destination === 'shop' ? tracking.customer : tracking.shop;
  const end = tracking.destination === 'shop' ? tracking.shop : tracking.customer;
  const progress = routeProgress(tracking.location, start, end);
  const progressAnim = useRef(new Animated.Value(progress)).current;
  const [etaDeadline, setEtaDeadline] = useState<number | null>(null);
  const routeDistance = distanceKm(tracking.location, end);
  useEffect(() => {
    Animated.timing(progressAnim, { toValue: progress, duration: 1100, useNativeDriver: false }).start();
  }, [progress, progressAnim]);
  useEffect(() => {
    if (!tracking.location || routeDistance == null) { setEtaDeadline(null); return; }
    setEtaDeadline(Date.now() + Math.max(60, routeDistance * 1.3 / 22 * 3600) * 1000);
  }, [tracking.location?.latitude, tracking.location?.longitude, tracking.location?.capturedAt, routeDistance]);
  const seconds = etaDeadline == null || stale ? null : Math.max(0, Math.ceil((etaDeadline - now) / 1000));
  const eta = seconds == null ? '—' : seconds < 60 ? 'Arriving soon' : `${Math.ceil(seconds / 60)} min`;
  const stage = tracking.rider?.stage === 'Pickup' ? 'Picking up your laundry' : 'Delivering your laundry';
  return <View style={{ height: width < 600 ? 540 : 620, borderRadius: 24, overflow: 'hidden', backgroundColor: '#EAF0F3', position: 'relative' }}>
    <Svg viewBox="0 0 400 600" preserveAspectRatio="none" style={{ position: 'absolute', width: '100%', height: '100%' }}>
      <Rect width="400" height="600" fill="#EEF3F2" />
      <Path d="M0 40H130V160H0z M260 0H400V110H260z M0 300H82V390H0z M275 340H400V500H275z M95 520H235V600H95z" fill="#DCEBD9" />
      <Path d="M155 0V600 M0 220H400 M335 0V600 M0 455H400 M45 0V600 M0 115H400" stroke="#D5DEE2" strokeWidth="36" fill="none" />
      <Path d="M155 0V600 M0 220H400 M335 0V600 M0 455H400 M45 0V600 M0 115H400" stroke="#FFFFFF" strokeWidth="29" fill="none" />
      <Path d="M0 70H400 M95 0V600 M250 0V600 M0 350H400 M0 545H400" stroke="#FFFFFF" strokeWidth="17" fill="none" />
      <Polyline points={routePolyline} fill="none" stroke="#FFFFFF" strokeWidth="16" strokeLinejoin="round" strokeLinecap="round" />
      <Polyline points={routePolyline} fill="none" stroke="#A9BAC8" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" />
      <AnimatedPolyline points={routePolyline} fill="none" stroke={palette.primary} strokeWidth="8" strokeLinejoin="round" strokeLinecap="round"
        strokeDasharray={routeLength} strokeDashoffset={progressAnim.interpolate({ inputRange: [0, 1], outputRange: [routeLength, 0] })} />
      <Circle cx={routePoints[0].x} cy={routePoints[0].y} r="10" fill="#12805C" stroke="white" strokeWidth="4" />
      <Circle cx={routePoints[routePoints.length - 1].x} cy={routePoints[routePoints.length - 1].y} r="11" fill="#E58B26" stroke="white" strokeWidth="4" />
      <SvgText x="22" y="557" fontSize="12" fill="#475569">Pickup</SvgText>
      <SvgText x="300" y="55" fontSize="12" fill="#475569">Destination</SvgText>
      <SvgText x="76" y="194" fontSize="11" fill="#64748B">Naga City</SvgText>
      <SvgText x="190" y="493" fontSize="11" fill="#64748B">Magsaysay Ave.</SvgText>
    </Svg>
    {!!tracking.location && <Animated.View pointerEvents="none" style={{ position: 'absolute', zIndex: 2,
      left: progressAnim.interpolate({ inputRange: routeFractions, outputRange: routePoints.map(point => `${point.x / 4}%`) }),
      top: progressAnim.interpolate({ inputRange: routeFractions, outputRange: routePoints.map(point => `${point.y / 6}%`) }),
      width: 42, height: 42, marginLeft: -21, marginTop: -21, borderRadius: 21, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: palette.primary, elevation: 5 }}><CarFront size={21} color={palette.primary} /></Animated.View>}
    <View style={{ position: 'absolute', top: 18, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'white', borderRadius: 22, paddingHorizontal: 13, paddingVertical: 9, elevation: 2 }}>
        <Navigation size={16} color={stale ? palette.warning : palette.primary} />
        <Txt style={{ fontSize: 12, fontWeight: '600' }}>{stale ? 'Updating location' : tracking.state === 'sharing' ? 'Rider on the way' : 'Waiting for rider'}</Txt>
      </View>
      <View style={{ backgroundColor: 'white', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 8, elevation: 2 }}>
        <Txt style={{ color: palette.muted, fontSize: 11 }}>{tracking.destination === 'shop' ? 'To laundry shop' : 'To your address'}</Txt>
      </View>
    </View>
    <View style={{ position: 'absolute', left: 14, right: 14, bottom: 14, borderRadius: 20, padding: 18, backgroundColor: 'white',
      borderWidth: 1, borderColor: palette.line, shadowColor: '#14233B', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: palette.soft, alignItems: 'center', justifyContent: 'center' }}><CarFront size={25} color={palette.primary} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt numberOfLines={1} style={{ fontSize: 16, fontWeight: '700' }}>{tracking.rider?.name || 'Your rider'}</Txt>
          <Txt style={{ color: palette.muted, fontSize: 12 }}>{tracking.location ? stage : 'Waiting for live location'}</Txt>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Clock3 size={15} color={palette.primary} /><Txt style={{ color: palette.primary, fontSize: 18, fontWeight: '700' }}>{eta}</Txt></View>
          <Txt style={{ color: palette.muted, fontSize: 10 }}>{seconds == null ? 'ETA unavailable' : 'estimated arrival'}</Txt>
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: palette.line }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <MapPin size={14} color={palette.muted} />
        <Txt style={{ color: palette.muted, fontSize: 11, flex: 1 }}>{stale ? 'GPS may be delayed. ETA will update when the rider shares a fresh position.' : 'Approximate route and ETA update with the rider’s GPS.'}</Txt>
      </View>
    </View>
  </View>;
}
