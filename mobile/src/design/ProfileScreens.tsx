import { useEffect, useState, useRef } from "react";
import { Modal, Pressable, Switch, View } from "react-native";
import { ArrowLeft, ChevronRight, LogOut, Pencil } from "lucide-react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "../store/authStore";
import {
  Asset,
  Brand,
  Button,
  Card,
  Choice,
  Empty,
  Field,
  MenuRow,
  Screen,
  Section,
  Txt,
  usePalette,
  styles,
} from "./ui";
import {
  address,
  api,
  fail,
  useFlowNavigation,
  unavailable,
  useOwnedShop,
  useProfile,
  type Profile,
} from "./data";
import { CodeInput } from "./AuthScreens";
import { QueryState } from "./UserScreens";
import LaundryMap from "./LaundryMap";
import { AddressFields, FormError } from "./AddressFields";
import { addressValues, addressError, addressPayload } from "./address";
import { message, notify } from "./data";
import PickerField from "./PickerField";
import { validBirthdate } from "./form-values";
import { useLaundryDraft } from "./store";
import { ProfilePhotoControl } from "./ProfilePhotoControl";
import { useLogout } from "./useLogout";

export function UserProfileDesign() {
  const logout = useLogout();
  const palette = usePalette();
  const { go } = useFlowNavigation();
  const user = useAuthStore((state) => state.user);
  const profile = useProfile();
  const owned = useOwnedShop();
  const data = profile.data || user;
  return (
    <Screen background={palette.surface} padded={false}>
      {!user ? (
        <Empty
          title="Login Required"
          message="Please login to view your profile"
          action="Login"
          onPress={() => router.push("/(auth)/login")}
        />
      ) : (
        <>
          <View style={{ backgroundColor: palette.surface, alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 12 }}>
            <View style={{ width: "100%", maxWidth: 720, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Back to Home" onPress={() => router.replace("/(user)/home")}
                style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "white", opacity: pressed ? 0.8 : 1 })}>
                <ArrowLeft size={20} color={palette.ink} />
              </Pressable>
              <Txt accessibilityRole="header" style={{ color: palette.ink, fontSize: 16, fontWeight: "600", textAlign: "center" }}>Settings</Txt>
              <Pressable accessibilityRole="button" accessibilityLabel="Edit profile" onPress={() => go("edit-profile")}
                style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "white", opacity: pressed ? 0.8 : 1 })}>
                <Pencil size={18} color={palette.ink} />
              </Pressable>
            </View>
            <ProfilePhotoControl userId={user.id} photoUrl={data?.photoUrl} />
            <Txt style={{ color: palette.ink, fontSize: 20, lineHeight: 26, fontWeight: "700", textAlign: "center" }}>{data?.name}</Txt>
            <Txt style={{ color: palette.muted, textAlign: "center" }}>{data?.email}</Txt>
          </View>
          <View style={{ width: "100%", maxWidth: 720, alignSelf: "center", padding: 16, gap: 8 }}>
            <Section title="Personal details" />
            <QueryState
              loading={profile.isLoading}
              error={profile.error}
              retry={() => profile.refetch()}
            />
            <View style={{ backgroundColor: "white", borderWidth: 1, borderColor: palette.line, borderRadius: 14, overflow: "hidden" }}>
            {[
              {
                icon: "locationblue.png" as const,
                text: address(profile.data) || "No address",
              },
              {
                icon: "contact.png" as const,
                text: profile.data?.phone || "No phone",
              },
              { icon: "mail.png" as const, text: data?.email || "No email" },
              {
                icon: "birthdate.png" as const,
                text: profile.data?.birthdate?.slice(0, 10) || "No birthdate",
              },
              {
                icon: "gender.png" as const,
                text: profile.data?.gender || "No gender",
              },
            ].map((row) => (
              <View key={row.icon} style={[styles.row, { minHeight: 54, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "white", borderBottomWidth: row.icon === "gender.png" ? 0 : 1, borderBottomColor: palette.line }]}>
                <Asset name={row.icon} size={21} />
                <Txt style={[styles.grow, { color: palette.ink }]}>{row.text}</Txt>
              </View>
            ))}
            </View>
            <Section title="Account" />
            <View style={{ backgroundColor: "white", borderWidth: 1, borderColor: palette.line, borderRadius: 14, overflow: "hidden" }}>
              <ProfileAction title="Addresses" asset="locationblue.png" onPress={() => go("addresses")} />
              <ProfileAction title="Transactions" asset="transaction.png" onPress={() => go("history")} />
            </View>
            <Button
              title={owned.data?.approvalStatus === "Approved" ? "Switch to Shop Mode" : owned.data ? "Shop Application Status" : "Apply to Open a Shop"}
              color={palette.blue}
              icon={<Asset name="shop.png" tint="white" size={20} />}
              onPress={() => owned.data?.approvalStatus === "Approved" ? router.replace("/shop/profile") : go("register-shop")}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Logout" onPress={logout} style={({ pressed }) => [styles.row, { minHeight: 54, marginTop: 4, paddingHorizontal: 16, borderRadius: 12, backgroundColor: pressed ? "#FDECEC" : "white", borderWidth: 1, borderColor: palette.line }]}>
              <LogOut size={20} color={palette.danger} />
              <Txt style={[styles.grow, { color: palette.danger, fontWeight: "600" }]}>Logout</Txt>
              <ChevronRight size={18} color={palette.muted} />
            </Pressable>
          </View>
        </>
      )}
    </Screen>
  );
}

function ProfileAction({ title, asset, onPress }: { title: string; asset: "locationblue.png" | "transaction.png" | "shop.png"; onPress: () => void }) {
  const palette = usePalette();
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.row, { minHeight: 58, paddingHorizontal: 16, backgroundColor: pressed ? palette.soft : "white" }]}>
    <Asset name={asset} size={21} />
    <Txt style={[styles.grow, { color: palette.ink, fontWeight: "500" }]}>{title}</Txt>
    <ChevronRight size={18} color={palette.muted} />
  </Pressable>;
}
export function EditProfileDesign({ account = false }: { account?: boolean }) {
  const palette = usePalette();
  const { go } = useFlowNavigation();
  const profile = useProfile();
  const auth = useAuthStore();
  const cache = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  useEffect(() => {
    if (profile.data)
      setValues(
        Object.fromEntries(
          Object.entries(profile.data).map(([key, value]) => [
            key,
            value == null
              ? ""
              : typeof value === "string"
                ? key === "birthdate"
                  ? value.slice(0, 10)
                  : value
                : String(value),
          ]),
        ),
      );
  }, [profile.data]);
  async function save() {
    if (!auth.user) return;
    if (values.name?.trim().length < 2)
      return notify("Profile", "Please enter your full name.");
    if (
      values.birthdate &&
      !validBirthdate(values.birthdate)
    )
      return notify("Birthdate", "Choose a valid birthdate that is not in the future.");
    setBusy(true);
    try {
      const fields = [
        "name",
        "phone",
        "birthdate",
        "gender",
      ];
      const payload = Object.fromEntries(
        fields
          .filter(
            (key) =>
              values[key] !== undefined &&
              !(key === "birthdate" && !values[key]),
          )
          .map((key) => [key, values[key]]),
      );
      const user = await api.put<Profile>(`/users/${auth.user.id}`, payload);
      await auth.setAuth(user, auth.token!);
      cache.setQueryData(["user", user.id], user);
      notify("Profile", "Changes saved successfully");
      router.back();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      title={account ? "Account Information" : "Profile"}
      background={account ? palette.surface : "white"}
      footer={
        <Button
          title="Save Changes"
          busy={busy}
          color={palette.navy}
          onPress={save}
        />
      }
    >
      <View style={styles.stack}>
        <QueryState
          loading={profile.isLoading}
          error={profile.error}
          retry={() => profile.refetch()}
        />
        <Card
          style={
            account
              ? undefined
              : { padding: 0, borderWidth: 0, shadowOpacity: 0, elevation: 0 }
          }
        >
          {account ? (
            <Section title="Account Details" />
          ) : (
            <Pressable accessibilityRole="button"
              disabled accessibilityState={{ disabled: true }}
              style={[
                styles.row,
                {
                  paddingVertical: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: palette.line,
                },
              ]}
            >
              <Asset name="profile.png" tint={palette.primary} />
              <Txt style={{ color: palette.primary, fontWeight: "600" }}>
                Profile photo updates are unavailable
              </Txt>
            </Pressable>
          )}
          {account && (
            <Field
              label="ID"
              value={String(auth.user?.id || "")}
              editable={false}
            />
          )}
          {[
            { key: "name", label: "Name" },
            { key: "phone", label: "Contact Number" },
            { key: "email", label: "Email Address" },
            ...(!account
              ? [
                { key: "birthdate", label: "Birthdate" },
                { key: "gender", label: "Gender" },
              ]
              : []),
          ].map((field) =>
            field.key === "birthdate" ? (
              <PickerField key={field.key} label="Birthdate" mode="date" value={values.birthdate || ""} maximumDate={new Date()}
                onChange={birthdate => setValues(current => ({ ...current, birthdate }))} />
            ) : account ? (
              <Field
                key={field.key}
                label={field.label}
                value={values[field.key] || ""}
                onChangeText={(value) =>
                  setValues({ ...values, [field.key]: value })
                }
                editable={field.key !== "email"}
              />
            ) : (
              <Pressable accessibilityRole="button"
                key={field.key}
                disabled={field.key === "email"}
                onPress={() => setEditKey(field.key)}
                style={[
                  styles.between,
                  {
                    paddingVertical: 18,
                    borderBottomWidth: 1,
                    borderBottomColor: palette.line,
                  },
                ]}
              >
                <View style={{ gap: 6, flex: 1 }}>
                  <Txt style={{ color: palette.primary, fontWeight: "600" }}>
                    {field.label}
                  </Txt>
                  <Txt style={styles.muted}>
                    {values[field.key] || "Not provided"}
                  </Txt>
                </View>
                {field.key !== "email" && (
                  <Asset name="edit.png" size={20} tint={palette.primary} />
                )}
              </Pressable>
            ),
          )}
          {!account && <MenuRow title="Address" detail={address(profile.data) || "Add your address"} asset="locationblue.png"
            onPress={() => { useLaundryDraft.getState().set({ address: null }); go("confirm-location"); }} />}
        </Card>
        {account ? (
          <Card>
            <Section title="Account Credibility" />
            {[
              "Philippine Department of Trade and Industry (DTI)",
              "Securities and Exchange Commission (SEC)",
              "TIN ID",
              "Mayor’s Permit",
            ].map((name) => (
              <MenuRow
                key={name}
                title={name}
                detail="Verification is not available"

              />
            ))}
          </Card>
        ) : (
          <Card
            style={{
              padding: 0,
              borderWidth: 0,
              shadowOpacity: 0,
              elevation: 0,
            }}
          >
            <Section title="Connected accounts" />
            <View style={{ gap: 16 }}>
              <Pressable accessibilityRole="button"
                accessibilityLabel="Bind Google account"
                disabled accessibilityState={{ disabled: true }}
              >
                <View style={styles.between}>
                  <View style={styles.row}>
                    <Asset name="google.png" size={24} />
                    <Txt>Google</Txt>
                  </View>
                  <Txt style={styles.muted}>Unavailable</Txt>
                </View>
              </Pressable>
              <Pressable accessibilityRole="button"
                accessibilityLabel="Bind Facebook account"
                disabled accessibilityState={{ disabled: true }}
              >
                <View style={styles.between}>
                  <View style={styles.row}>
                    <Asset name="facebook.png" size={24} />
                    <Txt>Facebook</Txt>
                  </View>
                  <Txt style={styles.muted}>Unavailable</Txt>
                </View>
              </Pressable>
            </View>
          </Card>
        )}
        <MenuRow
          title="Change Password"
          onPress={() => go("change-password")}
        />
        <MenuRow
          title="Delete Account"
          color={palette.danger}
          onPress={() => go("delete-account")}
        />
      </View>
      <Modal
        visible={!!editKey}
        transparent
        animationType="none"
        onRequestClose={() => setEditKey(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#00000066",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Card>
            <Txt style={styles.heading}>
              Edit{" "}
              {editKey === "phone"
                ? "Contact Number"
                : editKey === "birthdate"
                  ? "Birthdate"
                  : editKey}
            </Txt>
            <Field
              value={editKey ? values[editKey] || "" : ""}
              onChangeText={(value) =>
                editKey && setValues({ ...values, [editKey]: value })
              }
              placeholder={
                editKey === "birthdate" ? "YYYY-MM-DD" : "Enter new value"
              }
              autoFocus
              keyboardType={editKey === "phone" ? "phone-pad" : "default"}
            />
            <View style={styles.row}>
              <Button
                title="Cancel"
                outline
                color={palette.navy}
                onPress={() => setEditKey(null)}
                style={styles.grow}
              />
              <Button
                title="Save"
                color={palette.navy}
                onPress={() => setEditKey(null)}
                style={styles.grow}
              />
            </View>
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}
export function ChangePasswordDesign({
  security = false,
}: {
  security?: boolean;
}) {
  const palette = usePalette();
  const { go } = useFlowNavigation();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const user = useAuthStore((state) => state.user);
  async function save() {
    if (!user) return;
    if (!current || password.length < 6 || (!security && password !== confirm))
      return notify(
        "Change Password",
        "Enter your current password and matching new passwords with at least 6 characters.",
      );
    setBusy(true);
    try {
      await api.put(`/users/${user.id}/password`, {
        currentPassword: current,
        newPassword: password,
      });
      setCurrent("");
      setPassword("");
      setConfirm("");
      notify("Change Password", "Password updated successfully");
      if (!security) router.back();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      title={security ? "Security" : "Change Password"}
      background={security ? palette.lavender : "white"}
    >
      <View
        style={{ flex: 1, justifyContent: security ? "center" : "flex-start" }}
      >
        <Card>
          {security && (
            <>
              <Section title="Two-factor Authentication" />
              <View style={styles.between}>
                <Txt style={styles.muted}>
                  Two-factor authentication is not available yet.
                </Txt>
                <Switch
                  value={false}
                  disabled accessibilityLabel="Two-factor authentication is not available"
                  trackColor={{ false: "#D1D5DB", true: palette.navy }}
                />
              </View>
              <Section title="Change Password" />
            </>
          )}
          <Field
            label="Current Password"
            password
            placeholder="Enter password"
            value={current}
            onChangeText={setCurrent}
          />
          <Field
            label="New Password"
            password
            placeholder="Enter password"
            value={password}
            onChangeText={setPassword}
          />
          {!security && (
            <Field
              label="Confirm New Password"
              password
              placeholder="Enter password"
              value={confirm}
              onChangeText={setConfirm}
            />
          )}
          <Button
            title={security ? "Save" : "Confirm"}
            color={security ? palette.navy : palette.blue}
            onPress={save}
            busy={busy}
          />
        </Card>
      </View>
    </Screen>
  );
}
export function AccountConfirmationDesign() {
  const palette = usePalette();
  const { replaceFlow } = useFlowNavigation();
  const [busy, setBusy] = useState(false);
  const auth = useAuthStore();
  const cache = useQueryClient();
  async function confirm() {
    setBusy(true);
    try {
      if (auth.user) await api.delete(`/users/${auth.user.id}`);
      await auth.logout();
      cache.clear();
      replaceFlow("account-deleted");
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen scroll={false} background={palette.surface}>
      <View style={[styles.grow, styles.center]}>
        <Card style={{ width: "100%", padding: 24, gap: 24 }}>
          <Txt style={[styles.heading, { textAlign: "center" }]}>
            Are you sure want to delete your account?
          </Txt>
          <Txt style={[styles.muted, { textAlign: "center" }]}>
            All data and binded accounts will be removed from the application
          </Txt>
          <View style={styles.row}>
            <Button
              title="Cancel"
              outline
              color={palette.navy}
              onPress={() => router.back()}
              style={styles.grow}
            />
            <Button
              title="Continue"
              busy={busy}
              color={palette.navy}
              onPress={confirm}
              style={styles.grow}
            />
          </View>
        </Card>
      </View>
    </Screen>
  );
}
export function TwoFactorDesign({
  stage = "choose-2fa",
  method: initialMethod = "",
}: {
  stage?: string;
  method?: string;
}) {
  const palette = usePalette();
  const { go } = useFlowNavigation();
  const [method, setMethod] = useState(initialMethod);
  const [code, setCode] = useState("");
  return (
    <Screen title="Security" background={palette.surface}>
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Card style={{ padding: 24 }}>
          {stage === "choose-2fa" ? (
            <>
              <Txt style={styles.heading}>Two-factor Authentication</Txt>
              <Txt style={styles.muted}>
                Protect your account by enabling 2FA
              </Txt>
              <Txt style={styles.muted}>
                Choose how you want to receive your authentication codes.
              </Txt>
              {[
                {
                  name: "Authenticator app",
                  icon: "Admin/Authenticate.png" as const,
                },
                { name: "SMS", icon: "Admin/SMS.png" as const },
                { name: "Email", icon: "Admin/Email.png" as const },
              ].map((option) => (
                <Pressable accessibilityRole="button"
                  key={option.name}
                  onPress={() => setMethod(option.name)}
                  style={[
                    styles.row,
                    {
                      backgroundColor:
                        method === option.name ? palette.soft : "white",
                      padding: 16,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor:
                        method === option.name ? palette.navy : palette.line,
                    },
                  ]}
                >
                  <Asset name={option.icon} size={32} />
                  <Txt style={[styles.grow, { color: palette.navy }]}>
                    Set up using {option.name}
                  </Txt>
                  {method === option.name && (
                    <Txt style={{ color: palette.navy }}>✓</Txt>
                  )}
                </Pressable>
              ))}
              <View style={styles.row}>
                <Button
                  title="Cancel"
                  outline
                  color={palette.navy}
                  onPress={() => router.back()}
                  style={styles.grow}
                />
                <Button
                  title="Confirm"
                  color={palette.navy}
                  disabled={!method}
                  onPress={() => go("enter-2fa", { method })}
                  style={styles.grow}
                />
              </View>
            </>
          ) : stage === "enter-2fa" ? (
            <>
              <Txt style={styles.heading}>Enter your 2FA code</Txt>
              <Txt style={styles.muted}>Enter a 6 - digit code</Txt>
              <CodeInput length={6} value={code} onChange={setCode} />
              <Txt style={styles.muted}>
                Enter the code that you received via authenticator app, sms, or
                email.
              </Txt>
              <Button
                title="Confirm"
                color={palette.navy}
                disabled={code.length !== 6}
                onPress={() => unavailable("Two-factor authentication")}
              />
            </>
          ) : (
            <>
              <Asset name="Admin/Success.png" size={100} />
              <Txt style={styles.heading}>2FA Complete</Txt>
              <Txt style={styles.muted}>Two-factor authentication enabled!</Txt>
              <Button
                title="Done"
                color={palette.navy}
                onPress={() => router.back()}
              />
            </>
          )}
        </Card>
      </View>
    </Screen>
  );
}
export function AddressesDesign({ checkout = false }: { checkout?: boolean }) {
  const palette = usePalette();
  const { go } = useFlowNavigation();
  const profile = useProfile();
  const user = useAuthStore((state) => state.user);
  const draft = useLaundryDraft();
  const saved = useQuery({
    queryKey: ["saved-addresses", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const raw = await AsyncStorage.getItem(`labaride-addresses:${user!.id}`);
      return raw ? (JSON.parse(raw) as Partial<Profile>[]) : [];
    },
  });
  return (
    <Screen
      title="Your Addresses"
      footer={
        <Button
          title="Add another address"
          color={palette.navy}
          onPress={() => go("add-address", { checkout: String(checkout) })}
        />
      }
    >
      <View style={styles.stack}>
        <View style={{ height: 220, borderRadius: 12, overflow: "hidden" }}>
          <LaundryMap />
        </View>
        <QueryState
          loading={profile.isLoading}
          error={profile.error}
          retry={() => profile.refetch()}
        />
        <Section title="Default Address" />
        <MenuRow
          title={address(profile.data) || "No default address"}
          asset="locationblue.png"
          onPress={() => {
            draft.set({ address: profile.data });
            go("confirm-location", { checkout: String(checkout) });
          }}
        />
        {!!saved.data?.length && <Section title="Saved Addresses" />}
        {saved.data?.map((item, index) => (
          <MenuRow
            key={index}
            title={address(item)}
            asset="locationblue.png"
            onPress={() => {
              draft.set({ address: item });
              go("confirm-location", { checkout: String(checkout) });
            }}
          />
        ))}
      </View>
    </Screen>
  );
}
export function LocationDesign({ stage = "add-location", checkout = false }: { stage?: string; checkout?: boolean }) {
  const palette = usePalette();
  const { go, flowHref, inShop } = useFlowNavigation();
  const draft = useLaundryDraft();
  const profile = useProfile();
  const cache = useQueryClient();
  const auth = useAuthStore();
  const user = auth.user;
  const selected = stage === "add-address" ? null : draft.address || profile.data;
  const initialized = useRef(stage === "add-address" || !!selected);
  const [values, setValues] = useState<Record<string, string>>(() => addressValues(selected));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!initialized.current && selected) { initialized.current = true; setValues(addressValues(selected)); }
  }, [selected]);
  async function save() {
    if (busy) return;
    const validation = addressError(values);
    if (validation) { setError(validation); return; }
    const payload = addressPayload(values);
    setBusy(true); setError(null);
    try {
      if (stage === "add-address" && user) {
        const key = "labaride-addresses:" + user.id;
        const raw = await AsyncStorage.getItem(key);
        const entries: Partial<Profile>[] = raw ? JSON.parse(raw) : [];
        await AsyncStorage.setItem(key, JSON.stringify([...entries, payload]));
        draft.set({ address: payload });
        await cache.invalidateQueries({ queryKey: ["saved-addresses"] });
        router.back();
      } else if (checkout) {
        draft.set({ address: payload });
        router.dismissTo(flowHref("checkout"));
      } else if (user) {
        const result = await api.put<Profile>("/users/" + user.id, payload);
        await auth.setAuth(result, auth.token!);
        cache.setQueryData(["user", user.id], result);
        draft.set({ address: null });
        router.dismissTo(inShop ? "/shop/profile" : "/(user)/profile");
      } else { draft.set({ address: payload }); router.dismissTo("/(user)/home"); }
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(false); }
  }
  if (stage === "add-location") return <Screen title="Current Location">
    <View style={styles.stack}>
      <MenuRow title="Current Location" detail={address(profile.data) || "Choose a delivery location"} asset="locationblue.png"
        onPress={() => go("confirm-location", { checkout: String(checkout) })} />
      <Section title="Other Locations" />
      <MenuRow title="Saved Addresses" asset="locationblue.png" onPress={() => go("addresses", { checkout: String(checkout) })} />
      <Button title="Set delivery address" color={palette.navy} onPress={() => go("current-location", { checkout: String(checkout) })} />
    </View>
  </Screen>;
  return <Screen title={stage === "add-address" ? "Add New Address" : "Confirm Location"} background={palette.surface}
    footer={<View><FormError error={error} /><Button title={stage === "add-address" ? "Add" : "Confirm Address"}
      color={palette.navy} busy={busy} onPress={save} /></View>}>
    <View style={styles.stack}>
      <QueryState loading={profile.isLoading} error={profile.error} retry={() => profile.refetch()} />
      <Card><Section title="Delivery Address" /><AddressFields values={values} setValues={setValues} /></Card>
    </View>
  </Screen>;
}
