import { useEffect, useState, type ReactNode } from "react";
import { View } from "react-native";
import { Package } from "lucide-react-native";
import { address, type Order } from "./data";
import { Button, Card, PriceRow, Screen, Txt, money, styles, usePalette } from "./ui";
import { OrderStepIndicator } from "./OrderStepIndicator";
import { OrderActivity, OrderBentoCard, OrderBentoGrid, OrderFact } from './OrderBento';
import { returnDeliveryUpdate } from './return-delivery';
import { originalOrderDetailProgress, orderDetailSteps } from "./order-detail-steps";
import { ProcessingTimer, type ProcessingTimerActions } from "./ProcessingTimer";
import { orderUpdateText } from "./TurnaroundDetails";
import { DeliveryDetails } from "./AddressFields";
import { InvoiceButton } from './InvoiceButton';

const timestamp = (value: string) => new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " (PHT)";

export function OriginalOrderDetails({ order, partner = false, primaryAction, bookingFields, estimateEditor, confirmPickupAction, right, extraAction, timerActions }: {
  order: Order; partner?: boolean; primaryAction?: ReactNode; bookingFields?: ReactNode;
  estimateEditor?: ReactNode; confirmPickupAction?: ReactNode; right?: ReactNode; extraAction?: ReactNode;
  timerActions?: ProcessingTimerActions;
}) {
  const palette = usePalette();
  const progress = originalOrderDetailProgress(order);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  useEffect(() => { setSelectedStep(null); }, [order.id, order.status]);
  const viewedStep = selectedStep ?? progress.current;
  const currentView = viewedStep === progress.current;
  const milestones = [
    { label: "Order placed", value: order.createdAt },
    { label: "Laundry received", value: order.receivedAt },
    { label: "Processing started", value: order.processingStartedAt },
    { label: "Washing started", value: order.washingStartedAt },
    { label: "Drying started", value: order.dryingStartedAt },
    { label: "Laundry ready", value: order.readyAt },
    { label: "Order completed", value: order.completedAt },
    { label: "Order cancelled", value: order.cancelledAt },
  ].filter((item): item is { label: string; value: string } => !!item.value).sort((a, b) => Date.parse(b.value) - Date.parse(a.value));
  return <Screen title={`Order #${order.id}`} right={right}>
    <View style={{ gap: 12 }}>
      <Card style={{ padding: 16 }}>
        <View style={styles.between}>
          <View style={[styles.row, { flexShrink: 1 }]}><Package size={22} color={palette.primary} /><Txt style={styles.heading}>{order.serviceName}</Txt></View>
          <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: palette.soft }}><Txt style={{ fontSize: 12, fontWeight: "600", color: progress.cancelled ? palette.danger : palette.primary }}>{order.status}</Txt></View>
        </View>
        <View style={styles.between}>
          <View><Txt style={{ fontWeight: "600" }}>{partner ? order.userName : order.shop?.shopName || "Laundry shop"}</Txt><Txt style={{ fontSize: 12, color: palette.muted }}>{Number(order.kiloAmount)} kg{partner && order.shop?.shopName ? ` · ${order.shop.shopName}` : ""}</Txt></View>
          <Txt style={{ fontSize: 24, fontWeight: "700", color: palette.primary }}>{money(order.totalAmount)}</Txt>
        </View>
      </Card>
      <OrderStepIndicator {...progress} selected={viewedStep} onSelect={setSelectedStep} />
      {progress.cancelled && <Txt accessibilityRole="alert" style={{ color: palette.danger, fontWeight: "600" }}>Order cancelled. You can review the recorded steps below.</Txt>}
      <Card testID="order-step-content" style={{ padding: 20, gap: 12, borderRadius: 20 }}>
        <View style={{ gap: 4 }}>
          <Txt style={{ fontSize: 11, fontWeight: '600', letterSpacing: 0.6, color: palette.primary }}>Step {viewedStep + 1} of 5{currentView && !progress.cancelled && !progress.complete ? " · Current step" : viewedStep > progress.current ? " · Not reached" : ""}</Txt>
          <Txt accessibilityRole="header" style={{ fontSize: 21, fontWeight: "700" }}>{viewedStep === 1 ? "Laundry received" : viewedStep === 3 ? "Return & handover" : viewedStep === 4 ? "Order complete" : orderDetailSteps[viewedStep].title}</Txt>
          {!currentView && <Txt style={styles.muted}>{orderDetailSteps[viewedStep].description}</Txt>}
        </View>
        {viewedStep > progress.current ? <Txt style={styles.muted}>{progress.cancelled ? "This step was not reached before cancellation." : "This step becomes active when the earlier steps are confirmed."}</Txt> : <>
          {currentView && !progress.cancelled && <Txt style={{ color: palette.primary, fontWeight: "600" }}>{orderUpdateText(order)}</Txt>}
          {viewedStep === 0 && <>
            <Txt style={styles.muted}>Booked {timestamp(order.createdAt)}</Txt>
            {currentView && !progress.cancelled && bookingFields}
          </>}
          {viewedStep === 1 && <>
            <Txt>{order.collectionMethod === "ShopPickup" ? "Shop collects the laundry from the customer." : "Customer drops off the laundry at the shop."}</Txt>
            {!!order.requestedPickupAt && <Txt style={styles.muted}>Requested pickup: {timestamp(order.confirmedPickupAt || order.requestedPickupAt)}</Txt>}
            {!!order.receivedAt && <Txt style={styles.muted}>Received: {timestamp(order.receivedAt)}</Txt>}
            {currentView && !progress.cancelled && confirmPickupAction}
          </>}
          {viewedStep === 2 && <>
            <ProcessingTimer order={order} actions={partner && currentView && !progress.cancelled ? timerActions : undefined} />
            {!!order.processingStartedAt && <Txt style={styles.muted}>Processing started: {timestamp(order.processingStartedAt)}</Txt>}
          </>}
          {(viewedStep === 1 || viewedStep === 2) && !!order.estimatedReadyAt && <View style={{ gap: 4 }}>
            <Txt style={{ fontWeight: "600" }}>Estimated ready: {timestamp(order.estimatedReadyAt)}</Txt>
            {!!order.estimateReason && <Txt style={styles.muted}>{order.estimateReason}</Txt>}
          </View>}
          {viewedStep === 3 && <>
            <Txt>{returnDeliveryUpdate(order, partner)?.description || (order.deliveryType === "Deliver" ? "Return delivery to the customer." : "Customer collection at the shop.")}</Txt>
            {!!order.readyAt && <Txt style={styles.muted}>Laundry ready: {timestamp(order.readyAt)}</Txt>}
          </>}
          {viewedStep === 4 && !!order.completedAt && <Txt style={styles.muted}>Completed: {timestamp(order.completedAt)}</Txt>}
          {currentView && !progress.cancelled && primaryAction}
          {currentView && progress.complete && extraAction}
        </>}
        {!currentView && <Button title={progress.cancelled || progress.complete ? "View final recorded step" : "Back to current step"} compact outline onPress={() => setSelectedStep(null)} />}
      </Card>
      {!!estimateEditor && <View style={{ display: currentView ? "flex" : "none" }}><OrderBentoGrid><OrderBentoCard title="Ready time estimate" subtitle={order.estimatedReadyAt ? timestamp(order.estimatedReadyAt) : 'No ready time shared yet'} kind="history" expandable actionLabel="Edit ready time">{estimateEditor}</OrderBentoCard></OrderBentoGrid></View>}
      <OrderBentoGrid>
      <OrderBentoCard title="Order information" subtitle={partner ? "Customer Details" : "Your pickup & delivery"} kind="location" expandable actionLabel="View details">
        <OrderFact label={partner ? `Customer · #${order.userId}` : 'Customer'}>{order.userName}</OrderFact>
        {partner && !!order.userPhone && <OrderFact label="Contact">{order.userPhone}</OrderFact>}
        <OrderFact label="Pickup & delivery address">{address(order)}</OrderFact><DeliveryDetails value={order} />
        {order.collectionMethod === "ShopPickup" && order.collectionAddress && <><OrderFact label="Laundry collection address">{address(order.collectionAddress)}</OrderFact><DeliveryDetails value={order.collectionAddress} /></>}
        {!!order.shop?.shopName && <OrderFact label="Laundry shop">{order.shop.shopName}</OrderFact>}
        {!!order.shop?.address && <Txt style={{ fontSize: 13, color: palette.muted }}>{order.shop.address}</Txt>}
        {!!order.shop?.contactNumber && <OrderFact label="Shop contact">{order.shop.contactNumber}</OrderFact>}
      </OrderBentoCard>
      <OrderBentoCard title="Laundry details" subtitle={`${Number(order.kiloAmount)} kg · ${order.serviceName}`} expandable actionLabel="View details">
        <OrderFact label="Items">
        {order.items?.length ? order.items.map(item => <PriceRow key={item.itemName} label={item.itemName} value={`×${item.quantity}`} />) : <Txt style={styles.muted}>No items listed</Txt>}
        </OrderFact>
        {!!order.notes && <OrderFact label={progress.cancelled ? "Cancellation reason" : "Order notes"}>{order.notes}</OrderFact>}
      </OrderBentoCard>
      <OrderBentoCard title="Payment information" subtitle="Price breakdown & payment method" kind="payment" expandable actionLabel="View breakdown">
        <View style={{ borderRadius: 12, backgroundColor: palette.soft, padding: 14, gap: 3 }}><Txt style={{ fontSize: 11, fontWeight: '600', color: palette.muted }}>ORDER TOTAL</Txt><Txt style={{ fontSize: 26, fontWeight: '700', color: palette.primary }}>{money(order.totalAmount)}</Txt><Txt style={{ fontSize: 12, color: palette.primary }}>{order.paymentMethod}</Txt></View>
        <PriceRow label="Subtotal" value={money(order.subtotal)} /><PriceRow label="Delivery fee" value={money(order.deliveryFee)} />
        <PriceRow label="Voucher discount" value={`−${money(order.voucherDiscount)}`} />
        <InvoiceButton orderId={order.id} />
      </OrderBentoCard>
      <OrderBentoCard title="Order history" subtitle={`${milestones.length} milestones · Latest first`} kind="history" expandable actionLabel="View history"><OrderActivity count={3} total={milestones.length}>{milestones.map(item => <View key={item.label} style={{ borderLeftWidth: 2, borderLeftColor: palette.soft, paddingLeft: 12, gap: 3 }}>
        <Txt style={{ fontSize: 13, fontWeight: "600" }}>{item.label}</Txt><Txt style={{ fontSize: 11, color: palette.muted }}>{timestamp(item.value)}</Txt>
      </View>)}</OrderActivity></OrderBentoCard>
      </OrderBentoGrid>
    </View>
  </Screen>;
}
