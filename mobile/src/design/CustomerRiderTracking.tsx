import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api, message } from './data';
import { useAuthStore } from '../store/authStore';
import { Button, Card, Section, Txt, styles, usePalette } from './ui';
import RiderTrackingMap from './RiderTrackingMap';
import type { TrackingPoint } from './riderTrackingMapHtml';

type Tracking = { state: 'waiting' | 'finished' | 'paused' | 'sharing' | 'stale'; rider: { name: string; stage: string } | null; location: (TrackingPoint & { accuracy: number | null; capturedAt: string; receivedAt: string }) | null; customer: TrackingPoint | null; shop: TrackingPoint | null; destination: 'customer' | 'shop'; staleAfterMs: number; serverTime: string };

export function CustomerRiderTracking({ orderId, orderStatus }: { orderId: number; orderStatus: string }) {
  const user = useAuthStore(state => state.user);
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const query = useQuery({ queryKey: ['delivery', 'tracking', orderId, user?.id], queryFn: () => api.get<Tracking>(`/delivery/orders/${orderId}/tracking`), refetchInterval: 5000, retry: false });
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(timer); }, []);
  const tracking = query.data;
  const age = tracking?.location ? Math.max(0, Date.parse(tracking.serverTime) - Date.parse(tracking.location.capturedAt) + Math.max(0, now - query.dataUpdatedAt)) : 0;
  const stale = !!query.error || tracking?.state === 'stale' || !!tracking?.location && age > tracking.staleAfterMs;
  const mapData = useMemo(() => ({ rider: tracking?.location || null, customer: tracking?.customer || null, shop: tracking?.shop || null, stale }), [tracking, stale]);
  const processing = ['AtPartner', 'LaundryReceived', 'Washing', 'Drying', 'Folding'].includes(orderStatus);
  const title = stale && tracking?.location ? 'Last known rider location' : tracking?.state === 'sharing' ? 'Rider location updating' : tracking?.state === 'finished' ? 'Trip finished' : tracking?.state === 'paused' ? 'Waiting for a location update' : processing ? 'Your laundry is at the shop' : 'Waiting for your rider';
  return <Card><Section title="Track your rider" />
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
      </View> : <Txt style={styles.muted}>{tracking.state === 'finished' ? 'Location sharing has ended for this order.' : tracking.state === 'paused' ? 'The rider needs to enable location sharing and keep LabaRide open. No live position is available yet.' : processing ? 'Tracking resumes when a rider claims the return delivery and shares their location.' : 'A rider’s position appears after they accept or claim your job and enable location sharing.'}</Txt>}
      {(mapData.rider || mapData.customer || mapData.shop) && <><View testID="customer-rider-map" style={{ height: width < 480 ? 300 : 360, borderRadius: 12, overflow: 'hidden', backgroundColor: palette.surface }}><RiderTrackingMap data={mapData} /></View><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>{[['Rider', stale ? '#A05A00' : '#2457AD'], ['Customer address', '#12805C'], ['Laundry shop', '#6236A5']].map(([label, color]) => <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color }} /><Txt style={{ fontSize: 11, color: palette.muted }}>{label}</Txt></View>)}</View></>}
      <Txt style={{ fontSize: 12, lineHeight: 19, color: palette.muted }}>Locations refresh about every 5 seconds. Pins show reported positions, not a road route or arrival-time estimate.</Txt>
      <Button title="Refresh rider location" compact outline busy={query.isFetching} onPress={() => { void query.refetch(); }} />
    </>}
  </Card>;
}
