import { DeliveryFeeSettings } from './DeliveryFeeSettings';
import { RiderHeader } from './RiderHeader';
import { HandoverPhotos } from './HandoverPhotos';
import { toast } from "./toast-service";
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Switch, View, useWindowDimensions } from 'react-native';
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
import { InvoiceButton } from './InvoiceButton';
import { RiderNavigationPanel } from './RiderNavigationPanel';

import type { TurnaroundOrder } from './TurnaroundDetails';
import { ProcessingTimer } from './ProcessingTimer';
import { OrderStepIndicator } from './OrderStepIndicator';
import { riderJobProgress } from './rider-job-steps';
import { OrderDisclosure } from './OrderDisclosure';
import { OrderActivity, OrderBentoCard, OrderBentoGrid, OrderFact } from './OrderBento';
import { orderDetailProgress, orderDetailSteps } from './order-detail-steps';
import { deliveryDay } from './delivery-slots';
import type { AddressData } from './address';
import PickerField from './PickerField';
import { timeInputValue } from './form-values';
import { DeclineOrderModal } from './DeclineOrderModal';
import { returnDeliveryUpdate } from './return-delivery';
import { AssignedRiderCard, type AssignedRider } from './AssignedRiderCard';

type Handoff = { kind: 'pickup' | 'collection' | 'delivery'; arrived: boolean; released: boolean };

type Job = AssignedRider & { earnings?: number | null; id: number; transactionId: number; stage: string; status: string; expiresAt: string; createdAt: string; updatedAt: string; order: { handoff?: Handoff; id: number; status: string; serviceName: string; kiloAmount: string; scheduledDate: string | null; scheduledTime: string | null; requestedPickupAt?: string | null; totalAmount?: string; paymentMethod?: string; customer: { name?: string; phone?: string; address: string; latitude?: number; longitude?: number; instructions?: string; notes?: string; accessCode?: string }; shop: { name: string; address: string; phone?: string; latitude?: number; longitude?: number } } };
type Rider = { userId: number; active: boolean; online: boolean; applicationStatus?: string; reviewReason?: string; canEnable?: boolean; approvalMissing?: string[]; workload: number; user: { name: string; email: string; phone?: string } };
type RiderOptions = { stage: 'Pickup' | 'Delivery'; workflowVersion: number; origin: { source: 'customer' | 'shop'; name: string; address: string; coordinatesAvailable: boolean }; riders: { userId: number; name: string; workload: number; distance: number | null }[] };
type Event = { id: number; action: string; toStatus: string; detail?: string; createdAt: string; actor: { name: string } };
type DeliveryOrder = TurnaroundOrder & { collectionMethod?: 'Dropoff' | 'ShopPickup'; collectionAddress?: AddressData | null; id: number; workflowStatus: string; workflowVersion: number; weightEvidence?: WeightEvidence[]; handoff?: Handoff; serviceName: string; kiloAmount: string; userName: string; userPhone?: string; scheduledDate: string | null; scheduledTime: string | null; createdAt: string; completedAt?: string | null; notes?: string; totalAmount: string; pickupCode?: string; collectionCode?: string; deliveryCode?: string; assignments: Job[]; events: Event[]; shop: { shopName: string }; address_line_1?: string; city?: string };
const label = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2');
const scheduledAt = (order: { scheduledDate: string | null; scheduledTime: string | null; requestedPickupAt?: string | null }) => order.requestedPickupAt ? new Date(order.requestedPickupAt) : order.scheduledDate && order.scheduledTime ? new Date(order.scheduledDate.slice(0, 10) + 'T' + order.scheduledTime.slice(11, 19) + 'Z') : new Date(NaN);
const scheduleLabel = (order: { scheduledDate: string | null; scheduledTime: string | null; requestedPickupAt?: string | null }) => !Number.isFinite(scheduledAt(order).getTime()) ? 'Not scheduled' : scheduledAt(order).toLocaleString([], { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const stamp = (value: string) => new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const stepStamp = (value: string) => new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' (PHT)';
const partnerActions: Record<string, { action: string; title: string }> = {
  BookingPending: { action: 'confirmBooking', title: 'Accept order' },
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
  async function send(path: string, body: unknown, notificationOrderId?: number) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true); setError('');
    try {
      await api.put(path, body, notificationOrderId);
      await Promise.all(['delivery', 'notifications', 'user-orders', 'shop-orders', 'shop-analytics', 'user'].map(key => cache.invalidateQueries({ queryKey: [key] })));
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
  const cache = useQueryClient();
  const user = useAuthStore(state => state.user);
  const query = useQuery({ queryKey: ['delivery', 'order', id, user?.id], queryFn: () => api.get<DeliveryOrder>(`/delivery/orders/${id}`), refetchInterval: 15000 });
  const command = useCommand();
  const [note, setNote] = useState('');

  const palette = usePalette();
  const order = query.data;
  const next = order && (partner ? partnerActions[order.workflowStatus] : !user?.isAdmin && order.workflowStatus === 'Delivered' ? { action: 'confirmReceipt', title: 'Confirm receipt' } : undefined);
  const [estimateDate, setEstimateDate] = useState('');
  const [estimateTime, setEstimateTime] = useState('');
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [issueNote, setIssueNote] = useState('');
  const [declining, setDeclining] = useState(false);
  const progress = orderDetailProgress(order?.workflowStatus || 'BookingPending', order?.events);
  const viewedStep = selectedStep ?? progress.current;
  const currentView = viewedStep === progress.current;
  const closed = !!order && ['Completed', 'Cancelled'].includes(order.workflowStatus);
  const returnUpdate = order ? returnDeliveryUpdate(order, partner) : null;
  const returnRider = order?.assignments.find(job => job.stage === 'Delivery' && job.status === 'Accepted');
  useEffect(() => { setSelectedStep(null); }, [id, order?.workflowStatus]);
  useEffect(() => { setNote(''); setIssueNote(''); command.setError(''); }, [id]);
  useEffect(() => {
    setEstimateDate(order?.estimatedReadyAt ? deliveryDay(order.estimatedReadyAt) : '');
    setEstimateTime(order?.estimatedReadyAt ? new Date(order.estimatedReadyAt).toLocaleTimeString('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }) : '');
  }, [id, order?.estimatedReadyAt]);
  async function saveWeight(kilos: number, note: string, imageBase64: string) {
    if (!order || !await confirmAction('Save measured weight?', 'The customer will see the scale photo, measured weight and recalculated price. Save this update?')) return false;
    const saved = await command.send(`/delivery/orders/${id}/weight`, { kilos, note, imageBase64, expectedVersion: order.workflowVersion });
    if (saved) {
      const updated = cache.getQueryData<DeliveryOrder>(['delivery', 'order', id, user?.id]);
      toast.success({ title: 'Weight saved', message: updated && Number(updated.kiloAmount) === kilos ? `New total: ${money(updated.totalAmount)}.` : undefined });
    }
    return saved;
  }
  async function action(name: string, explanation = note.trim()) {
    if (!order) return;
    command.setError('');
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
    if (await command.send(`/delivery/orders/${id}/action`, { action: name, expectedVersion: order.workflowVersion, note: explanation || undefined, estimatedReadyAt })) { setNote(''); setIssueNote(''); }
  }
  return <Screen title={`Order #${id}`} brandedHeader={!!user?.isAdmin}>
    <State query={query} />
    {order && <View style={{ gap: 12 }}>
      <Card style={{ padding: 16 }}>
        <View style={styles.between}><View style={[styles.row, { flexShrink: 1 }]}><Package size={22} color={palette.primary} /><Txt style={styles.heading}>{order.serviceName}</Txt></View><Badge value={order.workflowStatus === 'AtPartner' ? order.collectionMethod === 'Dropoff' ? 'Awaiting customer drop-off' : 'Awaiting shop receipt' : order.workflowStatus} /></View>
        <View style={styles.between}><View><Txt style={{ fontWeight: '600' }}>{order.userName}</Txt><Txt style={{ color: palette.muted, fontSize: 12 }}>{order.kiloAmount} kg · {order.shop.shopName}</Txt></View><Txt style={{ fontSize: 24, fontWeight: '700', color: palette.primary }}>{money(order.totalAmount)}</Txt></View>
      </Card>
      <Txt style={styles.muted}>{order.collectionMethod === 'ShopPickup' ? 'Dirty laundry: rider pickup' : 'Dirty laundry: customer drop-off'}{' | '}{order.deliveryType === 'Deliver' ? 'Clean laundry: rider delivery' : 'Clean laundry: customer collection'}</Txt>
      <OrderStepIndicator {...progress} selected={viewedStep} onSelect={setSelectedStep} />
      {progress.cancelled && <Txt accessibilityRole="alert" style={{ color: palette.danger, fontWeight: '600' }}>Order cancelled. You can review the recorded steps below.</Txt>}
      {!!command.error && <Txt accessibilityRole="alert" style={{ color: palette.danger }}>{command.error}</Txt>}
      <Card testID="order-step-content" style={{ padding: 20, gap: 12, borderRadius: 20 }}>
        <View style={{ gap: 4 }}>
          <Txt style={{ fontSize: 11, fontWeight: '600', letterSpacing: 0.6, color: palette.primary }}>Step {viewedStep + 1} of 5{currentView && !closed ? ' · Current step' : viewedStep > progress.current ? ' · Not reached' : ''}</Txt>
          <Txt accessibilityRole="header" style={{ fontSize: 21, fontWeight: '700' }}>{orderDetailSteps[viewedStep].title === 'Received' ? order.receivedAt || order.workflowStatus === 'LaundryReceived' || progress.current > 1 ? 'Laundry received by shop' : order.collectionMethod === 'ShopPickup' ? 'Laundry pickup & shop receipt' : 'Awaiting customer drop-off' : orderDetailSteps[viewedStep].title === 'Return' ? 'Return & handover' : orderDetailSteps[viewedStep].title === 'Complete' ? 'Order complete' : orderDetailSteps[viewedStep].title}</Txt>
          {!currentView && <Txt style={styles.muted}>{orderDetailSteps[viewedStep].description}</Txt>}
        </View>
        {viewedStep > progress.current ? <Txt style={styles.muted}>{progress.cancelled ? 'This step was not reached before cancellation.' : 'This step becomes active when the earlier steps are confirmed.'}</Txt> : <>
          {viewedStep === 0 && <Txt style={styles.muted}>Booked {stepStamp(order.createdAt)}</Txt>}
          {viewedStep === 1 && <>
            <Txt>{order.collectionMethod === 'ShopPickup' ? 'Rider collects the laundry from the customer.' : 'Customer drop-off selected. The customer brings the dirty laundry to the shop; no pickup rider is requested.'}</Txt>
            {!!order.requestedPickupAt && <Txt style={styles.muted}>Requested pickup: {stepStamp(order.confirmedPickupAt || order.requestedPickupAt)}</Txt>}
            {!!order.receivedAt && <Txt style={styles.muted}>Received: {stepStamp(order.receivedAt)}</Txt>}
            {order.workflowStatus === 'LaundryReceived' && <Txt style={styles.muted}>Laundry is in the queue. Start washing when it is ready to be processed.</Txt>}
            {order.workflowStatus === 'AtPartner' && order.collectionMethod === 'Dropoff' && <Txt style={styles.muted}>Confirm receipt after the laundry physically arrives at the shop.</Txt>}
          </>}
          {viewedStep === 2 && <>
            <ProcessingTimer order={order} />
            {!!order.processingStartedAt && <Txt style={styles.muted}>Processing started: {stepStamp(order.processingStartedAt)}</Txt>}
          </>}
          {(viewedStep === 1 || viewedStep === 2) && !!order.estimatedReadyAt && <View style={{ gap: 4 }}>
            <Txt style={{ fontWeight: '600' }}>Estimated ready: {stepStamp(order.estimatedReadyAt)}</Txt>
            {!!order.estimateReason && <Txt style={styles.muted}>{order.estimateReason}</Txt>}
          </View>}
          {viewedStep === 3 && <>
            {returnUpdate ? <><Txt style={{ fontWeight: '600', color: palette.primary }}>{returnUpdate.title}</Txt><Txt>{returnUpdate.description}</Txt></> : <Txt>{order.deliveryType === 'Deliver' ? 'Return delivery to the customer.' : 'Customer collection at the shop.'}</Txt>}
            {!!order.readyAt && <Txt style={styles.muted}>Laundry ready: {stepStamp(order.readyAt)}</Txt>}
            {order.deliveryType === 'Deliver' && returnRider && <AssignedRiderCard key={returnRider.riderId} assignment={returnRider} />}
          </>}
          {viewedStep === 4 && progress.complete && <>
            <Txt style={{ fontWeight: '600', color: palette.primary }}>Clean laundry received by the customer.</Txt>
            {!!order.completedAt && <Txt style={styles.muted}>Completed: {stepStamp(order.completedAt)}</Txt>}
          </>}
          {currentView && !closed && <>
            {next && <View style={{ flexDirection: 'row', gap: 10 }}>
              {partner && order.workflowStatus === 'BookingPending' && <Button title="Decline" outline color={palette.danger} disabled={command.busy} onPress={() => setDeclining(true)} style={{ flex: 1 }} />}
              <Button title={next.title} busy={command.busy} onPress={() => action(next.action)} style={{ flex: 1 }} />
            </View>}
            {(partner || next) && order.workflowStatus !== 'BookingPending' && <OrderDisclosure title="Add a note">
              <Field label="Notes / issue details" value={note} onChangeText={value => { setNote(value); command.setError(''); }} placeholder="Optional note for the next update" editable={!command.busy} multiline maxLength={1000} />
            </OrderDisclosure>}
          </>}

        </>}
        {!currentView && <Button title={closed ? 'View final recorded step' : 'Back to current step'} compact outline onPress={() => setSelectedStep(null)} />}
      </Card>
      {partner && ['LaundryReceived', 'Washing', 'Drying', 'Folding'].includes(order.workflowStatus) && <View style={{ display: currentView ? 'flex' : 'none' }}><OrderBentoGrid>
        <OrderBentoCard title="Ready time estimate" subtitle={order.estimatedReadyAt ? stepStamp(order.estimatedReadyAt) : 'No ready time shared yet'} kind="history" expandable actionLabel="Edit ready time">
          <PickerField label="Ready date" mode="date" value={estimateDate} onChange={setEstimateDate} />
          <PickerField label="Ready time" mode="time" value={estimateTime} onChange={setEstimateTime} />
          {!!order.estimatedReadyAt && <Field label="Estimate change reason" value={note} onChangeText={setNote} placeholder="Explain the revised ready time" editable={!command.busy} multiline maxLength={1000} />}
          <Button title={order.estimatedReadyAt ? 'Update ready estimate' : 'Send ready estimate'} outline busy={command.busy} onPress={() => action('updateEstimate')} />
        </OrderBentoCard>
        <OrderBentoCard title="Update weight & scale photo" subtitle={`${order.kiloAmount} kg recorded · Add scale evidence when reweighing`} expandable actionLabel="Update measurement"><WeightUpdateForm key={id} kilos={order.kiloAmount} busy={command.busy} save={saveWeight} /></OrderBentoCard>
      </OrderBentoGrid></View>}
      {currentView && !user?.isAdmin && (viewedStep === 1 && order.collectionMethod === 'ShopPickup' || viewedStep === 3 && order.deliveryType === 'Deliver') && !closed && <CustomerRiderTracking orderId={id} orderStatus={order.workflowStatus} viewer={partner ? 'shop' : 'customer'} />}
      {(viewedStep === 1 || viewedStep === 3) && order.assignments.some(job => job.stage === (viewedStep === 1 ? 'Pickup' : 'Delivery')) && <OrderDisclosure title="Rider assignments">
        {order.assignments.filter(job => job.stage === (viewedStep === 1 ? 'Pickup' : 'Delivery')).map(job => <View key={job.id} style={{ gap: 4 }}><Txt style={{ fontWeight: '600' }}>{job.rider?.name || 'Assigned rider'}</Txt><Txt style={styles.muted}>{job.status} · {stepStamp(job.updatedAt)}</Txt></View>)}
      </OrderDisclosure>}
      <OrderBentoGrid>
      <OrderBentoCard title="Order information" subtitle={partner ? 'Customer & collection' : 'Your pickup & delivery'} kind="location">
        <OrderFact label="Customer">{order.userName}</OrderFact>
        <OrderFact label="Pickup & delivery address">{address(order)}</OrderFact>
        {order.collectionMethod === 'ShopPickup' && order.collectionAddress && <OrderFact label="Laundry collection address">{address(order.collectionAddress)}</OrderFact>}
        {partner && !!order.userPhone && <OrderFact label="Contact">{order.userPhone}</OrderFact>}
        <OrderFact label="Laundry shop">{order.shop.shopName}</OrderFact>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <View style={{ backgroundColor: palette.soft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}><Txt style={{ fontSize: 12, color: palette.primary }}>{order.collectionMethod === 'ShopPickup' ? 'Rider pickup' : 'Customer drop-off'}</Txt></View>
          <View style={{ backgroundColor: palette.soft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}><Txt style={{ fontSize: 12, color: palette.primary }}>{order.deliveryType === 'Deliver' ? 'Return delivery' : 'Shop collection'}</Txt></View>
        </View>
        {!!order.notes && <OrderFact label="Order notes">{order.notes}</OrderFact>}
      </OrderBentoCard>
      <OrderBentoCard title="Order total" subtitle="Current amount & invoice" kind="payment">
        <View style={{ padding: 16, borderRadius: 12, backgroundColor: palette.soft, gap: 4 }}>
          <Txt style={{ fontSize: 28, fontWeight: '700', color: palette.primary }}>{money(order.totalAmount)}</Txt>
          <Txt style={{ fontSize: 12, color: palette.primary }}>{order.kiloAmount} kg · {order.serviceName}</Txt>
        </View>
        <Txt style={{ fontSize: 12, color: palette.muted }}>View the invoice for the price breakdown and payment method.</Txt>
        <InvoiceButton orderId={order.id} />
      </OrderBentoCard>
      {!!order.weightEvidence?.length && <OrderBentoCard title="Measured weight & scale photos" subtitle="Recorded measurements & supporting evidence"><WeightEvidenceCard orderId={id} evidence={order.weightEvidence} /></OrderBentoCard>}
      <OrderBentoCard title="Laundry handover photos" subtitle="Photos from the assigned rider"><HandoverPhotos orderId={id} /></OrderBentoCard>
      <OrderBentoCard title="Order history" subtitle={`${order.events.length} recorded updates · Latest first`} kind="history">
        {order.events.length ? <OrderActivity count={3} total={order.events.length}>{[...order.events].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map(event => <View key={event.id} style={{ borderLeftWidth: 2, borderLeftColor: palette.soft, paddingLeft: 12, gap: 3 }}>
          <Txt style={{ fontSize: 13, fontWeight: '600' }}>{label(event.toStatus)}</Txt>{!!event.detail && <Txt style={{ fontSize: 13, color: palette.muted }}>{event.detail}</Txt>}<Txt style={{ color: palette.muted, fontSize: 11 }}>{event.actor.name} · {stepStamp(event.createdAt)}</Txt>
        </View>)}</OrderActivity> : <Txt style={styles.muted}>No updates recorded yet.</Txt>}
      </OrderBentoCard>
      {!closed && (partner || user?.isAdmin || order.workflowStatus === 'BookingPending') && <OrderBentoCard title="Cancellation & issues" subtitle="Report a problem or manage this booking" kind="issues" expandable>
        <Field label="Reason or issue details" value={issueNote} onChangeText={value => { setIssueNote(value); command.setError(''); }} placeholder="Explain the cancellation or issue" editable={!command.busy} multiline maxLength={1000} />
        {(partner || user?.isAdmin || order.workflowStatus === 'BookingPending') && !(partner && order.workflowStatus === 'BookingPending') && <Button title="Cancel booking" outline color={palette.danger} busy={command.busy} onPress={() => action('cancel', issueNote.trim())} />}
        {(partner || user?.isAdmin) && <Button title="Report delivery issue" outline busy={command.busy} onPress={() => action('issue', issueNote.trim())} />}
        {user?.isAdmin && <Button title="Resolve reported issue" outline busy={command.busy} onPress={() => action('resolveIssue', issueNote.trim())} />}
      </OrderBentoCard>}
      </OrderBentoGrid>
    </View>}
    {declining && order && <DeclineOrderModal id={id} onClose={() => setDeclining(false)} onDecline={async reason => {
      const saved = await command.send(`/delivery/orders/${id}/action`, { action: 'cancel', expectedVersion: order.workflowVersion, note: reason });
      if (!saved) throw new Error('Unable to decline the order. Please try again.');
      toast.success({ title: 'Order declined' });
    }} />}
  </Screen>;
}

function JobFact({ title, value }: { title: string; value: string }) {
  const palette = usePalette();
  return <View style={{ flexGrow: 1, flexBasis: 150, gap: 4 }}><Txt style={{ fontSize: 12, color: palette.muted }}>{title}</Txt><Txt style={{ fontWeight: '600' }}>{value}</Txt></View>;
}

function RiderJobSummary({ job }: { job: Job }) {
  const palette = usePalette();
  const progress = riderJobProgress(job);
  const stops = job.stage === 'Pickup' ? [job.order.customer, job.order.shop] : [job.order.shop, job.order.customer];
  return <Card style={{ flex: 1, gap: 14, borderTopWidth: 4, borderTopColor: job.stage === 'Pickup' ? palette.primary : '#7c3aed' }}>
    <View style={[styles.between, { flexWrap: 'wrap', gap: 8 }]}><Txt style={{ color: palette.primary, fontWeight: '700' }}>{job.stage} · #{job.transactionId}</Txt><Badge value={job.status} /></View>
    <View style={{ gap: 5 }}><Txt style={styles.heading}>{job.order.shop.name}</Txt><Txt style={styles.muted}>{job.order.serviceName} · {job.order.kiloAmount} kg</Txt></View>
    <View style={{ gap: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.line, paddingVertical: 12 }}>
      {stops.map((stop, index) => <View key={index} style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start' }}><MapPin size={17} color={index ? '#7c3aed' : palette.primary} /><View style={{ flex: 1, gap: 3 }}><Txt style={{ fontSize: 11, color: palette.muted }}>{index ? 'TAKE TO' : 'COLLECT FROM'}</Txt>{!!stop.name && <Txt style={{ fontWeight: '600' }}>{stop.name}</Txt>}<Txt numberOfLines={2} style={{ fontSize: 12, color: palette.muted }}>{stop.address || 'Address not provided'}</Txt></View></View>)}
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}><JobFact title="Schedule" value={scheduleLabel(job.order)} /><JobFact title="Your trip earnings" value={job.earnings == null ? "Not recorded for this older job" : money(job.earnings)} /><JobFact title="Order total" value={job.order.totalAmount != null ? money(job.order.totalAmount) : (job.status === 'Offered' ? 'Available after acceptance' : 'Not available')} /></View>
    <View style={{ padding: 12, backgroundColor: palette.soft, borderRadius: 12, gap: 5 }}><Txt style={{ color: palette.primary, fontWeight: '700', fontSize: 12 }}>{label(job.status)}</Txt><Txt style={{ fontSize: 12, color: palette.muted }}>{progress.detail}</Txt></View>
    <View style={styles.between}><Txt style={{ color: palette.primary, fontWeight: '700' }}>View order details</Txt><Navigation size={17} color={palette.primary} /></View>
  </Card>;
}

export function RiderDashboardDesign({ history = false, orderId }: { history?: boolean; orderId?: number }) {
  const user = useAuthStore(state => state.user);
  const query = useQuery({ queryKey: ['delivery', 'rider', user?.id], queryFn: () => api.get<{ rider: { online: boolean }; jobs: Job[] }>('/delivery/rider'), refetchInterval: 15000 });
  const command = useCommand();
  const logout = useLogout();
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState('All');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [decision, setDecision] = useState<{ job: Job; action: string; title: string; response?: boolean } | null>(null);
  const [note, setNote] = useState('');
  const jobs = query.data?.jobs || [];
  const selectedJob = jobs.find(job => job.id === selectedId);
  const completionPhotos = useQuery({ queryKey: ['delivery', 'handover-photos', selectedJob?.transactionId],
    enabled: selectedJob?.status === 'Accepted',
    queryFn: () => api.get<{ assignmentId: number; kind: string }[]>(`/delivery/orders/${selectedJob!.transactionId}/handover-photos`), refetchInterval: 30000 });
  const hasCompletionPhoto = !!selectedJob && !completionPhotos.isError && !!completionPhotos.data?.some(photo =>
    photo.assignmentId === selectedJob.id && photo.kind === (selectedJob.stage === 'Pickup' ? 'ShopDropoff' : 'CustomerDelivery'));
  const [navigationStop, setNavigationStop] = useState<number | null>(null);
  const linkedJobId = orderId ? jobs.find(job => job.transactionId === orderId && ['Accepted', 'Offered'].includes(job.status))?.id : undefined;
  useEffect(() => { if (linkedJobId) setSelectedId(linkedJobId); }, [linkedJobId]);
  useEffect(() => { setNavigationStop(null); }, [selectedId, selectedJob?.status]);
  const active = jobs.filter(job => ['Offered', 'Accepted'].includes(job.status));
  const today = new Date().toDateString();
  const completedToday = jobs.filter(job => job.status === 'Completed' && new Date(job.updatedAt).toDateString() === today);
  const shown = orderId ? jobs.filter(job => job.transactionId === orderId)
    : (history ? jobs.filter(job => !['Offered', 'Accepted'].includes(job.status)) : active).filter(job => filter === 'All' || job.stage === filter);
  function choose(job: Job, action: string, title: string, response = false) { command.setError(''); setNote(''); setDecision({ job, action, title, response }); }
  async function submit() {
    if (!decision) return;
    const { job } = decision;
    if (decision.action === 'completeTrip' && (!hasCompletionPhoto || completionPhotos.isFetching || selectedJob?.id !== job.id)) {
      command.setError('Save the destination handover photo before completing this trip.'); return;
    }
    let success;
    if (decision.response) success = await command.send(`/delivery/assignments/${job.id}/respond`, { action: decision.action, reason: note.trim() || undefined }, job.transactionId);
    else {
      // Fetch a fresh version; the server also checks the assigned rider and exact current stage.
      success = await command.send(`/delivery/orders/${job.transactionId}/action`, { action: decision.action, expectedVersion: (job.order as Job['order'] & { version?: number }).version, note: note.trim() || undefined });
    }
    if (success) {
      setDecision(null);
      if (decision.response) {
        if (decision.action === 'decline') toast.info({ title: 'Job declined' });
        else toast.success({ title: 'Job accepted' });
      } else {
        const states: Record<string, string> = { completeTrip: 'Trip completed; recipient confirmation pending', enRoute: 'Pickup en route', pickedUp: 'Laundry picked up', droppedOff: 'At partner',
          collected: 'Clean laundry collected', outForDelivery: 'Out for delivery', delivered: 'Delivered',
          arriveHandoff: 'Arrival recorded', releaseHandoff: 'Handover confirmed', failedPickup: 'Pickup queued', issue: 'Issue reported' };
        const received = job.order.handoff?.kind === 'pickup' ? 'Laundry picked up' : job.order.handoff?.kind === 'collection' ? 'Clean laundry collected' : 'Completed';
        toast.success({ title: 'Status updated', message: `${decision.action === 'receiveHandoff' ? received : states[decision.action] || label(job.order.status)}.` });
      }
    }
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
  function closeDetails() {
    if (command.busy) return;
    setSelectedId(null); setDecision(null);
  }
  const confirmation = <View testID="rider-action-confirmation" style={{ gap: 12 }}>
      <Txt style={styles.heading}>{decision?.title}</Txt><Txt style={styles.muted}>Order #{decision?.job.transactionId}</Txt>
      {(decision?.action === 'decline' || decision?.action === 'issue' || decision?.action === 'failedPickup') && <Field label="Reason (required)" value={note} onChangeText={setNote} multiline maxLength={1000} />}
      <Txt style={styles.muted}>{decision?.action === 'completeTrip' ? decision.job.stage === 'Pickup' ? 'Confirm only after handing the laundry to the shop. The shop will separately confirm receipt.' : 'Confirm only after handing the laundry to the customer. The customer will separately confirm receipt.' : 'Confirm this update. Everyone involved will be notified.'}</Txt>
      {!!command.error && <Txt accessibilityRole="alert" style={{ color: palette.danger }}>{command.error}</Txt>}
      <Button title="Confirm" busy={command.busy} disabled={decision?.action === 'completeTrip' && (!hasCompletionPhoto || completionPhotos.isFetching)} onPress={submit} /><Button title="Cancel" outline disabled={command.busy} onPress={() => setDecision(null)} />
  </View>;
  return <Screen header={<RiderHeader />} back={false}>
    <View style={styles.stack}>
      <View><Txt style={styles.title}>{history ? 'Your delivery record' : 'My deliveries'}</Txt><Txt style={styles.muted}>{history ? 'Completed trips and assignment outcomes.' : 'Accept a trip, collect the laundry, and take it to its destination.'}</Txt></View>
      <State query={query} />
      {!history && <RiderLocationSharingControl />}
      {!history && query.data && <>
        <Card><View style={styles.between}><View style={styles.row}><Bike size={26} color={palette.primary} /><View><Txt style={styles.heading}>{query.data.rider.online ? 'You are online' : 'You are offline'}</Txt><Txt style={styles.muted}>{query.data.rider.online ? 'Available for jobs and admin offers' : 'Active jobs stay available below'}</Txt></View></View>
          <Switch accessibilityLabel="Rider availability" value={query.data.rider.online} disabled={command.busy} onValueChange={async online => { if (await command.send('/delivery/availability', { online })) { if (online) toast.success({ title: "You're online", message: 'You can now receive pickup and delivery jobs.' }); else toast.info({ title: "You're offline", message: "You won't get new jobs." }); } }} trackColor={{ true: palette.primary }} /></View>
          <Button title="Update dispatch position" outline compact style={Platform.OS === 'web' ? { alignSelf: 'flex-start' } : undefined} onPress={locate} busy={command.busy} />
        </Card>
        <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>{[['Assigned today', jobs.filter(job => new Date(job.createdAt).toDateString() === today).length], ['Active jobs', active.length], ['Completed today', completedToday.length]].map(([title, count]) => <Card key={title} style={{ flexGrow: 1, flexBasis: 90 }}><Txt style={{ color: palette.muted, fontSize: 12 }}>{title}</Txt><Txt style={styles.title}>{count}</Txt></Card>)}</View>
      </>}
      {!!command.error && !decision && <Txt accessibilityRole="alert" style={{ color: palette.danger }}>{command.error}</Txt>}
      {orderId ? <Section title={'Order #' + orderId} action="Show all jobs" onPress={() => router.replace('/rider/jobs')} /> : <TabsRow items={['All', 'Pickup', 'Delivery']} value={filter} onChange={setFilter} />}
      <View style={{ gap: 5 }}><Txt style={styles.heading}>{history ? 'Past assignments' : 'My deliveries'} ({shown.length})</Txt><Txt style={styles.muted}>Select an order card for full details, trip progress, maps and handover photos.</Txt></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: 16 }}>
        {shown.map(job => <Pressable key={job.id} testID={`rider-job-card-${job.id}`} accessibilityRole="button" accessibilityLabel={`View ${job.stage.toLowerCase()} order #${job.transactionId} details`} onPress={() => { command.setError(''); setSelectedId(job.id); }} style={({ pressed }) => ({ width: width >= 900 ? '48.8%' : '100%', opacity: pressed ? 0.8 : 1 })}>
          <RiderJobSummary job={job} />
        </Pressable>)}
      </View>
      {!query.isLoading && !query.error && !shown.length && <Empty title={history ? 'No past jobs yet' : 'No active deliveries yet'} message={history ? 'Your job outcomes will appear here.' : 'Go online and accept a pickup or delivery from Order requests.'} action={history ? undefined : 'Browse order requests'} onPress={history ? undefined : () => router.push('/rider/available')} />}
    </View>
    <ActionModal visible={selectedId !== null && !decision} maxWidth={900} contentKey={navigationStop === null ? 'details' : 'route-' + navigationStop} close={closeDetails}>
      <View style={styles.between}><Txt accessibilityRole="header" style={styles.title}>Order details</Txt><IconButton label="Close order details" onPress={closeDetails}><X size={22} color={palette.ink} /></IconButton></View>
      {selectedJob ? (() => {
        const job = selectedJob;
        const stops = job.stage === 'Pickup' ? [job.order.customer, job.order.shop] : [job.order.shop, job.order.customer];
        return navigationStop !== null && job.status === 'Accepted' ? <RiderNavigationPanel key={job.id + ':' + navigationStop} stop={stops[navigationStop]} destinationKind={(job.stage === 'Pickup' ? navigationStop === 0 : navigationStop === 1) ? 'customer' : 'shop'} onBack={() => setNavigationStop(null)} /> : <View style={{ gap: 16 }}>
            <View style={[styles.between, { flexWrap: 'wrap', gap: 10 }]}><Txt style={styles.heading}>{job.stage} · Order #{job.transactionId}</Txt><Badge value={job.status === 'Accepted' ? job.order.status : job.status} /></View>
            <Txt style={styles.muted}>{job.order.shop.name} · {job.order.serviceName} · {job.order.kiloAmount} kg</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, padding: 16, borderRadius: 14, backgroundColor: palette.soft }}>
              <JobFact title="Your trip earnings" value={job.earnings == null ? "Not recorded for this older job" : money(job.earnings)} /><JobFact title="Schedule" value={scheduleLabel(job.order)} /><JobFact title="Order total" value={job.order.totalAmount != null ? money(job.order.totalAmount) : (job.status === 'Offered' ? 'Available after acceptance' : 'Not available')} />
              <JobFact title="Payment method" value={job.order.paymentMethod || (job.status === 'Accepted' ? 'Not provided' : (job.status === 'Offered' ? 'Available after acceptance' : 'Not available'))} /><JobFact title="Assignment" value={label(job.status)} />
              <JobFact title="Assigned" value={stepStamp(job.createdAt)} /><JobFact title="Last updated" value={stepStamp(job.updatedAt)} />
            </View>
            {['Accepted', 'Completed'].includes(job.status) && <InvoiceButton orderId={job.transactionId} />}
            {['Accepted', 'Completed'].includes(job.status) && <HandoverPhotos key={job.id} orderId={job.transactionId} assignmentId={job.id} stage={job.stage} canUpload={job.status === 'Accepted'} />}
            {job.status === 'Accepted' && <View style={{ gap: 10 }}>
              <Txt style={styles.muted}>{job.stage === 'Pickup' ? 'Collect the dirty laundry from the customer and hand it over at the shop. Confirm only after the entire trip is finished.' : 'Collect the clean laundry from the shop and hand it over to the customer. Confirm only after the entire trip is finished.'}</Txt>
              {!hasCompletionPhoto && <Txt accessibilityLiveRegion="polite" style={styles.muted}>Save a proof photo of handover to the {job.stage === 'Pickup' ? 'shop' : 'customer'} to enable completion.</Txt>}
              <Button title="Confirm completed" disabled={!hasCompletionPhoto || completionPhotos.isFetching} busy={command.busy} onPress={() => choose(job, 'completeTrip', 'Confirm trip completed')} />
            </View>}
            <Txt style={styles.heading}>Pickup & destination</Txt>
            {stops.map((stop, index) => <View key={index} style={{ borderLeftWidth: 2, borderLeftColor: palette.line, paddingLeft: 12, gap: 6 }}><Txt style={{ fontSize: 12, color: palette.muted }}>{index === 0 ? 'COLLECT FROM' : 'TAKE TO'}</Txt>{!!stop.name && <Txt style={{ fontWeight: '600' }}>{stop.name}</Txt>}<Txt>{stop.address || 'Address not provided'}</Txt>{!!stop.phone && <Txt selectable>Contact: {stop.phone}</Txt>}
              {job.status === 'Accepted' && <View style={[styles.row, { flexWrap: 'wrap' }]}><Button title="Navigate" compact outline icon={<Navigation size={15} color={palette.primary} />} onPress={() => setNavigationStop(index)} />{!!stop.phone && <CallContactButton name={stop.name} phone={stop.phone} />}</View>}
            </View>)}
            {job.status === 'Offered' && <><Txt style={{ color: palette.muted, fontSize: 12 }}>Offer expires {stamp(job.expiresAt)}. Contact details unlock after acceptance.</Txt><View style={[styles.row, { flexWrap: 'wrap' }]}><Button title="Accept job" onPress={() => choose(job, 'accept', 'Accept assignment', true)} /><Button title="Decline" outline color={palette.danger} onPress={() => choose(job, 'decline', 'Decline assignment', true)} /></View></>}
            {job.status === 'Accepted' && <><Txt style={styles.heading}>Instructions & actions</Txt>{!job.order.customer.instructions && !job.order.customer.notes && !job.order.customer.accessCode && <Txt style={styles.muted}>No special instructions provided.</Txt>}{!!job.order.customer.instructions && <Txt>Instructions: {job.order.customer.instructions}</Txt>}{!!job.order.customer.notes && <Txt>Order notes: {job.order.customer.notes}</Txt>}{!!job.order.customer.accessCode && <Txt>Access: {job.order.customer.accessCode}</Txt>}{job.stage === 'Pickup' && ['PickupAccepted', 'PickupEnRoute'].includes(job.order.status) && <Button title="Pickup unsuccessful" outline color={palette.danger} onPress={() => choose(job, 'failedPickup', 'Report failed pickup')} />}<Button title="Report an issue" outline color={palette.danger} onPress={() => choose(job, 'issue', 'Report delivery issue')} /></>}
            {job.status === 'Accepted' && <CustomerRiderTracking orderId={job.transactionId} orderStatus={job.order.status} viewer="rider" />}
            {job.status !== 'Accepted' && <Txt style={styles.muted}>Customer contact details and handover actions are available only during an accepted assignment.</Txt>}

        </View>;
      })() : <Empty title="Assignment unavailable" message="This assignment is no longer available. Close this window and refresh your jobs." />}
      {!!command.error && <Txt accessibilityRole="alert" style={{ color: palette.danger }}>{command.error}</Txt>}
      <Button title="Back to jobs" outline onPress={() => setSelectedId(null)} />
    </ActionModal>
    <ActionModal visible={!!decision} close={() => !command.busy && setDecision(null)}>
      {confirmation}
    </ActionModal>
  </Screen>;
}

function ActionModal({ visible, close, children, maxWidth = 520, contentKey }: { visible: boolean; close: () => void; children: React.ReactNode; maxWidth?: number; contentKey?: string }) {
  const { width } = useWindowDimensions();
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={close}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: '#00000066' }}><ScrollView key={contentKey} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: width < 480 ? 12 : 24, justifyContent: 'center' }}><Card style={{ width: '100%', maxWidth, padding: width < 480 ? 18 : 28, borderRadius: 22, alignSelf: 'center' }}>{children}</Card></ScrollView></KeyboardAvoidingView></Modal>;
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
    if (await command.send(`/delivery/orders/${selected.id}/assign`, { riderId, stage: assignmentOptions.data.stage, expectedVersion: assignmentOptions.data.workflowVersion, reason: reason.trim() || undefined })) { setSelected(null); toast.success({ title: 'Rider assigned' }); }
  }
  return <Screen title="Delivery Operations" brandedHeader back={false}>
    <View style={styles.stack}>
      <View style={styles.between}>
        <View style={{ flex: 1, minWidth: 180, gap: 4 }}><Txt style={styles.title}>Delivery Operations</Txt><Txt style={styles.muted}>Monitor deliveries, review riders, and resolve issues. Riders claim order requests themselves.</Txt></View>
        <Button title="Sign Out" outline onPress={logout} />
      </View>
      <State query={query} />
      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>{[['Pending bookings', orders.filter(order => order.workflowStatus === 'BookingPending').length], ['Unassigned jobs', orders.filter(unassigned).length], ['Riders online', roster.filter(rider => rider.active && rider.online).length], ['Riders offline', roster.filter(rider => rider.active && !rider.online).length], ['Delayed orders', orders.filter(delayed).length]].map(([title, count]) => <Card key={title} style={{ flexGrow: 1, flexBasis: 120 }}><Txt style={{ fontSize: 12, color: palette.muted }}>{title}</Txt><Txt style={styles.title}>{count}</Txt></Card>)}</View>
      <DeliveryFeeSettings />
      <Card><Section title="Rider applications" /><Txt style={styles.muted}>People apply using “Apply as a Rider” on the login page. Review their details here to approve rider access.</Txt>
        {applications.map(rider => <View key={rider.userId} testID={`rider-application-${rider.userId}`} style={{ borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 16, gap: 8 }}><Txt style={styles.heading}>{rider.user.name}</Txt><Badge value={rider.applicationStatus === 'Draft' ? 'Draft · not submitted' : rider.applicationStatus === 'Rejected' ? 'Needs correction' : 'Pending document review'} /><Txt selectable>{rider.user.email}</Txt><Txt selectable>{rider.user.phone}</Txt><Txt style={styles.muted}>{rider.applicationStatus === 'Draft' ? 'The applicant must finish their requirements and submit before approval.' : rider.applicationStatus === 'Rejected' ? 'The applicant must correct the feedback and resubmit.' : 'Open the application and verify each required document before approving.'}</Txt><Button title={rider.applicationStatus === 'Pending' ? 'Review application' : 'View requirements'} outline onPress={() => reviewApplication(rider)} /></View>)}
        {!applications.length && <Txt style={styles.muted}>No rider applications waiting for review.</Txt>}
      </Card>
      <Card><Section title="Rider roster" />
        {roster.map(rider => <View key={rider.userId} testID={`rider-roster-${rider.userId}`} style={[styles.between, { borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 12 }]}><View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 140, minWidth: 140 }}><Txt style={{ fontWeight: '600' }}>{rider.user.name}</Txt><Txt style={styles.muted}>{rider.active ? rider.online ? 'Online' : 'Offline' : 'Disabled'} · {rider.workload} active jobs</Txt><Txt style={{ fontSize: 12, color: palette.muted }}>{rider.user.email}</Txt>{!rider.active && rider.canEnable === false && <Txt style={{ fontSize: 12, color: palette.warning }}>Requirements need updating or document verification before access can be restored.</Txt>}</View>{!rider.active && rider.canEnable === false ? <Button title="View requirements" compact outline onPress={() => reviewApplication(rider)} /> : <Button title={rider.active ? 'Disable' : 'Enable'} compact outline busy={command.busy} onPress={async () => { if (await confirmAction('Rider account', `${rider.active ? 'Disable' : 'Enable'} this rider account?`) && await command.send('/delivery/riders', { email: rider.user.email, active: !rider.active })) { const options = { title: rider.active ? 'Rider disabled' : 'Rider enabled', message: `${rider.user.name}.` }; if (rider.active) toast.warning(options); else toast.success(options); } }} />}</View>)}
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
      <Button title="Approve rider" disabled={!canApprove} busy={command.busy} onPress={async () => { if (applicant && canApprove && await command.send(`/delivery/riders/${applicant.userId}/review`, { status: 'Approved', reason: reason.trim() || undefined })) { toast.success({ title: 'Rider approved', message: `${applicant.user.name} can start taking jobs.` }); setApplicant(null); } }} />
      <Button title="Reject application" disabled={reviewStatus !== 'Pending'} outline color={palette.danger} busy={command.busy} onPress={async () => { if (applicant && reviewStatus === 'Pending' && await command.send(`/delivery/riders/${applicant.userId}/review`, { status: 'Rejected', reason: reason.trim() || undefined })) { toast.warning({ title: 'Rider rejected', message: `${applicant.user.name}'s application was declined.` }); setApplicant(null); } }} />
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
