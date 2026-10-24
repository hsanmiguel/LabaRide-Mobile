import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, View, useWindowDimensions } from "react-native";
import { ArrowRight, Check, CheckCircle2, Clock3, LockKeyhole, MapPin, Phone, RefreshCw, ShoppingBag, Store, TriangleAlert, type LucideIcon } from "lucide-react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import { address, api, message, useProfile, type Shop } from "./data";
import { Button, Card, Empty, Field, Screen, SearchBox, TabsRow, Txt, styles, usePalette } from "./ui";
import { FormError } from "./AddressFields";
import { QueryState } from "./UserScreens";
import { useLogout } from "./useLogout";

type Status = Shop["approvalStatus"];
const statuses: Status[] = ["Pending", "Approved", "Rejected", "Suspended"];
const labels: Record<Status, string> = { Pending: "Pending Approval", Approved: "Approved", Rejected: "Rejected", Suspended: "Suspended" };

export function ApprovalBadge({ status }: { status: Status }) {
  const palette = usePalette();
  const color = status === "Approved" ? palette.success : status === "Pending" ? palette.warning : palette.danger;
  return <View style={{ alignSelf: "flex-start", backgroundColor: `${color}12`, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
    <Txt style={{ color, fontWeight: "600" }}>{labels[status]}</Txt>
  </View>;
}

export function ShopApplicationStatus({ shop, onRefresh, onEdit, onContinue, onOpen, refreshing, busy, lastCheckedAt }: {
  shop: Shop; onRefresh: () => void; onEdit: () => void; onContinue: () => void; onOpen: () => void;
  refreshing?: boolean; busy?: boolean; lastCheckedAt?: number;
}) {
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const compact = width < 480;
  const status = shop.approvalStatus;
  const approved = status === "Approved";
  const needsChanges = status === "Rejected";
  const paused = status === "Suspended";
  const color = approved ? palette.successInk : needsChanges || paused ? palette.danger : palette.warning;
  const tint = approved ? "#EFF9F4" : needsChanges || paused ? "#FFF4F3" : "#FFFAEE";
  const StatusIcon = approved ? CheckCircle2 : needsChanges || paused ? TriangleAlert : Clock3;
  const content: Record<Status, { title: string; description: string; note: string }> = {
    Pending: { title: "Waiting for admin approval", description: "Your application has been submitted. An admin will review your shop before it goes live.", note: "Your shop is hidden from customers until approved." },
    Approved: { title: "Your shop is ready to go", description: "Your application is approved. Open your shop to set up services and start receiving orders.", note: "Shop mode is unlocked. Your shop is visible to customers." },
    Rejected: { title: "Your application needs an update", description: "Review the admin's feedback below, update your shop details, and submit your application again.", note: "Your shop stays hidden while you update your application." },
    Suspended: { title: "Your shop access is paused", description: "An admin has suspended your shop. Review the reason below. An admin must restore access before you can receive new orders.", note: "Your shop is hidden and cannot receive new orders." },
  };
  const steps = [
    { label: "Submitted", detail: "Application received", complete: true, active: false },
    { label: needsChanges ? "Needs changes" : "Admin review", detail: needsChanges ? "Update your details" : approved || paused ? "Review complete" : "Awaiting a decision", complete: approved || paused, active: !approved && !paused },
    { label: paused ? "Access paused" : "Go live", detail: paused ? "Admin action needed" : approved ? "Shop mode unlocked" : "After approval", complete: approved, active: paused },
  ];
  function Detail({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
    return <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: palette.surface, alignItems: "center", justifyContent: "center" }}><Icon size={17} color={palette.muted} /></View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}><Txt style={{ color: palette.muted, fontSize: 12 }}>{label}</Txt><Txt style={{ color: palette.ink, lineHeight: 22 }}>{value}</Txt></View>
    </View>;
  }
  return <View testID="shop-application-status" style={{ flexDirection: wide ? "row" : "column", alignItems: "flex-start", gap: 24 }}>
    <Card style={{ flex: wide ? 1 : undefined, width: wide ? undefined : "100%", padding: compact ? 20 : 28, borderRadius: 22, gap: 24 }}>
      <View style={[styles.between, { flexDirection: compact ? "column" : "row", alignItems: "flex-start", gap: 16 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: compact ? undefined : 1, width: compact ? "100%" : undefined, minWidth: 140 }}>
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: palette.soft, alignItems: "center", justifyContent: "center" }}><Store size={24} color={palette.primary} /></View>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}><Txt style={{ fontSize: 18, fontWeight: "700", color: palette.ink }}>{shop.shopName}</Txt><Txt style={{ color: palette.muted, fontSize: 12 }}>Application #{shop.id}</Txt></View>
        </View>
        <ApprovalBadge status={status} />
      </View>
      <View style={{ backgroundColor: tint, borderRadius: 16, padding: compact ? 16 : 20, gap: 12 }}>
        <StatusIcon size={26} color={color} strokeWidth={1.8} />
        <Txt accessibilityRole="header" style={{ fontSize: compact ? 22 : 26, lineHeight: compact ? 30 : 34, fontWeight: "700", color: palette.ink }}>{content[status].title}</Txt>
        <Txt style={{ color: palette.muted, lineHeight: 23 }}>{content[status].description}</Txt>
      </View>
      {shop.reviewReason && <View style={{ gap: 8, borderLeftWidth: 3, borderLeftColor: color, paddingLeft: 14 }}>
        <Txt style={{ fontWeight: "600", color: palette.ink }}>Admin's feedback</Txt><Txt style={{ color: palette.muted, lineHeight: 23 }}>{shop.reviewReason}</Txt>
      </View>}
      <View style={{ gap: 16 }}>
        <Txt style={{ fontSize: 13, fontWeight: "600", color: palette.ink }}>Application progress</Txt>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {steps.map((step, index) => {
            const stepColor = step.complete ? palette.successInk : step.active ? color : palette.muted;
            return <View key={index} accessible accessibilityLabel={`${step.label}: ${step.detail}`} style={{ flex: 1, minWidth: 0, gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: step.complete ? 0 : 1, borderColor: step.active ? color : palette.line,
                  backgroundColor: step.complete ? "#EAF5EF" : step.active ? tint : palette.surface, alignItems: "center", justifyContent: "center" }}>
                  {step.complete ? <Check size={16} color={stepColor} /> : step.active ? <Clock3 size={15} color={stepColor} /> : <Txt style={{ fontSize: 12, color: stepColor }}>{index + 1}</Txt>}
                </View>
                {index < 2 && <View style={{ height: 2, flex: 1, backgroundColor: steps[index + 1].complete ? "#CBE5D6" : palette.line }} />}
              </View>
              <Txt style={{ fontSize: 12, fontWeight: "600", color: step.active ? color : palette.ink }}>{step.label}</Txt>
              {!compact && <Txt style={{ fontSize: 11, lineHeight: 17, color: palette.muted }}>{step.detail}</Txt>}
            </View>;
          })}
        </View>
      </View>
      <View style={{ gap: 18, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
          {approved ? <CheckCircle2 size={16} color={palette.successInk} style={{ marginTop: 2 }} /> : <LockKeyhole size={16} color={palette.muted} style={{ marginTop: 2 }} />}
          <Txt style={{ flex: 1, color: palette.muted, fontSize: 12, lineHeight: 19 }}>{content[status].note}</Txt>
        </View>
        <View style={{ flexDirection: compact ? "column" : "row", flexWrap: "wrap", gap: 10 }}>
          <Button title={approved ? "Open My Shop" : needsChanges ? "Edit and Resubmit" : "Continue as Customer"}
            onPress={approved ? onOpen : needsChanges ? onEdit : onContinue} busy={approved && busy}
            icon={<ArrowRight size={17} color="white" />} style={{ flexGrow: 1 }} />
          <Button title="Refresh Status" outline onPress={onRefresh} busy={refreshing} icon={<RefreshCw size={16} color={palette.primary} />} style={{ flexGrow: compact ? 1 : 0 }} />
        </View>
        {(approved || needsChanges) && <Button title="Continue as Customer" outline onPress={onContinue} />}
        <Txt accessibilityLiveRegion="polite" style={{ color: palette.muted, fontSize: 11, lineHeight: 18 }}>
          {lastCheckedAt ? `Last checked at ${new Date(lastCheckedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. ` : ""}Status updates automatically.
        </Txt>
      </View>
    </Card>
    <View style={{ width: wide ? 304 : "100%", gap: 20 }}>
      <Card style={{ padding: 24, borderRadius: 22, gap: 24 }}>
        <View style={styles.between}><Txt style={{ fontSize: 16, fontWeight: "700", color: palette.ink }}>Shop details</Txt><Store size={18} color={palette.muted} /></View>
        <Detail icon={MapPin} label="Shop address" value={address(shop) || "Not provided"} />
        <Detail icon={Phone} label="Contact number" value={shop.contactNumber || "Not provided"} />
        <Detail icon={Clock3} label="Business hours" value={shop.openingTime && shop.closingTime ? `${shop.openingTime} – ${shop.closingTime}` : "Not provided"} />
      </Card>
      {!approved && <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 20, borderRadius: 18, backgroundColor: palette.soft }}>
        <ShoppingBag size={20} color={palette.primary} style={{ marginTop: 2 }} />
        <View style={{ flex: 1, gap: 6 }}><Txt style={{ fontWeight: "600", color: palette.primary }}>Keep your laundry moving</Txt><Txt style={{ color: palette.muted, fontSize: 12, lineHeight: 20 }}>You can still browse laundry shops and book services as a customer.</Txt></View>
      </View>}
    </View>
  </View>;
}

interface Application extends Shop {
  user: { id: number; name: string; email: string; phone?: string | null };
  createdAt: string;
  reviewedBy?: { id: number; name: string } | null;
}

export function AdminDashboardDesign() {
  const logout = useLogout();
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const compact = width < 600;
  const wide = width >= 1000;
  const auth = useAuthStore();
  const profile = useProfile();
  const cache = useQueryClient();
  const [filter, setFilter] = useState("Pending");
  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState<{ shop: Application; status: "Approved" | "Rejected" | "Suspended" } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const applications = useQuery({
    queryKey: ["admin-shops", auth.user?.id], enabled: !!profile.data?.isAdmin,
    queryFn: () => api.get<Application[]>("/admin/shops"), refetchInterval: 15000,
  });
  function choose(shop: Application, status: "Approved" | "Rejected" | "Suspended") {
    setReason(""); setError(null); setDecision({ shop, status });
  }
  async function review() {
    if (!decision || busy) return;
    if (decision.status !== "Approved" && !reason.trim()) { setError("Enter a reason the shop applicant can understand."); return; }
    setBusy(true); setError(null);
    try {
      await api.put(`/admin/shops/${decision.shop.id}/review`, {
        status: decision.status, expectedStatus: decision.shop.approvalStatus, expectedVersion: decision.shop.applicationVersion, reason: reason.trim(),
      });
      setDecision(null);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["admin-shops"] }),
        cache.invalidateQueries({ queryKey: ["shops"] }),
        cache.invalidateQueries({ queryKey: ["shop"] }),
        cache.invalidateQueries({ queryKey: ["user"] }),
      ]);
    } catch (failure) { setError(message(failure)); void applications.refetch(); void profile.refetch(); }
    finally { setBusy(false); }
  }
  const list = applications.data || [];
  const visible = list.filter(shop => (filter === "All" || shop.approvalStatus === filter)
    && `${shop.shopName} ${shop.user.name} ${shop.user.email} ${address(shop)}`.toLowerCase().includes(search.toLowerCase()));
  return <Screen title="Admin Dashboard" back={false} background={palette.surface}>
    <View style={styles.stack}>
      <View style={styles.between}>
        <View style={{ flex: 1, minWidth: 180, gap: 4 }}><Txt style={styles.title}>Shop management</Txt><Txt style={styles.muted}>Review applications and manage shop access.</Txt></View>
        <View style={[styles.row, { flexWrap: "wrap" }]}>
          <Button title="Sign Out" outline onPress={logout} />
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {statuses.map(status => <Card key={status} style={{ flexGrow: 1, flexBasis: compact ? "45%" : 140, padding: compact ? 16 : 20, gap: 8 }}>
          <Txt style={{ color: palette.muted, fontSize: 12 }}>{labels[status]}</Txt><Txt style={styles.title}>{list.filter(shop => shop.approvalStatus === status).length}</Txt>
        </Card>)}
      </View>
      <SearchBox placeholder="Search shops, owners, or addresses" value={search} onChangeText={setSearch} />
      <TabsRow items={[...statuses, "All"]} value={filter} onChange={setFilter} />
      <View style={[styles.between, { gap: 8 }]}>
        <Txt accessibilityLiveRegion="polite" style={styles.muted}>{visible.length} {visible.length === 1 ? "shop" : "shops"}{filter !== "All" ? ` · ${labels[filter as Status]}` : " · All statuses"}</Txt>
        <Button title="Refresh" compact outline busy={applications.isFetching} icon={<RefreshCw size={15} color={palette.primary} />} onPress={() => { void applications.refetch(); void profile.refetch(); }} />
      </View>
      <QueryState loading={applications.isLoading} error={applications.error} retry={() => applications.refetch()} />
      {visible.map(shop => <Card key={shop.id} style={{ padding: compact ? 18 : 24, gap: 20, borderRadius: 20 }}>
        <View style={{ flexDirection: compact ? "column" : "row", alignItems: "flex-start", gap: 12 }}>
          <View style={[styles.row, { flex: compact ? undefined : 1, minWidth: 0, width: compact ? "100%" : undefined }]}>
            <View style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 12, backgroundColor: palette.soft, alignItems: "center", justifyContent: "center" }}><Store size={22} color={palette.primary} /></View>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Txt accessibilityRole="header" style={styles.heading}>{shop.shopName}</Txt>
              <Txt style={{ color: palette.muted, fontSize: 12 }}>Application #{shop.id} · Submitted {new Date(shop.createdAt).toLocaleDateString()}</Txt>
            </View>
          </View>
          <ApprovalBadge status={shop.approvalStatus} />
        </View>
        <View style={{ flexDirection: wide ? "row" : "column", gap: 20, paddingTop: 18, borderTopWidth: 1, borderTopColor: palette.line }}>
          <View style={{ flex: wide ? 1 : undefined, minWidth: 0, gap: 6 }}>
            <Txt style={{ fontSize: 11, fontWeight: "700", color: palette.muted, letterSpacing: 1 }}>OWNER & CONTACT</Txt>
            <Txt style={{ fontWeight: "600" }}>{shop.user.name}</Txt>
            <Txt selectable style={{ color: palette.muted }}>{shop.user.email}</Txt>
            <View style={[styles.row, { gap: 8 }]}><Phone size={15} color={palette.muted} /><Txt selectable>{shop.contactNumber || "No contact number"}</Txt></View>
          </View>
          <View style={{ flex: wide ? 1.4 : undefined, minWidth: 0, gap: 8 }}>
            <Txt style={{ fontSize: 11, fontWeight: "700", color: palette.muted, letterSpacing: 1 }}>LOCATION & HOURS</Txt>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}><MapPin size={16} color={palette.muted} style={{ marginTop: 3, flexShrink: 0 }} /><Txt style={{ flex: 1 }}>{address(shop) || "No address provided"}</Txt></View>
            <View style={[styles.row, { gap: 8 }]}><Clock3 size={15} color={palette.muted} /><Txt style={{ flex: 1, color: palette.muted }}>{shop.openingTime} – {shop.closingTime}</Txt></View>
          </View>
        </View>
        {(shop.reviewReason || shop.reviewedAt) && <View style={{ backgroundColor: palette.surface, padding: 14, borderRadius: 12, gap: 6 }}>
          <Txt style={{ fontSize: 12, fontWeight: "600", color: palette.primary }}>Latest admin review</Txt>
          {!!shop.reviewReason && <Txt>{shop.reviewReason}</Txt>}
          {!!shop.reviewedAt && <Txt style={{ fontSize: 12, color: palette.muted }}>{shop.reviewedBy?.name || "Former admin"} · {new Date(shop.reviewedAt).toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</Txt>}
        </View>}
        <View style={{ flexDirection: wide ? "row" : "column", alignItems: wide ? "center" : "stretch", gap: 16, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 16 }}>
          <Txt style={{ flex: wide ? 1 : undefined, color: palette.muted, fontSize: 12 }}>{shop.approvalStatus === "Approved" ? "Visible to customers and accepting bookings." : shop.approvalStatus === "Pending" ? "Hidden from customers until approved." : shop.approvalStatus === "Suspended" ? "Shop access is paused. Restore to enable bookings." : "The owner can update and resubmit this application."}</Txt>
          <View style={{ flexDirection: compact ? "column" : "row", flexWrap: "wrap", gap: 10 }}>
            {(shop.approvalStatus === "Pending" || shop.approvalStatus === "Suspended") && <Button title={shop.approvalStatus === "Suspended" ? "Restore Shop" : "Approve Shop"} color={palette.success} onPress={() => choose(shop, "Approved")} />}
            {shop.approvalStatus === "Pending" && <Button title="Reject Application" color={palette.danger} outline onPress={() => choose(shop, "Rejected")} />}
            {shop.approvalStatus === "Approved" && <Button title="Suspend Shop" color={palette.danger} outline onPress={() => choose(shop, "Suspended")} />}
          </View>
        </View>
      </Card>)}
      {!applications.isLoading && !applications.error && !visible.length && <Empty title="No matching applications" message="Shop applications will appear here for review." />}
    </View>
    <Modal visible={!!decision} transparent animationType="fade" onRequestClose={() => !busy && setDecision(null)}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: "#00000066" }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: compact ? 16 : 24 }}>
        <Card style={{ width: "100%", maxWidth: 520, alignSelf: "center" }}>
          <Txt style={styles.heading}>{decision?.status === "Approved" ? "Approve shop" : decision?.status === "Rejected" ? "Reject application" : "Suspend shop"}</Txt>
          <Txt>{decision?.shop.shopName}</Txt>
          <Txt style={styles.muted}>{decision?.status === "Approved" ? "The shop will be listed for customers and shop mode will be enabled." : "The shop will stay hidden and shop mode will be locked. The applicant will see your reason."}</Txt>
          <Field label={decision?.status === "Approved" ? "Note (optional)" : "Reason *"} value={reason} onChangeText={setReason} multiline maxLength={1000} />
          <FormError error={error} />
          <Button title={decision?.status === "Suspended" ? "Suspend Shop" : decision?.status === "Rejected" ? "Reject Application" : decision?.shop.approvalStatus === "Suspended" ? "Restore Shop" : "Approve Shop"} color={decision?.status === "Approved" ? palette.success : palette.danger} busy={busy} onPress={review} />
          <Button title="Cancel" disabled={busy} outline onPress={() => setDecision(null)} />
        </Card>
      </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  </Screen>;
}
