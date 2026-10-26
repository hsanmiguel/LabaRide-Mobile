import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  useWindowDimensions,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { ArrowRight, Bike, UserRound, CheckCircle2, WashingMachine, Sparkles } from "lucide-react-native";
import { type Href, router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore";
import {
  Asset,
  Brand,
  Button,
  Choice,
  Field,
  Screen,
  Txt,
  usePalette,
  styles,
} from "./ui";
import { api, fail, go, replaceFlow, unavailable, notify, message, type Profile } from "./data";

import { AddressFields, FormError } from "./AddressFields";
import { addressValues, addressError, addressPayload } from "./address";
import PickerField from "./PickerField";
import { signupError, validBirthdate } from "./form-values";

export function OnboardingScreen({ how = false }: { how?: boolean }) {
  const palette = usePalette();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.welcome }}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 60 }}>
        <Txt
          style={{
            color: "white",
            fontSize: 32,
            lineHeight: 40,
            fontWeight: "600",
          }}
        >
          {how ? "How It Works" : "Welcome to\nLabaRide!"}
        </Txt>
        {how ? (
          <View style={{ marginTop: 20, gap: 10 }}>
            {["Book a Service", "Rider Pickup", "Fresh Delivery"].map(
              (text) => (
                <View key={text} style={styles.row}>
                  <View
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: "#64B5F6",
                    }}
                  />
                  <Txt style={{ color: "white", fontWeight: "500" }}>
                    {text}
                  </Txt>
                </View>
              ),
            )}
          </View>
        ) : (
          <Txt style={{ color: "white", marginTop: 12, fontWeight: "500" }}>
            Find local laundry shops and manage your laundry in one place.
          </Txt>
        )}
        <View style={{ flex: 1, marginVertical: 40, justifyContent: "center" }}>
          <Asset
            name={how ? "how.png" : "welcome.png"}
            style={{ width: "100%", height: "100%" }}
          />
        </View>
        <View style={[styles.between, { paddingBottom: 40 }]}>
          <Pressable accessibilityRole="button" onPress={() => router.replace("/(auth)/login")}>
            <Txt style={{ color: "rgba(255,255,255,.7)", fontSize: 16 }}>
              Skip
            </Txt>
          </Pressable>
          <Pressable accessibilityRole="button"
            accessibilityLabel={how ? "Continue to login" : "How it works"}
            onPress={() =>
              how ? router.replace("/(auth)/login") : go("how-it-works")
            }
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: "white",
              alignItems: "center",
              justifyContent: "center",
              elevation: 5,
            }}
          >
            <ArrowRight size={24} color={palette.welcome} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
export function SplashDesign() {
  const palette = usePalette();
  const { user, isGuest } = useAuthStore();
  const proceed = () =>
    router.replace(
      user
        ? user.isAdmin ? "/admin" : user.isRider ? "/rider" : user.riderApplicationStatus ? "/rider-application" as Href : user.isShopOwner
          ? "/shop/home"
          : "/(user)/home"
        : isGuest
          ? "/(user)/home"
          : "/(onboarding)/welcome",
    );
  useEffect(() => {
    const timer = setTimeout(proceed, 2000);
    return () => clearTimeout(timer);
  }, [user, isGuest]);
  return (
    <Pressable accessibilityRole="button"
      onPress={proceed}
      style={{
        flex: 1,
        backgroundColor: "white",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Asset name="logosplash.jpg" size={150} />
      <Txt
        style={{
          fontFamily: "Poppins",
          fontSize: 32,
          fontWeight: "700",
          color: palette.navy,
          marginTop: 10,
        }}
      >
        LabaRide
      </Txt>
    </Pressable>
  );
}
export function LoginDesign({ initialSignup = false, initialRecovery = false }: { initialSignup?: boolean; initialRecovery?: boolean } = {}) {
  const [recoveringPassword, setRecoveringPassword] = useState(initialRecovery);
  const [creatingAccount, setCreatingAccount] = useState(initialSignup);
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const palette = usePalette();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const { setAuth, setGuest } = useAuthStore();
  const cache = useQueryClient();
  async function login() {
    if (busy) return;
    if (!email.trim() || !password)
      return notify("Log In", "Please fill in all fields");
    setBusy(true);
    try {
      const result = await api.post<{ user: Profile; token: string }>(
        "/auth/login",
        { email: email.trim(), password },
      );
      cache.clear();
      await setAuth(result.user, result.token);
      router.replace(result.user.isAdmin ? "/admin" : result.user.isRider ? "/rider" : result.user.riderApplicationStatus ? "/rider-application" as Href : result.user.isShopOwner ? "/shop/home" : "/(user)/home");
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.grow}>
        <KeyboardAvoidingView
          style={styles.grow}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: wide ? 32 : 12, width: "100%", flexGrow: 1, justifyContent: "center" }}
          >
            <View style={{ width: "100%", maxWidth: 1120, alignSelf: "center", flexDirection: wide ? "row" : "column", borderRadius: 24, overflow: "hidden", backgroundColor: "white", borderWidth: 1, borderColor: palette.line }}>
              <LinearGradient colors={[palette.primary, "#17346F"]} style={{ width: wide ? "46%" : "100%", minHeight: wide ? 760 : 190, padding: wide ? 40 : 24, justifyContent: "space-between", overflow: "hidden" }}>
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><Sparkles size={16} color="#C8DEFF" /><Txt style={{ color: "#DEEBFF", fontSize: 10, letterSpacing: 2 }}>A FRESHER EVERYDAY</Txt></View>
                <View style={{ marginTop: 24, paddingRight: wide ? 0 : 124 }}><Txt style={{ color: "white", fontSize: wide ? 46 : 24, lineHeight: wide ? 58 : 36, fontWeight: "700", letterSpacing: -1 }}>Less laundry.{'\n'}More living.</Txt>{wide && <Txt style={{ color: "#DEEBFF", lineHeight: 25, marginTop: 20 }}>Fresh clothes, trusted local shops, and pickup at your doorstep. Make room for what matters.</Txt>}</View>
                {<View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ alignItems: "center", justifyContent: "center", height: wide ? 270 : 128, width: wide ? "100%" : 128, position: wide ? "relative" : "absolute", right: wide ? undefined : 16, bottom: wide ? undefined : 12 }}><View style={{ position: "absolute", width: wide ? 260 : 124, height: wide ? 260 : 124, borderRadius: 130, backgroundColor: "rgba(255,255,255,.08)" }} /><View style={{ width: wide ? 180 : 94, height: wide ? 206 : 108, borderRadius: wide ? 24 : 15, backgroundColor: "#EDF4FF", borderWidth: wide ? 6 : 3, borderColor: "#C8DEFF", alignItems: "center", justifyContent: "center", transform: [{ rotate: "-6deg" }] }}><WashingMachine size={wide ? 120 : 64} strokeWidth={1.2} color={palette.primary} /><View style={{ position: "absolute", right: wide ? -28 : -12, bottom: 10, padding: wide ? 12 : 7, backgroundColor: "white", borderRadius: 16 }}><Sparkles size={wide ? 28 : 18} color={palette.accent} /></View></View></View>}
                {wide && <Txt style={{ color: "#DEEBFF", fontSize: 12 }}>Your laundry day, made lighter.</Txt>}
              </LinearGradient>
              <View style={{ flex: 1, minWidth: 0, padding: wide ? 42 : 24 }}>
              <View accessible accessibilityLabel="LabaRide ? Laundry pickup and delivery" style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 8 }}>
                <View style={{ width: 76, height: 76, borderRadius: 20, backgroundColor: palette.soft, borderWidth: 1, borderColor: palette.line, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Asset name="blacklogo.png" size={64} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt style={{ color: palette.primary, fontSize: wide ? 32 : 28, fontWeight: "700", letterSpacing: -0.8 }}>LabaRide</Txt>
                  <Txt style={{ color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 2 }}>Laundry pickup & delivery</Txt>
                </View>
              </View>
              <View style={{ marginTop: 24, marginBottom: 24 }}>
                <Txt accessibilityRole="header" style={{ fontSize: 32, fontWeight: "700", color: palette.ink, letterSpacing: -0.8 }}>{recoveringPassword ? "Forgot password?" : creatingAccount ? "Create an account." : "Welcome back."}</Txt>
                <Txt style={{ color: palette.muted, marginTop: 8, lineHeight: 22 }}>{recoveringPassword ? "Enter your email to reset your password." : creatingAccount ? "Get started with a fresher laundry day." : "Sign in to make your next laundry day easier."}</Txt>
              </View>
              <View accessibilityRole="tablist" style={{ flexDirection: "row", backgroundColor: palette.surface, borderRadius: 12, padding: 4, marginBottom: 24, borderWidth: 1, borderColor: palette.line }}>
                {[false, true].map(signup => <Pressable key={String(signup)} accessibilityRole="tab" accessibilityState={{ selected: creatingAccount === signup }} onPress={() => { setCreatingAccount(signup); setRecoveringPassword(false); }} style={{ flex: 1, minHeight: 44, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: creatingAccount === signup ? "white" : "transparent" }}><Txt style={{ color: creatingAccount === signup ? palette.primary : palette.muted, fontSize: 13, fontWeight: creatingAccount === signup ? "600" : "400" }}>{signup ? "Create account" : "Sign in"}</Txt></Pressable>)}
              </View>
              {recoveringPassword ? <View>
                <Field label="Email address" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
                <Button title="Reset Password" onPress={() => unavailable("Password recovery")} />
                <Pressable accessibilityRole="button" onPress={() => { setRecoveringPassword(false); setCreatingAccount(false); }} style={{ minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 16 }}><Txt style={{ color: palette.primary, fontWeight: "600" }}>Back to sign in</Txt></Pressable>
              </View> : creatingAccount ? <SignupForm /> : <>
              <Field
                label="Email address"
                appearance="outlined"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
              <Field
                label="Password"
                appearance="outlined"
                placeholder="Enter password"
                value={password}
                onChangeText={setPassword}
                password
                onSubmitEditing={login}
                autoComplete="current-password"
              />
              <Button
                title="Log In"
                onPress={login}
                busy={busy}
                color={palette.primary}
                round
                style={{ marginTop: 8, minHeight: 48 }}
              />
              <View style={[styles.between, { marginTop: 8 }]}>
                <View style={{ flex: 1 }}>
                  <Choice
                    label="Remember me"
                    square
                    selected={remember}
                    onPress={() => setRemember(!remember)}
                  />
                </View>
                <Pressable accessibilityRole="button" onPress={() => setRecoveringPassword(true)}>
                  <Txt style={{ fontSize: 12, color: palette.primary }}>
                    Forgot Password?
                  </Txt>
                </Pressable>
              </View>
              <View
                style={[
                  styles.row,
                  styles.center,
                  { marginTop: 24, flexWrap: "wrap", gap: 8 },
                ]}
              >
                <Txt style={styles.muted}>Don't have an account?</Txt>
                <Pressable accessibilityRole="button" onPress={() => setCreatingAccount(true)}>
                  <Txt style={{ color: palette.primary, fontWeight: "600" }}>
                    Sign Up
                  </Txt>
                </Pressable>
              </View>
              <View style={{ marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#E4E9F2', gap: 8 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Apply as a Rider"
                onPress={() => router.push('/(auth)/rider-signup' as Href)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
                  borderRadius: 14, borderWidth: 1, borderColor: '#DCE5F5', backgroundColor: pressed ? '#E7EEFB' : '#F6F8FC' })}>
                <View style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 11, backgroundColor: '#E9EFFF', alignItems: 'center', justifyContent: 'center' }}><Bike size={21} color="#2457AD" /></View>
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}><Txt style={{ color: '#2457AD', fontSize: 14, fontWeight: '600' }}>Apply as a Rider</Txt><Txt style={{ color: '#626B7D', fontSize: 12, lineHeight: 18 }}>Join our pickup and delivery team</Txt></View>
                <ArrowRight size={18} color="#2457AD" style={{ flexShrink: 0 }} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Continue as Guest"
                style={({ pressed }) => ({ minHeight: 44, borderRadius: 12,
                  backgroundColor: pressed ? "#F5F7FC" : "white",
                  flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10 })}
                onPress={() => {
                  cache.clear();
                  setGuest();
                  router.replace("/(user)/home");
                }}
              >
                <UserRound size={17} color="#626B7D" />
                <Txt style={{ color: "#626B7D", fontSize: 14, fontWeight: "500" }}>Continue as Guest</Txt>
              </Pressable>
              </View>
              </>}
              <Txt style={{ textAlign: "center", color: palette.muted, fontSize: 11, marginTop: 24, paddingTop: 18, borderTopWidth: 1, borderTopColor: palette.line }}>Fresh clothes. More time for you.</Txt>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
export function SignupDesign() {
  return <LoginDesign initialSignup />;
}
function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (busy) return;
    const validation = signupError({ name, email, password, confirmPassword });
    if (validation) { setError(validation); return; }
    setError(null);
    setBusy(true);
    try {
      const result = await api.post<{ user: Profile; token: string }>(
        "/auth/signup",
        { name: name.trim(), email: email.trim(), password, confirmPassword },
      );
      await useAuthStore.getState().setAuth(result.user, result.token);
      go("user-details");
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View>
        <Field
          label="Name"
          placeholder="Enter full name"
          value={name}
          onChangeText={setName}
          autoComplete="name"
        />
        <Field
          label="Email"
          placeholder="Enter email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Field
          label="Password"
          placeholder="Enter password"
          value={password}
          onChangeText={setPassword}
          password
          autoComplete="new-password"
        />
        <Field
          label="Confirm Password"
          placeholder="Re-enter password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          password
          autoComplete="new-password"
          onSubmitEditing={submit}
        />
        <FormError error={error} />
        <Button
          title="Next"
          onPress={submit}
          busy={busy}
          style={{ marginTop: 16 }}
        />
    </View>
  );
}
export function UserDetailsDesign() {
  const [values, setValues] = useState<Record<string, string>>({
    phone: "",
    birthdate: "",
    gender: "",
    ...addressValues(),
  });
  const [error, setError] = useState<string | null>(null);
  const [createShop, setCreateShop] = useState(false);
  const [busy, setBusy] = useState(false);
  const cache = useQueryClient();
  async function submit() {
    if (busy) return;
    const validation = !values.phone?.trim() || !values.birthdate || !values.gender ? "Please fill in your contact number, birthdate, and gender." :
      !validBirthdate(values.birthdate) ? "Choose a valid birthdate that is not in the future." : addressError(values);
    if (validation) { setError(validation); return; }
    setError(null);
    setBusy(true);
    try {
      const user = await api.put<Profile>(
        `/users/${useAuthStore.getState().user!.id}`,
        { phone: values.phone, birthdate: values.birthdate, gender: values.gender, ...addressPayload(values) },
      );
      await useAuthStore
        .getState()
        .setAuth(user, useAuthStore.getState().token!);
      await cache.invalidateQueries({ queryKey: ["user"] });
      replaceFlow(createShop ? "register-shop" : "registration-complete");
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  const field = (key: string, label: string, placeholder: string) => (
    <Field
      key={key}
      label={label}
      placeholder={placeholder}
      value={values[key]}
      onChangeText={(v) => setValues({ ...values, [key]: v })}
      keyboardType={key === "phone" ? "phone-pad" : "default"}
    />
  );
  return (
    <Screen>
      <View style={{ padding: 8, paddingTop: 24 }}>
        <Brand compact />
        <Txt style={[styles.title, { fontSize: 30, marginVertical: 24 }]}>
          Set up your details
        </Txt>
        <Txt style={[styles.heading, { marginBottom: 16 }]}>
          Personal Information
        </Txt>
        {field("phone", "Contact Number", "+63 9XX XXX XXXX")}
        <PickerField label="Birthdate *" mode="date" value={values.birthdate} maximumDate={new Date()}
          onChange={birthdate => setValues(current => ({ ...current, birthdate }))} />
        <Txt style={styles.muted}>Gender</Txt>
        <View style={[styles.row, { flexWrap: "wrap", marginBottom: 24 }]}>
          {["Male", "Female", "Other"].map((g) => (
            <Choice
              key={g}
              label={g}
              selected={values.gender === g}
              onPress={() => setValues({ ...values, gender: g })}
            />
          ))}
        </View>
        <Txt style={[styles.heading, { marginBottom: 16 }]}>Address</Txt>
        <AddressFields values={values} setValues={setValues} />
        <Choice
          square
          label="Want to create a laundry shop?"
          selected={createShop}
          onPress={() => setCreateShop(!createShop)}
        />
        <FormError error={error} />
        <Button
          title={createShop ? "Next: Shop Setup" : "Complete Registration"}
          busy={busy}
          onPress={submit}
          style={{ marginTop: 24 }}
        />
      </View>
    </Screen>
  );
}
export function SuccessDesign({
  title,
  subtitle,
  action = "Continue",
  onPress,
  purple = false,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onPress?: () => void;
  purple?: boolean;
}) {
  const palette = usePalette();
  return (
    <Screen scroll={false}>
      <View style={[styles.grow, styles.center, { gap: 20, padding: 24 }]}>
        <Asset
          name={purple ? "DeclineOrderIcon/purplelogo.png" : "logosplash.jpg"}
          size={140}
        />
        <Txt style={[styles.title, { textAlign: "center" }]}>{title}</Txt>
        {subtitle && (
          <Txt style={[styles.muted, { textAlign: "center" }]}>{subtitle}</Txt>
        )}
        {onPress && (
          <Button
            title={action}
            color={palette.navy}
            onPress={onPress}
            style={{ width: "100%", marginTop: 20 }}
          />
        )}
      </View>
    </Screen>
  );
}
export function RecoveryDesign({
  stage = "forgot-password",
  email: initialEmail = "",
}: {
  stage?: string;
  email?: string;
}) {
  const palette = usePalette();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const titles: Record<string, string> = {
    "forgot-password": "Forgot password",
    "verify-email": "Check your email",
    "password-reset": "Password Reset",
    "new-password": "Set a new password",
  };
  if (stage === "password-changed")
    return (
      <SuccessDesign
        title="Password Changed"
        action="Log In"
        onPress={() => router.replace("/(auth)/login")}
      />
    );
  if (stage === "forgot-password") return <LoginDesign initialRecovery />;
  return (
    <Screen>
      <View style={{ padding: 8, paddingTop: 40 }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Brand compact />
        </Pressable>
        <Txt style={[styles.title, { marginTop: 32, marginBottom: 8 }]}>
          {titles[stage]}
        </Txt>
        <Txt style={[styles.muted, { marginBottom: 32 }]}>
          {stage === "forgot-password"
            ? "Please enter your email to reset the password"
            : stage === "verify-email"
              ? `Enter the 5 digit code from the email sent to ${email}.`
              : stage === "password-reset"
                ? "Click confirm to set a new password."
                : "Create a new password. Ensure it differs from previous ones for security"}
        </Txt>
        {stage === "forgot-password" && (
          <>
            <Field
              label="Your Email"
              placeholder="example@gmail.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <Button
              title="Reset Password"
              onPress={() => unavailable("Password recovery")}
            />
          </>
        )}
        {stage === "verify-email" && (
          <>
            <CodeInput length={5} value={code} onChange={setCode} />
            <Button
              title="Verify Code"
              disabled={code.length !== 5}
              onPress={() => unavailable("Verify email")}
              style={{ marginTop: 32 }}
            />
            <Pressable accessibilityRole="button"
              onPress={() => unavailable("Resend email")}
              style={{ marginTop: 24 }}
            >
              <Txt style={{ textAlign: "center", color: palette.blue }}>
                Haven't received the email? Resend email
              </Txt>
            </Pressable>
          </>
        )}
        {stage === "password-reset" && (
          <>
            <CheckCircle2 size={64} color={palette.blue} />
            <Button
              title="Confirm"
              onPress={() => go("new-password")}
              style={{ marginTop: 32 }}
            />
          </>
        )}
        {stage === "new-password" && (
          <>
            <Field
              label="Password"
              placeholder="Enter password"
              password
              value={password}
              onChangeText={setPassword}
            />
            <Field
              label="Confirm Password"
              placeholder="Confirm password"
              password
              value={confirm}
              onChangeText={setConfirm}
            />
            <Button
              title="Confirm"
              disabled={password.length < 6 || password !== confirm}
              onPress={() => unavailable("Password recovery")}
            />
          </>
        )}
      </View>
    </Screen>
  );
}
export function CodeInput({
  length,
  value,
  onChange,
}: {
  length: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const palette = usePalette();
  return (
    <View style={{ position: "relative" }}>
      <View style={[styles.row, { gap: 8 }]}>
        {Array.from({ length }, (_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 58,
              borderWidth: 1,
              borderColor: value[i] ? palette.blue : palette.line,
              borderRadius: 12,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Txt style={{ fontSize: 24, fontWeight: "600" }}>
              {value[i] || ""}
            </Txt>
          </View>
        ))}
      </View>
      <TextInput
        accessibilityLabel={`${length} digit verification code`}
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, "").slice(0, length))}
        keyboardType="number-pad"
        maxLength={length}
        autoComplete="one-time-code"
        style={{ position: "absolute", inset: 0, opacity: 0.01, fontSize: 24 }}
      />
    </View>
  );
}
