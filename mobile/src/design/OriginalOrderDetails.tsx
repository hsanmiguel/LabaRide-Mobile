import { useEffect, useState, type ReactNode } from "react";
import { View } from "react-native";
import { Package } from "lucide-react-native";
import { address, type Order } from "./data";
import { Button, Card, PriceRow, Screen, Section, Txt, money, styles, usePalette } from "./ui";
import { OrderStepIndicator } from "./OrderStepIndicator";
import { OrderDisclosure } from "./OrderDisclosure";
import { originalOrderDetailProgress, orderDetailSteps } from "./order-detail-steps";
import { ProcessingTimer, type ProcessingTimerActions } from "./ProcessingTimer";
import { orderUpdateText } from "./TurnaroundDetails";
import { DeliveryDetails } from "./AddressFields";

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
    <View style={styles.stack}>
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
      <Card testID="order-step-content" style={{ padding: 16, gap: 14 }}>
        <View style={{ gap: 4 }}>
          <Txt style={{ fontSize: 11, color: palette.muted }}>Step {viewedStep + 1} of 5{currentView && !progress.cancelled && !progress.complete ? " · Current step" : viewedStep > progress.current ? " · Not reached" : ""}</Txt>
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
            <Txt>{order.deliveryType === "Deliver" ? "Return delivery to the customer." : "Customer collection at the shop."}</Txt>
            {!!order.readyAt && <Txt style={styles.muted}>Laundry ready: {timestamp(order.readyAt)}</Txt>}
          </>}
          {viewedStep === 4 && !!order.completedAt && <Txt style={styles.muted}>Completed: {timestamp(order.completedAt)}</Txt>}
          {currentView && !progress.cancelled && primaryAction}
          {currentView && progress.complete && extraAction}
        </>}
        {!currentView && <Button title={progress.cancelled || progress.complete ? "View final recorded step" : "Back to current step"} compact outline onPress={() => setSelectedStep(null)} />}
      </Card>
      {!!estimateEditor && <View style={{ display: currentView ? "flex" : "none" }}><OrderDisclosure title="Ready time estimate">{estimateEditor}</OrderDisclosure></View>}
      <OrderDisclosure title="Order information">
        <Section title={partner ? "Customer Details" : "Your pickup & delivery"} />
        {partner && <PriceRow label="Customer ID" value={String(order.userId)} />}
        <Txt style={{ fontWeight: "600" }}>{order.userName}</Txt>
        {partner && !!order.userPhone && <Txt selectable>{order.userPhone}</Txt>}
        <Txt>{address(order)}</Txt><DeliveryDetails value={order} />
        {order.collectionMethod === "ShopPickup" && order.collectionAddress && <><Section title="Laundry collection address" /><Txt>{address(order.collectionAddress)}</Txt><DeliveryDetails value={order.collectionAddress} /></>}
        {!!order.shop?.shopName && <Txt style={{ fontWeight: "600" }}>{order.shop.shopName}</Txt>}
        {!!order.shop?.address && <Txt>{order.shop.address}</Txt>}
        {!!order.shop?.contactNumber && <Txt selectable>{order.shop.contactNumber}</Txt>}
        <Section title="Items" />
        {order.items?.length ? order.items.map(item => <PriceRow key={item.itemName} label={item.itemName} value={`×${item.quantity}`} />) : <Txt style={styles.muted}>No items listed</Txt>}
        {!!order.notes && <><Section title={progress.cancelled ? "Reason of cancellation" : "Notes"} /><Txt>{order.notes}</Txt></>}
      </OrderDisclosure>
      <OrderDisclosure title="Payment information">
        <PriceRow label="Payment method" value={order.paymentMethod} />
        <PriceRow label="Subtotal" value={money(order.subtotal)} /><PriceRow label="Delivery fee" value={money(order.deliveryFee)} />
        <PriceRow label="Voucher discount" value={`−${money(order.voucherDiscount)}`} /><PriceRow label="Order total" value={money(order.totalAmount)} total />
      </OrderDisclosure>
      <OrderDisclosure title="Order history">{milestones.map(item => <View key={item.label} style={{ borderLeftWidth: 2, borderLeftColor: palette.line, paddingLeft: 12, gap: 4 }}>
        <Txt style={{ fontWeight: "600" }}>{item.label}</Txt><Txt style={{ fontSize: 12, color: palette.muted }}>{timestamp(item.value)}</Txt>
      </View>)}</OrderDisclosure>
    </View>
  </Screen>;
}
