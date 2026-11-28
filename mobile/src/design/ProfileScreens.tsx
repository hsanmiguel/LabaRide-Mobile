import { toast } from "./toast-service";
import { useEffect, useState, useRef } from "react";
import { Modal, Platform, Pressable, Switch, View, useWindowDimensions } from "react-native";
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
import { saveDefaultAddress, sameSavedAddress } from "./default-address";
import { message, notify } from "./data";
import PickerField from "./PickerField";
import { validBirthdate } from "./form-values";
import { useLaundryDraft } from "./store";
import { ProfilePhotoControl } from "./ProfilePhotoControl";
import { useLogout } from "./useLogout";
import { ShopAccountCredibility } from './ShopRequirements';
import { DesktopShopSettings, SettingsSaveBar, SettingsSection, useDesktopShopSettings } from './DesktopShopSettings';
import { CustomerProfileFrame, ProfileFact, useDesktopCustomerProfile } from './CustomerProfileFrame';

export function UserProfileDesign() {
  const desktop = useDesktopCustomerProfile();
  const logout = useLogout();
  const palette = usePalette();
  const { go } = useFlowNavigation();
  const user = useAuthStore((state) => state.user);
  const profile = useProfile();
  const owned = useOwnedShop();
  const data = profile.data || user;
  if (desktop && user) return <CustomerProfileFrame active="overview" title="Your profile" description="Your personal details, saved addresses, and account preferences in one place.">
    <QueryState loading={profile.isLoading} error={profile.error} retry={() => profile.refetch()} />
    <Card style={{ padding: 22, flexDirection: 'row', alignItems: 'center', gap: 20 }}>
      <ProfilePhotoControl userId={user.id} photoUrl={data?.photoUrl} size={88} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}><Txt style={{ fontSize: 22, lineHeight: 30, fontWeight: '700' }}>{data?.name}</Txt><Txt selectable style={{ fontSize: 13, color: palette.muted }}>{data?.email}</Txt><Txt style={{ fontSize: 11, color: palette.muted }}>Customer account · #{user.id}</Txt></View>
      <Button title="Edit profile" compact outline icon={<Pencil size={15} color={palette.primary} />} onPress={() => go('edit-profile')} />
    </Card>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 18 }}>
      <View style={{ flex: 1.8, minWidth: 0, gap: 16 }}>
        <SettingsSection title="Personal details" description="The information linked to your customer account.">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 22 }}>
            <ProfileFact label="Contact number" value={profile.data?.phone || 'Not provided'} />
            <ProfileFact label="Birthdate" value={profile.data?.birthdate ? new Date(profile.data.birthdate.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : 'Not provided'} />
            <ProfileFact label="Gender" value={profile.data?.gender || 'Not provided'} />
            <ProfileFact label="Primary address" value={address(profile.data) || 'No address saved'} wide />
          </View>
        </SettingsSection>
        <Card style={{ padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16 }}><View style={{ flex: 1, gap: 3 }}><Txt style={{ fontSize: 15, fontWeight: '600' }}>Shop workspace</Txt><Txt style={{ fontSize: 12, color: palette.muted }}>{owned.data?.approvalStatus === 'Approved' ? 'Manage your laundry business using your shop account.' : 'Open a laundry shop or check your existing application.'}</Txt></View><Button title={owned.data?.approvalStatus === 'Approved' ? 'Switch to Shop Mode' : owned.data ? 'Shop Application Status' : 'Apply to Open a Shop'} compact outline onPress={() => owned.data?.approvalStatus === 'Approved' ? router.replace('/shop/profile') : go('register-shop')} /></Card>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 16 }}>
        <SettingsSection title="Account" description="Quick access to your customer account.">
          <MenuRow title="Addresses" detail="Manage your saved locations" asset="locationblue.png" onPress={() => go('addresses')} />
          <MenuRow title="Transactions" detail="View your order history" asset="transaction.png" onPress={() => go('history')} />
          <MenuRow title="Change Password" detail="Update your sign-in password" onPress={() => go('change-password')} />
        </SettingsSection>
        <Card style={{ padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ flex: 1, gap: 2 }}><Txt style={{ fontSize: 14, fontWeight: '600' }}>Session</Txt><Txt style={{ fontSize: 12, color: palette.muted }}>Sign out of this account.</Txt></View><Button title="Logout" compact outline color={palette.danger} onPress={logout} /></Card>
      </View>
    </View>
  </CustomerProfileFrame>;
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
  const desktop = useDesktopShopSettings();
  const customerDesktop = useDesktopCustomerProfile() && !account;
  const palette = usePalette();
  const { go } = useFlowNavigation();
  const profile = useProfile();
  const auth = useAuthStore();
  const cache = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const initializedProfile = useRef<number | null>(null);
  useEffect(() => {
    if (profile.data && (!customerDesktop || initializedProfile.current !== profile.data.id)) {
      initializedProfile.current = profile.data.id;
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
    }
  }, [profile.data, customerDesktop]);
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
      toast.success({ title: "Profile updated", message: "Your changes are saved." });
      if (customerDesktop) router.replace('/(user)/profile'); else router.back();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  if (customerDesktop) return <CustomerProfileFrame active="edit" title="Personal information" description="Keep your contact information and personal details up to date.">
    <QueryState loading={profile.isLoading} error={profile.error} retry={() => profile.refetch()} />
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 18 }}>
      <View style={{ flex: 1.8, minWidth: 0 }}><SettingsSection title="Profile details" description="Changes apply to your customer account.">
        {auth.user && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, borderBottomWidth: 1, borderBottomColor: palette.line, paddingBottom: 16 }}><ProfilePhotoControl userId={auth.user.id} photoUrl={profile.data?.photoUrl} size={80} /><View style={{ flex: 1, gap: 4 }}><Txt style={{ fontSize: 14, fontWeight: '600' }}>Profile photo</Txt><Txt style={{ fontSize: 12, color: palette.muted }}>Use the photo menu to change or remove your picture.</Txt></View></View>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          {[{ key: 'name', label: 'Name' }, { key: 'phone', label: 'Contact Number' }, { key: 'email', label: 'Email Address' }].map(field => <View key={field.key} style={{ flexBasis: '46%', flexGrow: 1, minWidth: 0 }}><Field compact label={field.label} value={values[field.key] || ''} editable={field.key !== 'email' && !busy} keyboardType={field.key === 'phone' ? 'phone-pad' : field.key === 'email' ? 'email-address' : 'default'} onChangeText={value => setValues(current => ({ ...current, [field.key]: value }))} />{field.key === 'email' && <Txt style={{ fontSize: 11, color: palette.muted, marginTop: 4 }}>Your sign-in email is read-only.</Txt>}</View>)}
          <View style={{ flexBasis: '46%', flexGrow: 1, minWidth: 0 }}><PickerField label="Birthdate" mode="date" value={values.birthdate || ''} maximumDate={new Date()} onChange={birthdate => setValues(current => ({ ...current, birthdate }))} /></View>
          <View style={{ flexBasis: '46%', flexGrow: 1, minWidth: 0 }}><Field compact label="Gender" placeholder="Optional" value={values.gender || ''} editable={!busy} onChangeText={gender => setValues(current => ({ ...current, gender }))} /></View>
        </View>
        <SettingsSaveBar onSave={save} busy={busy} />
      </SettingsSection></View>
      <View style={{ flex: 1, minWidth: 0, gap: 16 }}>
        <SettingsSection title="Primary address" description="Your default location for pickup and delivery."><Txt style={{ fontSize: 13, lineHeight: 22 }}>{address(profile.data) || 'No address saved'}</Txt><Button title="Edit address" compact outline onPress={() => { useLaundryDraft.getState().set({ address: null }); go('confirm-location'); }} /></SettingsSection>
        <SettingsSection title="Account access"><Button title="Change Password" compact outline onPress={() => go('change-password')} /><Button title="Delete Account" compact outline color={palette.danger} onPress={() => go('delete-account')} /></SettingsSection>
        <SettingsSection title="Connected accounts" description="Account linking is currently unavailable."><View style={{ flexDirection: 'row', gap: 12 }}><Txt style={{ flex: 1, fontSize: 12, color: palette.muted }}>Google · Unavailable</Txt><Txt style={{ flex: 1, fontSize: 12, color: palette.muted }}>Facebook · Unavailable</Txt></View></SettingsSection>
      </View>
    </View>
  </CustomerProfileFrame>;
  if (desktop && account) return <DesktopShopSettings title="Account information" description="Manage your personal details and shop verification records." active="account">
    <QueryState loading={profile.isLoading} error={profile.error} retry={() => profile.refetch()} />
    <SettingsSection title="Personal information" description="Keep your name and contact number current so we can reach you.">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: palette.line }}>
        <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: palette.soft, alignItems: 'center', justifyContent: 'center' }}><Txt style={{ fontSize: 18, fontWeight: '700', color: palette.primary }}>{(values.name || auth.user?.name || 'A').trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()}</Txt></View>
        <View style={{ flex: 1, minWidth: 0 }}><Txt style={{ fontSize: 15, fontWeight: '600' }}>{values.name || auth.user?.name}</Txt><Txt style={{ fontSize: 12, color: palette.muted }}>{values.email || auth.user?.email}</Txt></View>
        <Txt style={{ fontSize: 12, color: palette.muted }}>Account #{auth.user?.id}</Txt>
      </View>
      <View style={{ flexDirection: 'row', gap: 16 }}>{[{ key: 'name', label: 'Name' }, { key: 'phone', label: 'Contact Number' }, { key: 'email', label: 'Email Address' }].map(field => <View key={field.key} style={{ flex: 1, minWidth: 0 }}><Field compact label={field.label} keyboardType={field.key === 'phone' ? 'phone-pad' : field.key === 'email' ? 'email-address' : 'default'} value={values[field.key] || ''} editable={field.key !== 'email'} onChangeText={value => setValues(current => ({ ...current, [field.key]: value }))} />{field.key === 'email' && <Txt style={{ fontSize: 11, color: palette.muted, marginTop: 6 }}>Your sign-in email is read-only.</Txt>}</View>)}</View>
      <SettingsSaveBar onSave={save} busy={busy} />
    </SettingsSection>
    <ShopAccountCredibility compact />
    <Card style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16 }}><View style={{ flex: 1, gap: 2 }}><Txt style={{ fontSize: 14, fontWeight: '600' }}>Account access</Txt><Txt style={{ fontSize: 12, color: palette.muted }}>Manage your password or close your account.</Txt></View><Button title="Change Password" compact outline onPress={() => go('change-password')} /><Button title="Delete Account" compact outline color={palette.danger} onPress={() => go('delete-account')} /></Card>
  </DesktopShopSettings>;
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
            onPress={() => go("addresses")} />}
        </Card>
        {account ? (
          <ShopAccountCredibility />
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
  const shopDesktop = useDesktopShopSettings();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 900;
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
      toast.success({ title: "Password updated", message: "Use your new password next time you sign in." });
      if (!security) router.back();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  if (shopDesktop) return <DesktopShopSettings title={security ? 'Security' : 'Change password'} description="Manage the password you use to sign in to your account." active="security">
    <SettingsSection title="Change Password" description="Enter your current password and choose a new password with at least 6 characters.">
      <View style={{ maxWidth: 520, gap: 16 }}>
        <Field compact label="Current Password" password placeholder="Enter current password" value={current} onChangeText={setCurrent} autoComplete="current-password" />
        <Field compact label="New Password" password placeholder="Enter new password" value={password} onChangeText={setPassword} autoComplete="new-password" />
        {!security && <Field compact label="Confirm New Password" password placeholder="Confirm new password" value={confirm} onChangeText={setConfirm} autoComplete="new-password" />}
      </View>
      <SettingsSaveBar title={security ? 'Save' : 'Confirm'} onSave={save} busy={busy} />
    </SettingsSection>
    {security && <SettingsSection title="Two-factor Authentication" description="An additional verification step when signing in."><View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}><View style={{ flex: 1, gap: 4 }}><Txt style={{ fontSize: 12, fontWeight: '600', color: palette.muted }}>Not available yet</Txt><Txt style={{ fontSize: 13, color: palette.muted }}>Two-factor authentication is not available yet.</Txt></View><Switch value={false} disabled accessibilityLabel="Two-factor authentication is not available" trackColor={{ false: '#D1D5DB', true: palette.primary }} /></View></SettingsSection>}
  </DesktopShopSettings>;
  if (desktop) return <Screen title={security ? 'Security' : 'Change Password'} background={palette.surface} maxWidth={1120}>
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: 20 }}>
      <Card style={{ width: '100%', maxWidth: 680, padding: 28, gap: 20 }}>
        <View style={{ gap: 5 }}>
          <Txt style={{ fontSize: 19, lineHeight: 27, fontWeight: '700' }}>{security ? 'Account security' : 'Update your password'}</Txt>
          <Txt style={styles.muted}>{security ? 'Change your password or review sign-in security.' : 'Enter your current password, then choose a new password with at least 6 characters.'}</Txt>
        </View>
        {security && <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 12, backgroundColor: palette.soft, gap: 16 }}>
          <View style={{ flex: 1, gap: 3 }}><Txt style={{ fontWeight: '600' }}>Two-factor authentication</Txt><Txt style={styles.muted}>Not available yet.</Txt></View>
          <Switch value={false} disabled accessibilityLabel="Two-factor authentication is not available" trackColor={{ false: '#D1D5DB', true: palette.primary }} />
        </View>}
        <View style={{ width: '100%', maxWidth: 520, gap: 8 }}>
          <Field compact label="Current Password" password placeholder="Enter current password" value={current} onChangeText={setCurrent} autoComplete="current-password" />
          <Field compact label="New Password" password placeholder="Enter new password" value={password} onChangeText={setPassword} autoComplete="new-password" />
          {!security && <Field compact label="Confirm New Password" password placeholder="Confirm new password" value={confirm} onChangeText={setConfirm} autoComplete="new-password" />}
        </View>
        <View style={{ alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 16 }}>
          <Button title={security ? 'Save Changes' : 'Confirm'} busy={busy} onPress={save} style={{ minWidth: 180 }} />
        </View>
      </Card>
    </View>
  </Screen>;
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
  const desktop = useDesktopShopSettings();
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
  if (desktop) return <DesktopShopSettings title="Delete account" description="Review this permanent account action before continuing." active="account"><SettingsSection title="Permanently delete your account" description="This action cannot be undone."><View style={{ padding: 16, borderRadius: 12, backgroundColor: '#FFF1F2', gap: 8 }}><Txt style={{ fontSize: 14, fontWeight: '600', color: palette.danger }}>Are you sure you want to delete your account?</Txt><Txt style={{ fontSize: 13, color: palette.muted }}>Deleting your account removes your access to LabaRide and signs you out. Only continue if you intend to permanently close your account.</Txt></View><View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}><Button title="Cancel" compact outline onPress={() => router.back()} /><Button title="Continue" compact color={palette.danger} busy={busy} onPress={confirm} /></View></SettingsSection></DesktopShopSettings>;
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
  const { go, flowHref } = useFlowNavigation();
  const profile = useProfile();
  const user = useAuthStore((state) => state.user);
  const draft = useLaundryDraft();
  const cache = useQueryClient();
  const [defaultBusy, setDefaultBusy] = useState<number | null>(null);
  const [defaultError, setDefaultError] = useState('');
  const defaultLock = useRef(false);
  async function makeDefault(item: Partial<Profile>, index: number) {
    if (!user || defaultLock.current) return;
    defaultLock.current = true; setDefaultBusy(index); setDefaultError('');
    try {
      const result = await saveDefaultAddress(user.id, item, profile.data);
      cache.setQueryData(['user', user.id], result.profile);
      cache.setQueryData(['saved-addresses', user.id], result.entries);
      if (checkout || !draft.address || draft.address.id === user.id) draft.set({ address: null });
    } catch (failure) { setDefaultError(message(failure)); }
    finally { defaultLock.current = false; setDefaultBusy(null); }
  }
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
        <Txt style={styles.muted}>Used automatically for new orders. Select Set as default below to change it.</Txt>
        <MenuRow
          title={address(profile.data) || "No default address"}
          asset="locationblue.png"
          onPress={() => {
            draft.set({ address: profile.data });
            if (checkout) toast.info({ title: "Address selected", message: `Using ${profile.data?.address_type || "your default address"}.` });
            if (checkout) router.dismissTo(flowHref("checkout"));
            else go("confirm-location", { checkout: "false" });
          }}
        />
        {!!saved.data?.length && <Section title="Saved Addresses" />}
        <FormError error={defaultError} />
        {saved.data?.map((item, index) => (
          <View key={index} style={{ gap: 8 }}>
          <MenuRow
            key={index}
            title={address(item)}
            asset="locationblue.png"
            onPress={() => {
              draft.set({ address: item });
              if (checkout) toast.info({ title: "Address selected", message: `Using ${item.address_type || "your saved address"}.` });
              if (checkout) router.dismissTo(flowHref("checkout"));
              else go("confirm-location", { checkout: "false" });
            }}
          />
          <Button title={sameSavedAddress(item, profile.data) ? 'Default address' : 'Set as default'}
            disabled={defaultBusy !== null || sameSavedAddress(item, profile.data)} busy={defaultBusy === index}
            onPress={() => makeDefault(item, index)} />
          <Txt style={styles.muted}>Tap the address to {checkout ? 'use it for this order' : 'edit its details and map pin'}.</Txt>
          </View>
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
  const defaultLock = useRef(false);
  async function save(setAsDefault = false) {
    if (busy || defaultLock.current) return;
    const validation = addressError(values);
    if (validation) { setError(validation); return; }
    const payload = addressPayload(values);
    defaultLock.current = true; setBusy(true); setError(null);
    try {
      if (setAsDefault && user) {
        const result = await saveDefaultAddress(user.id, payload, profile.data);
        cache.setQueryData(['user', user.id], result.profile);
        cache.setQueryData(['saved-addresses', user.id], result.entries);
        draft.set({ address: null });
        router.dismissTo(flowHref(checkout ? 'checkout' : 'addresses'));
      } else if (stage === "add-address" && user) {
        const key = "labaride-addresses:" + user.id;
        const raw = await AsyncStorage.getItem(key);
        const entries: Partial<Profile>[] = raw ? JSON.parse(raw) : [];
        await AsyncStorage.setItem(key, JSON.stringify([...entries, payload]));
        draft.set({ address: payload });
        await cache.invalidateQueries({ queryKey: ["saved-addresses"] });
        if (checkout) router.dismissTo(flowHref("checkout"));
        else router.back();
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
    finally { defaultLock.current = false; setBusy(false); }
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
  return <Screen title={stage === "add-address" ? "Add New Address" : "Edit Address & Map Pin"} background={palette.surface}
    footer={<View style={{ gap: 8 }}><FormError error={error} />
      <Button title={stage === 'add-address' ? 'Save address' : checkout ? 'Use for this order' : 'Set as default'}
        color={palette.navy} busy={busy} onPress={() => save(stage !== 'add-address' && !checkout && !!user)} />
      {!!user && (stage === 'add-address' || checkout) && <Button title="Set as default" outline disabled={busy} onPress={() => save(true)} />}
    </View>}>
    <View style={styles.stack}>
      <QueryState loading={profile.isLoading} error={profile.error} retry={() => profile.refetch()} />
      <Card><Section title="Delivery Address" /><AddressFields values={values} setValues={setValues} /></Card>
    </View>
  </Screen>;
}
