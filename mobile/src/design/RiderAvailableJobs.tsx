import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View, useWindowDimensions } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { Bike, ChevronRight, Clock3, MapPin, Menu, Package, RefreshCw, SlidersHorizontal } from 'lucide-react-native';
import { api, confirmAction, message } from './data';
import { useAuthStore } from '../store/authStore';
import { useLogout } from './useLogout';
import { RiderLocationSharingControl } from './RiderLocationSharing';
import { Button, Card, Choice, Empty, IconButton, Screen, TabsRow, Txt, styles, usePalette } from './ui';
import { RiderDashboardPanel } from './RiderDashboardPanel';
import { JobRoutePreview } from './JobRoutePreview';

type AvailableJob = { id: number; stage: 'Pickup' | 'Delivery'; workflowVersion: number; serviceName: string; kilos: string; scheduledDate: string | null; scheduledTime: string | null; requestedPickupAt?: string | null; createdAt: string; shopName: string; pickupArea: string; dropoffArea: string; distanceKm: number | null };
type JobBoard = { rider: { online: boolean; workload: number; capacity: number; hasPosition: boolean }; limit: number; jobs: AvailableJob[] };
function schedule(job: AvailableJob) {
  if (job.requestedPickupAt) return new Date(job.requestedPickupAt).toLocaleString([], { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  if (!job.scheduledDate || !job.scheduledTime) return null;
  const date = new Date(job.scheduledDate.slice(0, 10) + 'T' + job.scheduledTime.slice(11, 19) + 'Z');
  return Number.isFinite(date.getTime()) ? date.toLocaleString([], { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null;
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
  const [locationNotice, setLocationNotice] = useState('');
  const [panel, setPanel] = useState<'tools' | 'filters' | 'job' | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const pending = useRef(false);
  const board = query.data;
  const selectedJob = board?.jobs.find(job => job.id === selectedJobId);
  const distance = (job: AvailableJob) => job.distanceKm == null ? 'Distance unavailable' : job.distanceKm < 0.1 ? 'Less than 0.1 km away' : `${job.distanceKm.toFixed(1)} km away`;
  function viewJob(job: AvailableJob) { setSelectedJobId(job.id); setPanel('job'); }
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
    pending.current = true; setBusy(true); setError(''); setLocationNotice('');
    try {
      if ((await Location.requestForegroundPermissionsAsync()).status !== 'granted') {
        setLocationNotice('Location access is off. You can still go online and claim jobs. Distances need a saved dispatch position.');
        return;
      }
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await api.put('/delivery/availability', { online: board?.rider.online || false, latitude: coords.latitude, longitude: coords.longitude });
      await refreshAll();
    } catch (failure) { setError(message(failure)); }
    finally { pending.current = false; setBusy(false); }
  }
  async function claim(job: AvailableJob) {
    if (pending.current || !canClaim) return;
    pending.current = true; setClaimingId(job.id); setError(''); setPanel(null);
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
  return <Screen title="Dashboard" brandedHeader back={false} right={<View style={{ flexDirection: 'row', gap: 4 }}>
    <IconButton label="Refresh jobs" onPress={() => { if (!query.isFetching) void query.refetch(); }}>{query.isFetching ? <ActivityIndicator size="small" color={palette.primary} /> : <RefreshCw size={20} color={palette.primary} />}</IconButton>
    <IconButton label="Open rider tools" onPress={() => setPanel('tools')}><Menu size={21} color={palette.primary} /></IconButton>
  </View>}>
    <View style={{ gap: 14 }}>
      {query.isLoading && <ActivityIndicator accessibilityLabel="Loading dashboard" color={palette.primary} />}
      {!!query.error && <Empty title="Unable to load jobs" message={message(query.error)} action="Retry" onPress={() => { void query.refetch(); }} />}
      {board && <>
        <Card testID="rider-status-card" style={{ padding: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: board.rider.online ? palette.successInk : palette.muted }} />
                <Txt accessibilityLiveRegion="polite" style={{ fontSize: 17, fontWeight: '700' }}>{board.rider.online ? 'You are online' : 'You are offline'}</Txt>
              </View>
              <Txt style={{ fontSize: 12, color: palette.muted }}>{board.rider.online ? 'Ready for pickups & deliveries' : 'Go online to see jobs'}</Txt>
            </View>
            <Button title={board.rider.online ? 'Go offline' : 'Go online'} compact outline={board.rider.online} busy={busy && claimingId === null} disabled={claimingId !== null} onPress={() => { void availability(!board.rider.online); }} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Open my active jobs" onPress={() => router.push('/rider/jobs')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 7, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 8, minHeight: 44 }}>
            <Bike size={18} color={palette.primary} /><Txt style={{ flex: 1, fontSize: 12, color: palette.muted }}>Active jobs</Txt>
            <Txt style={{ fontSize: 16, fontWeight: '700', color: palette.primary }}>{board.rider.workload}<Txt style={{ fontSize: 12, color: palette.muted }}> / {board.rider.capacity}</Txt></Txt><ChevronRight size={17} color={palette.primary} />
          </Pressable>
          {board.rider.online && board.rider.workload >= board.rider.capacity && <Txt style={{ color: palette.warning, fontSize: 12 }}>Your job slots are full. Finish a job in My jobs to claim another.</Txt>}
        </Card>
        {board.rider.online && <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View accessibilityRole="tablist" style={{ flex: 1, flexDirection: 'row', gap: 5 }}>
              {['All', 'Pickup', 'Delivery'].map(value => <Pressable key={value} accessibilityRole="tab" accessibilityLabel={value} accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)}
                style={{ flex: 1, minWidth: 0, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: filter === value ? palette.primary : palette.line, backgroundColor: filter === value ? palette.soft : 'white', borderRadius: 11 }}>
                <Txt style={{ fontSize: 12, fontWeight: '600', color: filter === value ? palette.primary : palette.muted }}>{value}</Txt>
              </Pressable>)}
            </View>
            <IconButton label="Filter and sort jobs" onPress={() => setPanel('filters')}><SlidersHorizontal size={20} color={palette.primary} />
              {(filter !== 'All' || sort !== 'Oldest first') && <View style={{ position: 'absolute', top: 7, right: 7, width: 5, height: 5, borderRadius: 3, backgroundColor: palette.primary }} />}
            </IconButton>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Txt accessibilityLiveRegion="polite" style={{ fontWeight: '600', fontSize: 13 }}>{query.isError ? 'Saved jobs' : jobs.length + (jobs.length === 1 ? ' job' : ' jobs')}</Txt>
            <Txt style={{ fontSize: 11, color: palette.muted }}>{sort}</Txt>
          </View>
        </>}
      </>}
      {!!error && <Txt accessibilityRole="alert" style={{ color: palette.danger }}>{error}</Txt>}
      {board?.rider.online && !query.isError && <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 }}>
        {jobs.map(job => <Card key={job.id} testID={`available-job-${job.id}`} style={{ width: width >= 768 ? '48.8%' : '100%', padding: 14, gap: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`View ${job.stage.toLowerCase()} job #${job.id}`} onPress={() => viewJob(job)} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: palette.soft, borderRadius: 7 }}>
                {job.stage === 'Pickup' ? <Bike size={14} color={palette.primary} /> : <Package size={14} color={palette.primary} />}
                <Txt style={{ color: palette.primary, fontWeight: '600', fontSize: 11 }}>{job.stage}</Txt>
              </View>
              <Txt style={{ flex: 1, color: palette.muted, fontSize: 12, fontWeight: '600' }}>#{job.id}</Txt><ChevronRight size={17} color={palette.primary} />
            </View>
            <View style={{ gap: 2 }}><Txt numberOfLines={1} style={{ fontSize: 16, fontWeight: '700' }}>{job.shopName}</Txt><Txt numberOfLines={1} style={{ color: palette.muted, fontSize: 12 }}>{job.serviceName} · {job.kilos} kg</Txt></View>
            <View style={{ gap: 4 }}>{[['From', job.pickupArea], ['To', job.dropoffArea]].map(([label, area]) => <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Txt style={{ width: 30, color: palette.muted, fontSize: 11 }}>{label}</Txt><Txt numberOfLines={1} style={{ flex: 1, fontSize: 12 }}>{area}</Txt>
            </View>)}</View>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 8 }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}><MapPin size={13} color={palette.muted} /><Txt style={{ color: palette.muted, fontSize: 11 }}>{distance(job)}</Txt></View>
            <Button title="Claim" accessibilityLabel={`Claim ${job.stage.toLowerCase()} job #${job.id}`} compact busy={claimingId === job.id} disabled={!canClaim || claimingId !== null || busy} onPress={() => { void claim(job); }} />
          </View>
        </Card>)}
      </View>}
      {board && !query.isError && (!board.rider.online ? <Empty title="Go online to receive jobs" message="Pickup and delivery jobs appear here when you are online." />
        : !jobs.length ? <Empty title={filter === 'All' ? 'No available jobs right now' : `No ${filter.toLowerCase()} jobs right now`} message={filter === 'All' ? 'Confirmed pickups and laundry ready for rider delivery appear here.' : 'Try All to see other available jobs.'}
          {...(filter !== 'All' ? { action: 'Show all jobs', onPress: () => setFilter('All') } : {})} /> : null)}
    </View>
    {panel === 'tools' && <RiderDashboardPanel title="Rider tools" drawer onClose={() => setPanel(null)}
      footer={<Button title="Sign Out" compact outline color={palette.danger} onPress={() => { setPanel(null); void logout(); }} />}>
      <View style={{ gap: 3 }}><Txt style={{ fontSize: 18, fontWeight: '700' }}>{user?.name || 'Rider'}</Txt><Txt style={{ color: palette.muted, fontSize: 12 }}>{user?.email}</Txt></View>
      <View style={{ gap: 8 }}><Txt style={styles.heading}>Dispatch position</Txt><Txt style={{ fontSize: 12, color: palette.muted }}>Optional. Used to show approximate job distances.</Txt>
        <Button title="Update dispatch position" compact outline icon={<MapPin size={17} color={palette.primary} />} disabled={busy || claimingId !== null} onPress={() => { void locate(); }} />
        {!!locationNotice && <Txt accessibilityLiveRegion="polite" style={{ color: palette.muted, fontSize: 12 }}>{locationNotice}</Txt>}
      </View>
      {!!board && board.rider.workload > 0 && <RiderLocationSharingControl />}
      <View style={{ gap: 6 }}><Txt style={{ fontWeight: '600' }}>How jobs appear</Txt><Txt style={{ color: palette.muted, fontSize: 12 }}>Pickups appear after the shop confirms a rider-pickup booking. Delivery jobs appear when clean laundry is ready for a rider.</Txt>
        <Txt style={{ color: palette.muted, fontSize: 12 }}>Jobs refresh every 15 seconds. Exact addresses and customer contacts unlock after claiming.</Txt>
        {!!board && board.jobs.length >= board.limit && <Txt style={{ color: palette.muted, fontSize: 12 }}>Showing the oldest {board.limit} jobs.</Txt>}
      </View>
    </RiderDashboardPanel>}
    {panel === 'filters' && <RiderDashboardPanel title="Filter jobs" onClose={() => setPanel(null)} footer={<View style={{ flexDirection: 'row', gap: 10 }}>
      <Button title="Reset" compact outline style={{ flex: 1 }} onPress={() => { setFilter('All'); setSort('Oldest first'); }} />
      <Button title={`Show ${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'}`} compact style={{ flex: 1 }} onPress={() => setPanel(null)} />
    </View>}>
      <View><Txt style={styles.heading}>Job type</Txt><TabsRow items={['All', 'Pickup', 'Delivery']} value={filter} onChange={setFilter} /></View>
      <View accessibilityRole="radiogroup" accessibilityLabel="Sort jobs"><Txt style={styles.heading}>Sort by</Txt>
        {['Oldest first', 'Nearest first'].map(value => <Choice key={value} label={value} selected={sort === value} onPress={() => setSort(value)} />)}
      </View>
      {!board?.rider.hasPosition && <Txt style={{ color: palette.muted, fontSize: 12 }}>Save a dispatch position in Rider tools to see distances.</Txt>}
    </RiderDashboardPanel>}
    {panel === 'job' && <RiderDashboardPanel title={selectedJob ? `${selectedJob.stage} · Order #${selectedJob.id}` : 'Job unavailable'} onClose={() => setPanel(null)}
      footer={selectedJob ? <Button title="Claim job" accessibilityLabel={`Claim ${selectedJob.stage.toLowerCase()} job #${selectedJob.id} from details`} busy={claimingId === selectedJob.id} disabled={!canClaim || busy || claimingId !== null} onPress={() => { void claim(selectedJob); }} /> : <Button title="Close" outline onPress={() => setPanel(null)} />}>
      {selectedJob ? <>
        <View style={{ gap: 4 }}><Txt style={{ fontSize: 21, fontWeight: '700' }}>{selectedJob.shopName}</Txt><Txt style={{ color: palette.muted }}>{selectedJob.serviceName} · {selectedJob.kilos} kg</Txt><Txt style={{ color: palette.primary, fontSize: 12 }}>{distance(selectedJob)}</Txt></View>
        <JobRoutePreview key={selectedJob.id} orderId={selectedJob.id} />
        {[['Collect from', selectedJob.pickupArea], ['Take to', selectedJob.dropoffArea]].map(([title, area]) => <View key={title} style={{ flexDirection: 'row', gap: 10 }}>
          <MapPin size={19} color={palette.primary} /><View style={{ flex: 1, gap: 4 }}><Txt style={{ color: palette.muted, fontSize: 12 }}>{title}</Txt><Txt style={{ fontWeight: '600' }}>{area}</Txt></View>
        </View>)}
        {!!schedule(selectedJob) && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Clock3 size={17} color={palette.primary} /><View><Txt style={{ color: palette.muted, fontSize: 12 }}>{selectedJob.requestedPickupAt ? 'Requested pickup' : 'Service schedule'}</Txt><Txt>{schedule(selectedJob)}</Txt></View></View>}
        <Txt style={{ color: palette.muted, fontSize: 12 }}>Booked {new Date(selectedJob.createdAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} (PHT)</Txt>
        <Txt style={{ color: palette.muted, fontSize: 12 }}>The map uses saved pickup and destination pins. Customer contacts and written addresses unlock in My jobs after claiming.</Txt>
      </> : <Empty title="This job is no longer available" message="Refresh the dashboard to check for other jobs." />}
    </RiderDashboardPanel>}
  </Screen>;
}
