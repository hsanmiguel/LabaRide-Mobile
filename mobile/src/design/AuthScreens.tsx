import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight, UserRound, CheckCircle2 } from "lucide-react-native";
import { router } from "expo-router";
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
  palette,
  styles,
} from "./ui";
import { api, fail, go, replaceFlow, unavailable, notify, message, type Profile } from "./data";

import { AddressFields, FormError } from "./AddressFields";
import { addressValues, addressError, addressPayload } from "./address";
import PickerField from "./PickerField";
import { signupError, validBirthdate } from "./form-values";

export function OnboardingScreen({ how = false }: { how?: boolean }) {
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
            Switch between rides and laundry in a tap.
          </Txt>
        )}
        <View style={{ flex: 1, marginVertical: 40, justifyContent: "center" }}>
          <Asset
            name={how ? "how.png" : "welcome.png"}
            style={{ width: "100%", height: "100%" }}
          />
        </View>
        <View style={[styles.between, { paddingBottom: 40 }]}>
          <Pressable onPress={() => router.replace("/(auth)/login")}>
            <Txt style={{ color: "rgba(255,255,255,.7)", fontSize: 16 }}>
              Skip
            </Txt>
          </Pressable>
          <Pressable
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
  const { user, isGuest } = useAuthStore();
  const proceed = () =>
    router.replace(
      user
        ? user.isShopOwner
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
    <Pressable
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
export function LoginDesign() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const { setAuth, setGuest } = useAuthStore();
  const cache = useQueryClient();
  async function login() {
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
      router.replace(result.user.isShopOwner ? "/shop/home" : "/(user)/home");
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <LinearGradient colors={["#0289E0", "#1B086D"]} style={{ flex: 1 }}>
      <SafeAreaView style={styles.grow}>
        <KeyboardAvoidingView
          style={styles.grow}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={{ padding: 16, paddingBottom: 8 }}>
            <Brand white />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, paddingTop: 8, flexGrow: 1 }}
          >
            <View
              style={{
                backgroundColor: "white",
                borderRadius: 20,
                padding: 24,
              }}
            >
              <View style={[styles.center, { marginBottom: 32 }]}>
                <Asset name="Login.png" style={{ width: 120, height: 32 }} />
              </View>
              <Field
                label="Email"
                placeholder="Enter email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
              <Field
                label="Password"
                placeholder="Enter password"
                value={password}
                onChangeText={setPassword}
                password
                autoComplete="current-password"
              />
              <Button
                title="Log In"
                onPress={login}
                busy={busy}
                round
                style={{ marginTop: 8 }}
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
                <Pressable onPress={() => go("forgot-password")}>
                  <Txt style={{ fontSize: 12, color: palette.blue }}>
                    Forgot Password?
                  </Txt>
                </Pressable>
              </View>
              <View
                style={[
                  styles.row,
                  styles.center,
                  { marginTop: 24, flexWrap: "wrap", gap: 4 },
                ]}
              >
                <Txt style={styles.muted}>Don't have an account?</Txt>
                <Pressable onPress={() => router.push("/(auth)/signup")}>
                  <Txt style={{ color: palette.blue, fontWeight: "600" }}>
                    Sign Up
                  </Txt>
                </Pressable>
              </View>
              <Button
                title="Continue as Guest"
                outline
                round
                color="#9CA3AF"
                icon={<UserRound size={20} color="#6B7280" />}
                style={{ marginTop: 32 }}
                onPress={() => {
                  cache.clear();
                  setGuest();
                  router.replace("/(user)/home");
                }}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}
export function SignupDesign() {
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
    <Screen>
      <View style={{ padding: 8, paddingTop: 40 }}>
        <Pressable onPress={() => router.back()}>
          <Brand compact />
        </Pressable>
        <Txt
          style={{
            fontSize: 33,
            fontWeight: "700",
            color: palette.navy,
            marginTop: 24,
            marginBottom: 40,
          }}
        >
          Create an account
        </Txt>
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
    </Screen>
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
  return (
    <Screen>
      <View style={{ padding: 8, paddingTop: 40 }}>
        <Pressable onPress={() => router.back()}>
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
            <Pressable
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
