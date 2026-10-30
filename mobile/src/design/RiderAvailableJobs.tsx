import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Switch, View, useWindowDimensions } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { Bike, MapPin, Package } from 'lucide-react-native';
import { api, confirmAction, message } from './data';
import { useAuthStore } from '../store/authStore';
import { useLogout } from './useLogout';
import { RiderLocationSharingControl } from './RiderLocationSharing';
import { Button, Card, Empty, Screen, TabsRow, Txt, styles, usePalette } from './ui';

type AvailableJob = { id: number; stage: 'Pickup' | 'Delivery'; workflowVersion: number; serviceName: string; kilos: string; scheduledDate: string | null; scheduledTime: string | null; requestedPickupAt?: string | null; createdAt: string; shopName: string; pickupArea: string; dropoffArea: string; distanceKm: number | null };
type JobBoard = { rider: { online: boolean; workload: number; capacity: number; hasPosition: boolean }; limit: number; jobs: AvailableJob[] };
function schedule(job: AvailableJob) {
  if (job.requestedPickupAt) return new Date(job.requestedPickupAt).toLocaleString([], { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  if (!job.scheduledDate || !job.scheduledTime) return 'Not scheduled';
  const date = new Date(job.scheduledDate.slice(0, 10) + 'T' + job.scheduledTime.slice(11, 19) + 'Z');
  return Number.isFinite(date.getTime()) ? date.toLocaleString([], { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not scheduled';
}

export function RiderAvailableJobsDesign() {
  const user = useAuthStore(state => state.user);
  const query = useQuery({ queryKey: ['delivery', 'available-jobs', user?.id], queryFn: () => api.get<JobBoard>('/delivery/available-jobs'), refetchInterval: 15000 });
  const cache = useQueryClient();
  const logout = useLogout();
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState('Oldest first');
  const [busy, setBusy] = useState(false);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const board = query.data;
  const canClaim = !!board?.rider.online && board.rider.workload < board.rider.capacity && !query.isError;
  const jobs = (board?.jobs || []).filter(job => filter === 'All' || job.stage === filter).sort((a, b) => sort === 'Nearest first' ? (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || Date.parse(a.createdAt) - Date.parse(b.createdAt) : Date.parse(a.createdAt) - Date.parse(b.createdAt));
  async function refreshAll() {
    await Promise.all(['delivery', 'notifications', 'user-orders', 'shop-orders'].map(key => cache.invalidateQueries({ queryKey: [key] })));
  }
  async function availability(online: boolean, position?: { latitude: number; longitude: number }) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await api.put('/delivery/availability', { online, ...position }); await refreshAll(); }
    catch (failure) { setError(message(failure)); }
    finally { pending.current = false; setBusy(false); }
  }
  async function locate() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      if ((await Location.requestForegroundPermissionsAsync()).status !== 'granted') throw new Error('Allow location access to show approximate pickup distances. You can still claim jobs without a saved position.');
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await api.put('/delivery/availability', { online: board?.rider.online || false, latitude: coords.latitude, longitude: coords.longitude });
      await refreshAll();
    } catch (failure) { setError(message(failure)); }
    finally { pending.current = false; setBusy(false); }
  }
  async function claim(job: AvailableJob) {
    if (pending.current || !canClaim) return;
    pending.current = true; setClaimingId(job.id); setError('');
    try {
      const confirmed = await confirmAction(`Claim ${job.stage.toLowerCase()} job #${job.id}?`, `Collect from ${job.pickupArea} and take the laundry to ${job.dropoffArea}. Claiming accepts this job immediately and adds it to My jobs.`, { confirmLabel: 'Claim job' });
      if (!confirmed) return;
      setBusy(true);
      await api.put(`/delivery/orders/${job.id}/claim`, { stage: job.stage, expectedVersion: job.workflowVersion });
      await refreshAll();
      router.push('/rider/jobs');
    } catch (failure) { setError(message(failure)); await query.refetch(); }
    finally { pending.current = false; setBusy(false); setClaimingId(null); }
  }
  return <Screen title="Available jobs" brandedHeader back={false} right={<Button title="Sign Out" compact outline onPress={logout} />}>
    <View style={{ gap: 20 }}>
      <View style={styles.between}><View style={{ flex: 1, minWidth: 180, gap: 6 }}><Txt style={styles.title}>Choose your next job</Txt><Txt style={styles.muted}>Claim a pickup or delivery. The first eligible rider to claim gets the job.</Txt></View><Button title="My jobs" compact outline onPress={() => router.push('/rider/jobs')} /></View>
      {query.isLoading && <ActivityIndicator accessibilityLabel="Loading available jobs" />}
      <RiderLocationSharingControl />
      {!!query.error && <Empty title="Unable to load available jobs" message={message(query.error)} action="Retry" onPress={() => { void query.refetch(); }} />}
      {board && <>
        <Card><View style={styles.between}><View style={{ flex: 1, minWidth: 160, gap: 6 }}><Txt style={{ fontSize: 18, fontWeight: '600' }}>{board.rider.online ? 'You are online' : 'Go online to find jobs'}</Txt><Txt style={styles.muted}>{board.rider.workload} of {board.rider.capacity} active job slots used</Txt></View><Switch accessibilityLabel="Rider availability" value={board.rider.online} disabled={busy || claimingId !== null} onValueChange={online => { void availability(online); }} trackColor={{ true: palette.primary }} /></View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}><Button title="Update dispatch position" compact outline style={Platform.OS === 'web' ? { alignSelf: 'flex-start' } : undefined} disabled={busy || claimingId !== null} onPress={() => { void locate(); }} /><Button title="Refresh jobs" compact outline busy={query.isFetching} disabled={busy} onPress={() => { void query.refetch(); }} /></View>
          {board.rider.online && board.rider.workload >= board.rider.capacity && <Txt style={{ color: palette.warning }}>Your job slots are full. Finish a job before claiming another. You can continue your existing jobs in My jobs.</Txt>}
        </Card>
        <View style={{ gap: 10 }}><TabsRow items={['All', 'Pickup', 'Delivery']} value={filter} onChange={setFilter} /><TabsRow items={['Oldest first', 'Nearest first']} value={sort} onChange={setSort} /></View>
        <Txt style={{ fontSize: 12, lineHeight: 20, color: palette.muted }}>Areas are approximate. Customer name, exact address and contact details unlock after claiming. Distance is a straight-line estimate from your saved position to the collection point, not a road route or live location.{!board.rider.hasPosition ? ' Save your position to see distances.' : ''}</Txt>
        {board.jobs.length >= board.limit && <Txt style={styles.muted}>Showing the oldest {board.limit} available jobs. Refresh as jobs are claimed.</Txt>}
      </>}
      {!!error && <Txt accessibilityRole="alert" style={{ color: palette.danger }}>{error}</Txt>}
      {board?.rider.online && !query.isError && <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 16 }}>{jobs.map(job => <Card key={job.id} testID={`available-job-${job.id}`} style={{ width: width >= 1100 ? '48.8%' : '100%', gap: 16 }}>
        <View style={styles.between}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{job.stage === 'Pickup' ? <Bike size={22} color={palette.primary} /> : <Package size={22} color={palette.primary} />}<Txt style={styles.heading}>{job.stage} · Order #{job.id}</Txt></View><Txt style={{ color: palette.primary, fontWeight: '600', fontSize: 12 }}>{job.distanceKm == null ? 'Distance unavailable' : job.distanceKm < 0.1 ? 'Less than 0.1 km away' : `${job.distanceKm.toFixed(1)} km away`}</Txt></View>
        <View style={{ gap: 5 }}><Txt style={{ fontWeight: '600' }}>{job.shopName}</Txt><Txt style={styles.muted}>{job.serviceName} · {job.kilos} kg</Txt><Txt style={{ fontSize: 12, color: palette.muted }}>Service schedule: {schedule(job)}</Txt></View>
        {[['COLLECT FROM', job.pickupArea], ['TAKE TO', job.dropoffArea]].map(([title, area]) => <View key={title} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}><MapPin size={18} color={palette.primary} /><View style={{ flex: 1, minWidth: 0, gap: 4 }}><Txt style={{ fontSize: 11, color: palette.muted }}>{title}</Txt><Txt>{area}</Txt></View></View>)}
        <Txt style={{ fontSize: 12, color: palette.muted }}>Booked {new Date(job.createdAt).toLocaleString([], { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Txt>
        <Button title={`Claim ${job.stage.toLowerCase()} job`} busy={claimingId === job.id} disabled={!canClaim || claimingId !== null || busy} onPress={() => { void claim(job); }} />
      </Card>)}</View>}
      {board && !query.isError && (!board.rider.online ? <Empty title="You are offline" message="Go online above to browse and claim available jobs. Your current jobs remain in My jobs." /> : !jobs.length ? <Empty title="No available jobs right now" message="Confirmed pickups and clean laundry ready for delivery will appear here. The board refreshes automatically every 15 seconds." /> : null)}
    </View>
  </Screen>;
}
