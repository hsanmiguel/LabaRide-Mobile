import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Switch, View, useWindowDimensions } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bike, MapPin, Navigation, Package, X } from 'lucide-react-native';
import * as Location from 'expo-location';
import { router, type Href } from 'expo-router';
import { api, address, confirmAction, message } from './data';
import { Button, Card, Empty, Field, IconButton, Screen, SearchBox, Section, TabsRow, Txt, money, styles, usePalette } from './ui';
import { useAuthStore } from '../store/authStore';
import { useLogout } from './useLogout';
import { AdminRiderRequirements, RiderApplicantPhoto } from './RiderRequirementsScreens';
import { WeightEvidenceCard, WeightUpdateForm, type WeightEvidence } from './WeightEvidence';
import { CustomerRiderTracking } from './CustomerRiderTracking';
import { RiderLocationSharingControl } from './RiderLocationSharing';
import { CallContactButton } from './CallContactButton';

import { TurnaroundDetails, type TurnaroundOrder } from './TurnaroundDetails';
import type { AddressData } from './address';
import PickerField from './PickerField';
import { timeInputValue } from './form-values';

type Handoff = { kind: 'pickup' | 'collection' | 'delivery'; arrived: boolean; released: boolean };

function HandoffPanel({ handoff, rider = false, busy, send }: { handoff: Handoff; rider?: boolean; busy: boolean; send: (action: string) => void }) {
  const palette = usePalette();
  const name = handoff.kind === 'collection' ? 'shop' : 'customer';
  return <View style={{ padding: 16, borderRadius: 14, backgroundColor: palette.soft, gap: 12 }}>
    <Txt style={{ fontWeight: '700', color: palette.primary }}>Handover confirmation</Txt>
    <Txt accessibilityLiveRegion="polite" style={styles.muted}>{!handoff.arrived ? rider ? `Mark arrival when you reach the ${name}.` : 'Waiting for the rider to arrive.' : !handoff.released ? rider ? `Waiting for the ${name} to confirm the physical handover in their account.` : handoff.kind === 'delivery' ? 'The rider has arrived. Confirm after receiving your clean laundry.' : 'The rider has arrived. Confirm after handing over the laundry.' : rider ? 'Handover confirmed. Finish this step after checking the laundry.' : 'Handover confirmed. Waiting for the rider to finish this step.'}</Txt>
    {rider ? !handoff.arrived ? <Button title={handoff.kind === 'collection' ? 'Arrived at shop' : 'Arrived at customer'} busy={busy} onPress={() => send('arriveHandoff')} /> : <Button title={handoff.kind === 'delivery' ? 'Confirm delivery completed' : 'Confirm laundry received'} disabled={!handoff.released} busy={busy} onPress={() => send('receiveHandoff')} /> : <Button title={handoff.kind === 'delivery' ? 'I received my clean laundry' : 'I handed over the laundry'} disabled={!handoff.arrived || handoff.released} busy={busy} onPress={() => send('releaseHandoff')} />}
  </View>;
}

type Job = { id: number; transactionId: number; riderId: number; stage: string; status: string; expiresAt: string; createdAt: string; updatedAt: string; rider?: { name: string }; order: { handoff?: Handoff; id: number; status: string; serviceName: string; kiloAmount: string; scheduledDate: string | null; scheduledTime: string | null; requestedPickupAt?: string | null; totalAmount?: string; paymentMethod?: string; customer: { name?: string; phone?: string; address: string; latitude?: number; longitude?: number; instructions?: string; notes?: string; accessCode?: string }; shop: { name: string; address: string; phone?: string; latitude?: number; longitude?: number } } };
type Rider = { userId: number; active: boolean; online: boolean; applicationStatus?: string; reviewReason?: string; canEnable?: boolean; approvalMissing?: string[]; workload: number; user: { name: string; email: string; phone?: string } };
type RiderOptions = { stage: 'Pickup' | 'Delivery'; workflowVersion: number; origin: { source: 'customer' | 'shop'; name: string; address: string; coordinatesAvailable: boolean }; riders: { userId: number; name: string; workload: number; distance: number | null }[] };
type Event = { id: number; action: string; toStatus: string; detail?: string; createdAt: string; actor: { name: string } };
type DeliveryOrder = TurnaroundOrder & { collectionMethod?: 'Dropoff' | 'ShopPickup'; collectionAddress?: AddressData | null; id: number; workflowStatus: string; workflowVersion: number; weightEvidence?: WeightEvidence[]; handoff?: Handoff; serviceName: string; kiloAmount: string; userName: string; userPhone?: string; scheduledDate: string | null; scheduledTime: string | null; createdAt: string; notes?: string; totalAmount: string; pickupCode?: string; collectionCode?: string; deliveryCode?: string; assignments: Job[]; events: Event[]; shop: { shopName: string }; address_line_1?: string; city?: string };
const label = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2');
const scheduledAt = (order: { scheduledDate: string | null; scheduledTime: string | null; requestedPickupAt?: string | null }) => order.requestedPickupAt ? new Date(order.requestedPickupAt) : order.scheduledDate && order.scheduledTime ? new Date(order.scheduledDate.slice(0, 10) + 'T' + order.scheduledTime.slice(11, 19) + 'Z') : new Date(NaN);
const scheduleLabel = (order: { scheduledDate: string | null; scheduledTime: string | null; requestedPickupAt?: string | null }) => !Number.isFinite(scheduledAt(order).getTime()) ? 'Not scheduled' : scheduledAt(order).toLocaleString([], { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const stamp = (value: string) => new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const riderActions: Record<string, { action: string; title: string; code?: boolean }> = {
  PickupAccepted: { action: 'enRoute', title: 'Start pickup trip' },
  PickupEnRoute: { action: 'pickedUp', title: 'Confirm laundry pickup', code: true },
  LaundryPickedUp: { action: 'droppedOff', title: 'Arrived at laundry shop' },
  DeliveryAccepted: { action: 'collected', title: 'Collect clean laundry', code: true },
  CleanLaundryCollected: { action: 'outForDelivery', title: 'Start delivery trip' },
  OutForDelivery: { action: 'delivered', title: 'Confirm delivery', code: true },
};
const partnerActions: Record<string, { action: string; title: string }> = {
  BookingPending: { action: 'confirmBooking', title: 'Confirm booking' },
  AtPartner: { action: 'receive', title: 'Confirm laundry received' },
  LaundryReceived: { action: 'wash', title: 'Start washing' },
  Washing: { action: 'dry', title: 'Start drying' },
  Drying: { action: 'fold', title: 'Start folding' },
  Folding: { action: 'ready', title: 'Mark laundry ready' },
  ReadyForCollection: { action: 'completeCollection', title: 'Confirm customer collected laundry' },
};

function State({ query }: { query: { isLoading: boolean; error: unknown; refetch: () => unknown } }) {
  return query.isLoading ? <ActivityIndicator accessibilityLabel="Loading deliveries" /> : query.error ? <Empty title="Unable to load deliveries" message={message(query.error)} action="Retry" onPress={() => query.refetch()} /> : null;
}
function Badge({ value }: { value: string }) {
  const palette = usePalette();
  return <View style={{ alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: palette.soft }}><Txt style={{ color: palette.primary, fontSize: 12, fontWeight: '600' }}>{label(value)}</Txt></View>;
}
function useCommand() {
  const cache = useQueryClient();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function send(path: string, body: unknown) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true); setError('');
    try {
      await api.put(path, body);
      await Promise.all(['delivery', 'notifications', 'user-orders', 'shop-orders', 'user'].map(key => cache.invalidateQueries({ queryKey: [key] })));
      return true;
    } catch (failure) {
      setError(message(failure));
      await cache.invalidateQueries({ queryKey: ['delivery'] });
      return false;
    }
    finally { inFlight.current = false; setBusy(false); }
  }
  return { busy, error, setError, send };
}

export function DeliveryOrderDesign({ id, partner = false }: { id: number; partner?: boolean }) {
  const user = useAuthStore(state => state.user);
  const query = useQuery({ queryKey: ['delivery', 'order', id, user?.id], queryFn: () => api.get<DeliveryOrder>(`/delivery/orders/${id}`), refetchInterval: 15000 });
  const command = useCommand();
  const [note, setNote] = useState('');

  const palette = usePalette();
  const { width } = useWindowDimensions();
  const order = query.data;
  const next = order && (partner ? partnerActions[order.workflowStatus] : !user?.isAdmin && order.workflowStatus === 'Delivered' ? { action: 'confirmReceipt', title: 'Confirm receipt' } : undefined);
  const [estimateDate, setEstimateDate] = useState('');
  const [estimateTime, setEstimateTime] = useState('');
  async function saveWeight(kilos: number, note: string, imageBase64: string) {
    if (!order || !await confirmAction('Save measured weight?', 'The customer will see the scale photo, measured weight and recalculated price. Save this update?')) return false;
    return command.send(`/delivery/orders/${id}/weight`, { kilos, note, imageBase64, expectedVersion: order.workflowVersion });
  }
  async function action(name: string) {
    if (!order) return;
    const explanation = note.trim();
    command.setError('');
    if (name === 'confirmBooking' && !explanation) { command.setError('Enter an acceptance explanation before confirming this booking.'); return; }
    if (['cancel', 'issue', 'resolveIssue'].includes(name) && !explanation) { command.setError('Enter a reason or explanation before continuing.'); return; }
    if (name !== 'confirmBooking' && explanation && explanation.length < 5) { command.setError('Enter at least 5 characters for the notes or reason.'); return; }
    let estimatedReadyAt: string | undefined;
    if (name === 'updateEstimate') {
      const time = timeInputValue(estimateTime);
      const timestamp = time && estimateDate ? Date.parse(estimateDate + 'T' + time + ':00+08:00') : NaN;
      if (!Number.isFinite(timestamp) || timestamp <= Date.now()) { command.setError('Choose a future ready date and time.'); return; }
      if (order.estimatedReadyAt && !explanation) { command.setError('Explain the revised ready estimate in the notes.'); return; }
      estimatedReadyAt = new Date(timestamp).toISOString();
    }
    if (!await confirmAction('Update order', name === 'releaseHandoff' ? 'Confirm only after the laundry has physically changed hands. Continue?' : name === 'cancel' ? 'Cancel this booking and notify everyone?' : 'Confirm this update and notify everyone involved?')) return;
    if (await command.send(`/delivery/orders/${id}/action`, { action: name, expectedVersion: order.workflowVersion, note: explanation || undefined, estimatedReadyAt })) setNote('');
  }
  return <Screen title={`Order #${id}`} brandedHeader={!!user?.isAdmin}>
    <State query={query} />
    {order && <View style={styles.stack}>
      <Card><View style={styles.between}><View style={styles.row}><Package size={24} color={palette.primary} /><Txt style={styles.heading}>{order.serviceName}</Txt></View><Badge value={order.workflowStatus} /></View>
        <Txt style={styles.muted}>Pickup → Laundry care → Delivery → Receipt</Txt>
        <Txt>{order.kiloAmount} kg · {money(order.totalAmount)}</Txt>
        <TurnaroundDetails order={order} />
      </Card>
      <View style={{ flexDirection: width >= 1000 ? 'row' : 'column', gap: 20, alignItems: 'flex-start' }}>
        <View style={{ flex: width >= 1000 ? 1 : undefined, width: width >= 1000 ? undefined : '100%', gap: 20 }}>
          <Card><Section title={partner ? 'Customer & collection' : 'Your pickup & delivery'} /><Txt>{order.userName}</Txt><Txt>{address(order)}</Txt>{order.collectionMethod === 'ShopPickup' && order.collectionAddress && <><Txt style={styles.muted}>Laundry collection address</Txt><Txt>{address(order.collectionAddress)}</Txt></>}{order.workflowStatus === 'AtPartner' && order.collectionMethod === 'Dropoff' && <Txt style={styles.muted}>Bring the laundry to the shop. Processing starts after the shop confirms receipt.</Txt>}{order.workflowStatus === 'ReadyForCollection' && <Txt style={styles.muted}>Your laundry is ready. Collect it from the shop.</Txt>}{partner && !!order.userPhone && <Txt selectable>{order.userPhone}</Txt>}<Txt style={styles.muted}>{order.shop.shopName}</Txt>{!!order.notes && <Txt>{order.notes}</Txt>}</Card>
          <WeightEvidenceCard orderId={id} evidence={order.weightEvidence || []} />
          {!partner && !user?.isAdmin && <CustomerRiderTracking orderId={id} orderStatus={order.workflowStatus} />}
          {!user?.isAdmin && order.handoff && (partner ? order.handoff.kind === 'collection' : order.handoff.kind !== 'collection') && <HandoffPanel handoff={order.handoff} busy={command.busy} send={name => { void action(name); }} />}
          {!!(partner ? order.collectionCode : order.pickupCode || order.deliveryCode) && !['Cancelled', 'Completed'].includes(order.workflowStatus) && <Card>
            <Section title="Handoff confirmation" />
            <Txt style={styles.muted}>Share a code only with the assigned rider at the physical handoff.</Txt>
            {partner ? <Txt selectable style={styles.heading}>Clean laundry collection: {order.collectionCode}</Txt> : <><Txt selectable style={styles.heading}>Laundry pickup: {order.pickupCode}</Txt><Txt selectable style={styles.heading}>Delivery receipt: {order.deliveryCode}</Txt></>}
          </Card>}
          {!!order.assignments.length && <Card><Section title="Rider assignments" />{order.assignments.map(job => <View key={job.id} style={{ gap: 4 }}><Txt style={{ fontWeight: '600' }}>{job.stage} · {job.rider?.name || 'Assigned rider'}</Txt><Txt style={styles.muted}>{job.status} · {stamp(job.updatedAt)}</Txt></View>)}</Card>}
          {!['Completed', 'Cancelled'].includes(order.workflowStatus) && <Card>
            <Section title={partner ? 'Manage laundry' : 'Order actions'} />
            <Field label={order.workflowStatus === 'BookingPending' && partner ? 'Acceptance explanation or cancellation reason' : 'Notes / issue details'} value={note} onChangeText={value => { setNote(value); command.setError(''); }} placeholder={order.workflowStatus === 'BookingPending' && partner ? 'For example: We can accept this booking.' : 'Add notes or describe the issue.'} editable={!command.busy} multiline maxLength={1000} />
            {order.workflowStatus === 'BookingPending' && partner && <Txt style={{ fontSize: 12, color: palette.muted }}>An explanation is required to confirm the booking. Cancellation and issue reasons need at least 5 characters.</Txt>}
            {!!command.error && <Txt accessibilityRole="alert" style={{ color: palette.danger }}>{command.error}</Txt>}
            {next && <Button title={next.title} busy={command.busy} onPress={() => action(next.action)} />}
            {partner && ['LaundryReceived', 'Washing', 'Drying', 'Folding'].includes(order.workflowStatus) && <View style={{ gap: 12 }}><Section title="Ready time estimate" /><PickerField label="Ready date" mode="date" value={estimateDate} onChange={setEstimateDate} /><PickerField label="Ready time" mode="time" value={estimateTime} onChange={setEstimateTime} /><Txt style={styles.muted}>For a revised estimate, explain the change in the notes above.</Txt><Button title={order.estimatedReadyAt ? 'Update ready estimate' : 'Send ready estimate'} outline busy={command.busy} onPress={() => action('updateEstimate')} /></View>}
            {partner && ['LaundryReceived', 'Washing', 'Drying', 'Folding'].includes(order.workflowStatus) && <WeightUpdateForm key={id} kilos={order.kiloAmount} busy={command.busy} save={saveWeight} />}
            {(partner || user?.isAdmin || order.workflowStatus === 'BookingPending') && <Button title="Cancel booking" outline color={palette.danger} busy={command.busy} onPress={() => action('cancel')} />}
            {(partner || user?.isAdmin) && <Button title="Report delivery issue" outline busy={command.busy} onPress={() => action('issue')} />}
            {user?.isAdmin && <Button title="Resolve reported issue" outline busy={command.busy} onPress={() => action('resolveIssue')} />}
          </Card>}
        </View>
        <Card style={{ flex: width >= 1000 ? 1 : undefined, width: width >= 1000 ? undefined : '100%' }}><Section title="Order timeline" />{order.events.map(event => <View key={event.id} style={{ borderLeftWidth: 2, borderLeftColor: palette.line, paddingLeft: 14, paddingBottom: 14, gap: 4 }}>
          <Txt style={{ fontWeight: '600' }}>{label(event.toStatus)} · {label(event.action)}</Txt>{!!event.detail && <Txt>{event.detail}</Txt>}<Txt style={{ color: palette.muted, fontSize: 12 }}>{event.actor.name} · {stamp(event.createdAt)}</Txt>
        </View>)}</Card>
      </View>
    </View>}
  </Screen>;
}

export function RiderDashboardDesign({ history = false }: { history?: boolean }) {
  const user = useAuthStore(state => state.user);
  const query = useQuery({ queryKey: ['delivery', 'rider', user?.id], queryFn: () => api.get<{ rider: { online: boolean }; jobs: Job[] }>('/delivery/rider'), refetchInterval: 15000 });
  const command = useCommand();
  const logout = useLogout();
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState('All');
  const [decision, setDecision] = useState<{ job: Job; action: string; title: string; code?: boolean; response?: boolean } | null>(null);
  const [note, setNote] = useState('');
  const [code, setCode] = useState('');
  const jobs = query.data?.jobs || [];
  const active = jobs.filter(job => ['Offered', 'Accepted'].includes(job.status));
  const today = new Date().toDateString();
  const completedToday = jobs.filter(job => job.status === 'Completed' && new Date(job.updatedAt).toDateString() === today);
  const shown = (history ? jobs.filter(job => !['Offered', 'Accepted'].includes(job.status)) : active).filter(job => filter === 'All' || job.stage === filter);
  function choose(job: Job, action: string, title: string, proof = false, response = false) { command.setError(''); setNote(''); setCode(''); setDecision({ job, action, title, code: proof, response }); }
  async function submit() {
    if (!decision) return;
    const { job } = decision;
    let success;
    if (decision.response) success = await command.send(`/delivery/assignments/${job.id}/respond`, { action: decision.action, reason: note.trim() || undefined });
    else {
      // Fetch a fresh version; the server also checks the assigned rider and exact current stage.
      success = await command.send(`/delivery/orders/${job.transactionId}/action`, { action: decision.action, expectedVersion: (job.order as Job['order'] & { version?: number }).version, code: decision.code ? code.trim() : undefined, note: note.trim() || undefined });
    }
    if (success) setDecision(null);
    else if (decision.response) {
      const latest = await query.refetch();
      const current = latest.data?.jobs.find(item => item.id === job.id);
      if (latest.data && (!current || current.status !== 'Offered' || new Date(current.expiresAt).getTime() <= Date.now())) setDecision(null);
    }
  }
  async function locate() {
    try {
      if ((await Location.requestForegroundPermissionsAsync()).status !== 'granted') { command.setError('Enable location permission to update your dispatch position.'); return; }
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await command.send('/delivery/availability', { online: query.data?.rider.online || false, latitude: coords.latitude, longitude: coords.longitude });
    } catch { command.setError('Could not retrieve your position. Try again.'); }
  }
  return <Screen title={history ? 'Job history' : 'Rider dashboard'} back={false} right={<Button title="Sign Out" compact outline onPress={logout} />}>
    <View style={styles.stack}>
      <View><Txt style={styles.title}>{history ? 'Your delivery record' : `Hello, ${user?.name.split(' ')[0] || 'rider'}`}</Txt><Txt style={styles.muted}>{history ? 'Completed trips and assignment outcomes.' : 'Keep laundry moving, one handoff at a time.'}</Txt></View>
      <State query={query} />
      {!history && <RiderLocationSharingControl />}
      {!history && query.data && <>
        <Card><View style={styles.between}><View style={styles.row}><Bike size={26} color={palette.primary} /><View><Txt style={styles.heading}>{query.data.rider.online ? 'You are online' : 'You are offline'}</Txt><Txt style={styles.muted}>{query.data.rider.online ? 'Available for jobs and admin offers' : 'Active jobs stay available below'}</Txt></View></View>
          <Switch accessibilityLabel="Rider availability" value={query.data.rider.online} disabled={command.busy} onValueChange={online => { void command.send('/delivery/availability', { online }); }} trackColor={{ true: palette.primary }} /></View>
          <Button title="Update dispatch position" outline compact style={Platform.OS === 'web' ? { alignSelf: 'flex-start' } : undefined} onPress={locate} busy={command.busy} />
        </Card>
        <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>{[['Assigned today', jobs.filter(job => new Date(job.createdAt).toDateString() === today).length], ['Active jobs', active.length], ['Completed today', completedToday.length]].map(([title, count]) => <Card key={title} style={{ flexGrow: 1, flexBasis: 90 }}><Txt style={{ color: palette.muted, fontSize: 12 }}>{title}</Txt><Txt style={styles.title}>{count}</Txt></Card>)}</View>
      </>}
      {!!command.error && !decision && <Txt accessibilityRole="alert" style={{ color: palette.danger }}>{command.error}</Txt>}
      <TabsRow items={['All', 'Pickup', 'Delivery']} value={filter} onChange={setFilter} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 16 }}>
        {shown.map(job => {
          const next = riderActions[job.order.status];
          const handoff = job.order.handoff;
          const customerFirst = job.stage === 'Pickup';
          const stops = customerFirst ? [job.order.customer, { ...job.order.shop, name: job.order.shop.name }] : [{ ...job.order.shop, name: job.order.shop.name }, job.order.customer];
          return <Card key={job.id} style={{ width: width >= 1100 ? '48.8%' : '100%', gap: 16 }}>
            <View style={styles.between}><Txt style={styles.heading}>{job.stage} · Order #{job.transactionId}</Txt><Badge value={job.status === 'Accepted' ? job.order.status : job.status} /></View>
            <Txt style={styles.muted}>{job.order.shop.name} · {job.order.serviceName} · {job.order.kiloAmount} kg</Txt>
            <Txt style={{ fontSize: 12, color: palette.muted }}>Scheduled {scheduleLabel(job.order)}</Txt>
            {job.status === 'Accepted' && handoff && <HandoffPanel handoff={handoff} rider busy={command.busy} send={action => choose(job, action, action === 'arriveHandoff' ? 'Confirm arrival' : handoff.kind === 'delivery' ? 'Confirm delivery completed' : 'Confirm laundry received')} />}
            {stops.map((stop, index) => <View key={index} style={{ borderLeftWidth: 2, borderLeftColor: palette.line, paddingLeft: 12, gap: 6 }}><Txt style={{ fontSize: 12, color: palette.muted }}>{index === 0 ? 'COLLECT FROM' : 'TAKE TO'}</Txt>{!!stop.name && <Txt style={{ fontWeight: '600' }}>{stop.name}</Txt>}<Txt>{stop.address}</Txt>
              {job.status === 'Accepted' && <View style={[styles.row, { flexWrap: 'wrap' }]}><Button title="Navigate" compact outline icon={<Navigation size={15} color={palette.primary} />} onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.latitude != null && stop.longitude != null ? `${stop.latitude},${stop.longitude}` : stop.address)}`)} />{!!stop.phone && <CallContactButton name={stop.name} phone={stop.phone} />}</View>}
            </View>)}
            {job.status === 'Offered' && <><Txt style={{ color: palette.muted, fontSize: 12 }}>Offer expires {stamp(job.expiresAt)}. Contact details unlock after acceptance.</Txt><View style={[styles.row, { flexWrap: 'wrap' }]}><Button title="Accept job" onPress={() => choose(job, 'accept', 'Accept assignment', false, true)} /><Button title="Decline" outline color={palette.danger} onPress={() => choose(job, 'decline', 'Decline assignment', false, true)} /></View></>}
            {job.status === 'Accepted' && <>{!!job.order.customer.instructions && <Txt>Instructions: {job.order.customer.instructions}</Txt>}{!!job.order.customer.notes && <Txt>Order notes: {job.order.customer.notes}</Txt>}{!!job.order.customer.accessCode && <Txt>Access: {job.order.customer.accessCode}</Txt>}{job.stage === 'Delivery' && <Txt>Order total: {money(job.order.totalAmount)} · {job.order.paymentMethod}</Txt>}{next && <Button title={handoff ? 'Use code instead (fallback)' : next.title} outline={!!handoff} onPress={() => choose(job, next.action, next.title, next.code)} />}{job.stage === 'Pickup' && ['PickupAccepted', 'PickupEnRoute'].includes(job.order.status) && <Button title="Pickup unsuccessful" outline color={palette.danger} onPress={() => choose(job, 'failedPickup', 'Report failed pickup')} />}<Button title="Report an issue" outline color={palette.danger} onPress={() => choose(job, 'issue', 'Report delivery issue')} /></>}
            {history && <Txt style={styles.muted}>Last updated {stamp(job.updatedAt)}</Txt>}
          </Card>;
        })}
      </View>
      {!query.isLoading && !query.error && !shown.length && <Empty title={history ? 'No past jobs yet' : 'No active jobs yet'} message={history ? 'Your job outcomes will appear here.' : 'Go online and claim a pickup or delivery from Available Jobs.'} action={history ? undefined : 'Browse available jobs'} onPress={history ? undefined : () => router.push('/rider')} />}
    </View>
    <ActionModal visible={!!decision} close={() => !command.busy && setDecision(null)}>
      <Txt style={styles.heading}>{decision?.title}</Txt><Txt style={styles.muted}>Order #{decision?.job.transactionId}</Txt>
      {decision?.code && <Field label="6-digit handoff code" keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} />}
      {(decision?.action === 'decline' || decision?.action === 'issue' || decision?.action === 'failedPickup') && <Field label="Reason (required)" value={note} onChangeText={setNote} multiline maxLength={1000} />}
      <Txt style={styles.muted}>{decision?.code ? 'Find the matching handoff code in your Updates tab. Confirm only after the physical handover.' : decision?.action === 'arriveHandoff' ? 'Confirm you have reached the handover location. The customer or shop will be notified.' : decision?.action === 'receiveHandoff' ? 'Confirm only after the laundry has physically changed hands and you have checked it.' : 'Confirm this update. Everyone involved will be notified.'}</Txt>
      {!!command.error && <Txt accessibilityRole="alert" style={{ color: palette.danger }}>{command.error}</Txt>}
      <Button title="Confirm" busy={command.busy} onPress={submit} /><Button title="Cancel" outline disabled={command.busy} onPress={() => setDecision(null)} />
    </ActionModal>
  </Screen>;
}

function ActionModal({ visible, close, children, maxWidth = 520 }: { visible: boolean; close: () => void; children: React.ReactNode; maxWidth?: number }) {
  const { width } = useWindowDimensions();
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={close}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: '#00000066' }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: width < 480 ? 12 : 24, justifyContent: 'center' }}><Card style={{ width: '100%', maxWidth, padding: width < 480 ? 18 : 28, borderRadius: 22, alignSelf: 'center' }}>{children}</Card></ScrollView></KeyboardAvoidingView></Modal>;
}

export function OperationsDashboardDesign() {
  const user = useAuthStore(state => state.user);
  const logout = useLogout();
  const query = useQuery({ queryKey: ['delivery', 'operations', user?.id], queryFn: () => api.get<{ orders: DeliveryOrder[]; riders: Rider[] }>('/delivery/operations'), refetchInterval: 15000 });
  const command = useCommand();
  const palette = usePalette();
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [applicant, setApplicant] = useState<Rider | null>(null);
  const [canApprove, setCanApprove] = useState(false);
  const [reviewStatus, setReviewStatus] = useState('Loading');
  const [selected, setSelected] = useState<DeliveryOrder | null>(null);
  const [riderId, setRiderId] = useState(0);
  const [reason, setReason] = useState('');
  const assignmentOptions = useQuery({ queryKey: ['delivery', 'rider-options', user?.id, selected?.id], enabled: !!selected,
    queryFn: () => api.get<RiderOptions>(`/delivery/orders/${selected!.id}/rider-options`), refetchInterval: selected ? 15000 : false });
  useEffect(() => { setRiderId(0); }, [selected?.id, assignmentOptions.data?.workflowVersion]);
  const orders = query.data?.orders || [];
  const riders = query.data?.riders || [];
  const applications = riders.filter(rider => ['Draft', 'Pending', 'Rejected'].includes(rider.applicationStatus || ''));
  const roster = riders.filter(rider => !['Draft', 'Pending', 'Rejected'].includes(rider.applicationStatus || ''));
  function reviewApplication(rider: Rider) { setApplicant(rider); setCanApprove(false); setReviewStatus(rider.applicationStatus || 'Loading'); setReason(''); command.setError(''); }
  const unassigned = (order: DeliveryOrder) => !['BookingPending', 'Completed', 'Cancelled', 'AtPartner', 'LaundryReceived', 'Washing', 'Drying', 'Folding', 'Delivered', 'ReadyForCollection'].includes(order.workflowStatus) && !order.assignments.some(job => ['Offered', 'Accepted'].includes(job.status));
  const delayed = (order: DeliveryOrder) => !['Completed', 'Cancelled'].includes(order.workflowStatus) && scheduledAt(order).getTime() < Date.now();
  const issue = (order: DeliveryOrder) => order.events[order.events.length - 1]?.action === 'IssueReported';
  const visible = orders.filter(order => (filter === 'All' || filter === 'Unassigned' && unassigned(order) || filter === 'Pending' && order.workflowStatus === 'BookingPending' || filter === 'Active' && !['Completed', 'Cancelled', 'BookingPending'].includes(order.workflowStatus) || filter === 'Completed' && order.workflowStatus === 'Completed' || filter === 'Delayed' && delayed(order) || filter === 'Issues' && issue(order)) && `${order.id} ${order.userName} ${order.shop.shopName}`.toLowerCase().includes(search.toLowerCase()));
  async function assign() {
    if (!selected || !assignmentOptions.data || assignmentOptions.error || !assignmentOptions.data.riders.some(rider => rider.userId === riderId)) return;
    if (await command.send(`/delivery/orders/${selected.id}/assign`, { riderId, stage: assignmentOptions.data.stage, expectedVersion: assignmentOptions.data.workflowVersion, reason: reason.trim() || undefined })) setSelected(null);
  }
  return <Screen title="Delivery Operations" brandedHeader back={false}>
    <View style={styles.stack}>
      <View style={styles.between}>
        <View style={{ flex: 1, minWidth: 180, gap: 4 }}><Txt style={styles.title}>Delivery Operations</Txt><Txt style={styles.muted}>Monitor deliveries, review riders, and resolve issues. Riders claim available jobs themselves.</Txt></View>
        <Button title="Sign Out" outline onPress={logout} />
      </View>
      <State query={query} />
      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>{[['Pending bookings', orders.filter(order => order.workflowStatus === 'BookingPending').length], ['Unassigned jobs', orders.filter(unassigned).length], ['Riders online', roster.filter(rider => rider.active && rider.online).length], ['Riders offline', roster.filter(rider => rider.active && !rider.online).length], ['Delayed orders', orders.filter(delayed).length]].map(([title, count]) => <Card key={title} style={{ flexGrow: 1, flexBasis: 120 }}><Txt style={{ fontSize: 12, color: palette.muted }}>{title}</Txt><Txt style={styles.title}>{count}</Txt></Card>)}</View>
      <Card><Section title="Rider applications" /><Txt style={styles.muted}>People apply using “Apply as a Rider” on the login page. Review their details here to approve rider access.</Txt>
        {applications.map(rider => <View key={rider.userId} testID={`rider-application-${rider.userId}`} style={{ borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 16, gap: 8 }}><Txt style={styles.heading}>{rider.user.name}</Txt><Badge value={rider.applicationStatus === 'Draft' ? 'Draft · not submitted' : rider.applicationStatus === 'Rejected' ? 'Needs correction' : 'Pending document review'} /><Txt selectable>{rider.user.email}</Txt><Txt selectable>{rider.user.phone}</Txt><Txt style={styles.muted}>{rider.applicationStatus === 'Draft' ? 'The applicant must finish their requirements and submit before approval.' : rider.applicationStatus === 'Rejected' ? 'The applicant must correct the feedback and resubmit.' : 'Open the application and verify each required document before approving.'}</Txt><Button title={rider.applicationStatus === 'Pending' ? 'Review application' : 'View requirements'} outline onPress={() => reviewApplication(rider)} /></View>)}
        {!applications.length && <Txt style={styles.muted}>No rider applications waiting for review.</Txt>}
      </Card>
      <Card><Section title="Rider roster" />
        {roster.map(rider => <View key={rider.userId} testID={`rider-roster-${rider.userId}`} style={[styles.between, { borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 12 }]}><View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 140, minWidth: 140 }}><Txt style={{ fontWeight: '600' }}>{rider.user.name}</Txt><Txt style={styles.muted}>{rider.active ? rider.online ? 'Online' : 'Offline' : 'Disabled'} · {rider.workload} active jobs</Txt><Txt style={{ fontSize: 12, color: palette.muted }}>{rider.user.email}</Txt>{!rider.active && rider.canEnable === false && <Txt style={{ fontSize: 12, color: palette.warning }}>Requirements need updating or document verification before access can be restored.</Txt>}</View>{!rider.active && rider.canEnable === false ? <Button title="View requirements" compact outline onPress={() => reviewApplication(rider)} /> : <Button title={rider.active ? 'Disable' : 'Enable'} compact outline busy={command.busy} onPress={async () => { if (await confirmAction('Rider account', `${rider.active ? 'Disable' : 'Enable'} this rider account?`)) await command.send('/delivery/riders', { email: rider.user.email, active: !rider.active }); }} />}</View>)}
        {!roster.length && <Txt style={styles.muted}>Approved riders will appear here after their documents are verified.</Txt>}
      </Card>
      {!!command.error && !selected && !applicant && <Txt accessibilityRole="alert" style={{ color: palette.danger }}>{command.error}</Txt>}
      <View style={{ gap: 4 }}><Txt accessibilityRole="header" style={styles.heading}>Order monitoring</Txt><Txt style={styles.muted}>Review progress and audit history. Use manual assignment or reassignment when a job needs intervention.</Txt></View>
      <SearchBox value={search} onChangeText={setSearch} placeholder="Search order, customer, or laundry partner" />
      <TabsRow items={['Unassigned', 'Pending', 'Active', 'Completed', 'Delayed', 'Issues', 'All']} value={filter} onChange={setFilter} />
      {visible.map(order => <Card key={order.id}><View style={styles.between}><Txt style={styles.heading}>Order #{order.id} · {order.shop.shopName}</Txt><Badge value={order.workflowStatus} /></View><Txt>{order.userName} · {order.serviceName} · {order.kiloAmount} kg · {money(order.totalAmount)}</Txt><Txt style={styles.muted}>{address(order)}</Txt>{delayed(order) && <Txt style={{ color: palette.warning }}>Past scheduled service time · review progress</Txt>}{issue(order) && <Txt style={{ color: palette.danger }}>Issue: {order.events[order.events.length - 1].detail}</Txt>}
        {order.assignments.map(job => <Txt key={job.id} style={{ fontSize: 12, color: palette.muted }}>{job.stage}: {job.rider?.name} · {job.status} · {stamp(job.updatedAt)}</Txt>)}
        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          <Button title="View audit & details" onPress={() => router.push(`/admin/order?id=${order.id}` as Href)} />
          {['PickupQueued', 'PickupAssigned', 'PickupAccepted', 'PickupEnRoute', 'LaundryPickedUp', 'ReadyForDelivery', 'DeliveryAssigned', 'DeliveryAccepted', 'CleanLaundryCollected', 'OutForDelivery'].includes(order.workflowStatus) && <Button title="Assign / reassign rider" outline compact onPress={() => { setSelected(order); setRiderId(0); setReason(''); command.setError(''); }} />}
        </View>
      </Card>)}
      {!query.isLoading && !query.error && !visible.length && <Empty title="No orders in this queue" message="Bookings and deliveries will appear as their workflow progresses." />}
      <Card><Section title="Rider performance history" />{riders.map(rider => { const jobs = orders.flatMap(order => order.assignments).filter(job => job.riderId === rider.userId); return <View key={rider.userId}><Txt style={{ fontWeight: '600' }}>{rider.user.name}</Txt><Txt style={styles.muted}>{jobs.filter(job => job.status === 'Completed').length} completed · {jobs.filter(job => job.status === 'Declined').length} declined · {jobs.filter(job => job.status === 'Expired').length} expired · {jobs.filter(job => job.status === 'Reassigned').length} reassigned</Txt></View>; })}</Card>
    </View>
    <ActionModal visible={!!applicant} maxWidth={820} close={() => !command.busy && setApplicant(null)}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}><View style={{ flex: 1, minWidth: 0, gap: 5 }}><Txt style={{ fontSize: 11, color: palette.primary, letterSpacing: 1, fontWeight: '700' }}>RIDER APPLICATION</Txt><Txt accessibilityRole="header" style={{ fontSize: 22, lineHeight: 30, fontWeight: '700' }}>Review rider application</Txt><Txt style={{ fontSize: 12, lineHeight: 20, color: palette.muted }}>Check the applicant’s details and verify their documents before approving rider access.</Txt></View><IconButton label="Close rider review" onPress={() => !command.busy && setApplicant(null)}><X size={19} color={palette.muted} /></IconButton></View>
      <View style={{ padding: 16, borderRadius: 16, backgroundColor: palette.surface, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>{applicant && <RiderApplicantPhoto key={applicant.userId} userId={applicant.userId} />}<View style={{ flex: 1, minWidth: 0, gap: 4 }}><Txt style={{ color: palette.muted, fontSize: 11 }}>APPLICANT</Txt><Txt style={{ fontSize: 18, fontWeight: '600' }}>{applicant?.user.name}</Txt></View></View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}><View style={{ flexGrow: 1, flexBasis: 220, minWidth: 0, gap: 4 }}><Txt style={{ fontSize: 12, color: palette.muted }}>Email address</Txt><Txt selectable>{applicant?.user.email}</Txt></View><View style={{ flexGrow: 1, flexBasis: 160, minWidth: 0, gap: 4 }}><Txt style={{ fontSize: 12, color: palette.muted }}>Contact number</Txt><Txt selectable>{applicant?.user.phone || 'Not provided'}</Txt></View></View>
      </View>
      {applicant && <AdminRiderRequirements userId={applicant.userId} onReviewState={setCanApprove} onStatusChange={setReviewStatus} />}
      <Field label="Review note (required to reject)" value={reason} onChangeText={setReason} editable={reviewStatus === 'Pending' && !command.busy} multiline maxLength={1000} />
      {!!command.error && <Txt accessibilityRole="alert" style={{ color: palette.danger }}>{command.error}</Txt>}
      <Txt style={styles.muted}>{reviewStatus !== 'Pending' ? 'Review actions unlock once the rider submits. You can still preview their uploaded documents.' : canApprove ? 'All required documents are verified. You can approve rider access.' : 'Verify every required document above to enable approval.'}</Txt>
      <Button title="Approve rider" disabled={!canApprove} busy={command.busy} onPress={async () => { if (applicant && canApprove && await command.send(`/delivery/riders/${applicant.userId}/review`, { status: 'Approved', reason: reason.trim() || undefined })) setApplicant(null); }} />
      <Button title="Reject application" disabled={reviewStatus !== 'Pending'} outline color={palette.danger} busy={command.busy} onPress={async () => { if (applicant && reviewStatus === 'Pending' && await command.send(`/delivery/riders/${applicant.userId}/review`, { status: 'Rejected', reason: reason.trim() || undefined })) setApplicant(null); }} />
      <Button title="Cancel" disabled={command.busy} outline onPress={() => setApplicant(null)} />
    </ActionModal>
    <ActionModal visible={!!selected} close={() => !command.busy && setSelected(null)}><Txt style={styles.heading}>Manual assignment · Order #{selected?.id}</Txt><Txt style={styles.muted}>Use this when a job needs admin intervention. Choose an online rider; known distances are sorted nearest first, with workload used to break ties.</Txt>
      <State query={assignmentOptions} />
      {assignmentOptions.data && !assignmentOptions.error && <>
        <View style={{ backgroundColor: palette.soft, padding: 14, borderRadius: 12, gap: 6 }}><View style={[styles.row, { gap: 8 }]}><MapPin size={18} color={palette.primary} /><Txt style={{ color: palette.primary, fontWeight: '600' }}>{assignmentOptions.data.stage === 'Pickup' ? 'Customer pickup location' : 'Laundry shop collection location'}</Txt></View><Txt>{assignmentOptions.data.origin.name}</Txt><Txt style={{ fontSize: 12, lineHeight: 20, color: palette.muted }}>{assignmentOptions.data.origin.address}</Txt>
          {!assignmentOptions.data.origin.coordinatesAvailable && <Txt style={{ color: palette.warning, fontSize: 12, lineHeight: 20 }}>No saved map pin for this location. Distances are unavailable; riders are ordered by workload.</Txt>}
        </View>
        <Txt style={{ fontSize: 12, lineHeight: 20, color: palette.muted }}>Approximate straight-line distance from each rider’s saved position. This is not live tracking or road travel distance.</Txt>
        <View accessibilityRole="radiogroup" accessibilityLabel="Eligible riders" style={{ gap: 10 }}>
          {assignmentOptions.data.riders.map((rider, index) => {
            const distance = rider.distance == null ? assignmentOptions.data!.origin.coordinatesAvailable ? 'Position not provided' : 'Distance unavailable' : rider.distance < 0.1 ? 'Less than 0.1 km away' : `${rider.distance.toFixed(1)} km away`;
            return <Pressable key={rider.userId} testID={`dispatch-rider-option-${rider.userId}`} accessibilityRole="radio" accessibilityState={{ checked: riderId === rider.userId, disabled: command.busy }} accessibilityLabel={`${rider.name}, ${distance}, ${rider.workload} other active jobs`} disabled={command.busy} onPress={() => setRiderId(rider.userId)}
              style={{ borderWidth: riderId === rider.userId ? 2 : 1, borderColor: riderId === rider.userId ? palette.primary : palette.line, backgroundColor: riderId === rider.userId ? palette.soft : 'white', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 20, height: 20, borderWidth: 1.5, borderColor: riderId === rider.userId ? palette.primary : palette.muted, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>{riderId === rider.userId && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: palette.primary }} />}</View>
              <View style={{ flex: 1, minWidth: 0, gap: 5 }}><Txt style={{ fontWeight: '600' }}>{rider.name}</Txt><Txt style={{ color: rider.distance == null ? palette.muted : palette.primary, fontSize: 13 }}>{distance}{index === 0 && rider.distance != null ? ' · Nearest' : ''}</Txt><Txt style={{ color: palette.muted, fontSize: 12 }}>{rider.workload} other active {rider.workload === 1 ? 'job' : 'jobs'}</Txt></View>
            </Pressable>;
          })}
        </View>
        {!assignmentOptions.data.riders.length && <Empty title="No eligible riders online" message="Riders must be active, online, and have room for another assignment. Ask a rider to go online, then refresh." />}
        <Button title="Refresh eligible riders" compact outline busy={assignmentOptions.isFetching} onPress={() => { void assignmentOptions.refetch(); }} />
      </>}
      <Field label="Reassignment / physical handover reason" value={reason} onChangeText={setReason} multiline maxLength={1000} />
      <Txt style={styles.muted}>If laundry is already in transit, confirm its physical handover with both riders before reassigning.</Txt>
      {!!command.error && <Txt accessibilityRole="alert" style={{ color: palette.danger }}>{command.error}</Txt>}
      <Button title="Send assignment" disabled={!!assignmentOptions.error || assignmentOptions.isFetching || !assignmentOptions.data?.riders.some(rider => rider.userId === riderId)} busy={command.busy} onPress={assign} /><Button title="Cancel" disabled={command.busy} outline onPress={() => setSelected(null)} />
    </ActionModal>
  </Screen>;
}
