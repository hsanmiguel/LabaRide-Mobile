import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ColorValue,
  type ImageStyle,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Search,
  Check,
} from "lucide-react-native";
import { router, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { flutterAssets } from "./assets";

export const palette = {
  navy: "#1A0066",
  blue: "#375DFB",
  welcome: "#2053B5",
  purple: "#5B32D7",
  ink: "#1F1F39",
  muted: "#6B7280",
  line: "#E5E7EB",
  surface: "#F5F7F9",
  lavender: "#E6E0FF",
  white: "#FFFFFF",
  danger: "#D32F2F",
};
export const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  stack: { gap: 16 },
  grow: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#F0F0F2",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  title: { fontSize: 24, color: palette.navy, fontWeight: "700" },
  heading: { fontSize: 18, color: palette.navy, fontWeight: "600" },
  muted: { color: palette.muted, fontSize: 14, lineHeight: 21 },
  divider: { height: 1, backgroundColor: palette.line, marginVertical: 8 },
});
export function Txt({ style, ...props }: TextProps) {
  const flat = StyleSheet.flatten(style) || {};
  const weight = Number(flat.fontWeight || 400);
  const family = flat.fontFamily === "Poppins" ? "Poppins" : "Inter";
  const fontFamily = `${family}${weight >= 700 ? "-Bold" : weight >= 600 ? "-SemiBold" : weight >= 500 ? "-Medium" : ""}`;
  return (
    <Text
      {...props}
      style={[
        { fontSize: 14, color: palette.ink },
        style,
        { fontFamily, fontWeight: "normal" },
      ]}
    />
  );
}
export function Asset({
  name,
  size = 24,
  style,
  tint,
}: {
  name: keyof typeof flutterAssets;
  size?: number;
  style?: StyleProp<ImageStyle>;
  tint?: ColorValue;
}) {
  return (
    <Image
      source={flutterAssets[name]}
      resizeMode="contain"
      style={[{ width: size, height: size, tintColor: tint }, style]}
    />
  );
}
export function Brand({
  white = false,
  compact = false,
}: {
  white?: boolean;
  compact?: boolean;
}) {
  return (
    <View style={[styles.row, compact ? undefined : styles.center]}>
      <Asset
        name={white ? "whitelogo.png" : "blacklogo.png"}
        size={compact ? 56 : 40}
      />
      {!compact && (
        <Txt
          style={{
            fontSize: 28,
            fontWeight: "600",
            color: white ? "white" : palette.navy,
          }}
        >
          LabaRide
        </Txt>
      )}
    </View>
  );
}
export function Button({
  title,
  onPress,
  busy,
  disabled,
  color = palette.blue,
  outline = false,
  round = false,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  color?: string;
  outline?: boolean;
  round?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 48,
          paddingHorizontal: 18,
          paddingVertical: 12,
          borderRadius: round ? 24 : 12,
          backgroundColor: outline ? "transparent" : color,
          borderColor: color,
          borderWidth: outline ? 1 : 0,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
          flexDirection: "row",
          gap: 10,
          justifyContent: "center",
          alignItems: "center",
        },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={outline ? color : "white"} />
      ) : (
        <>
          {icon}
          <Txt
            style={{
              color: outline ? color : "white",
              fontWeight: "600",
              fontSize: 16,
            }}
          >
            {title}
          </Txt>
        </>
      )}
    </Pressable>
  );
}
export function Field({
  label,
  password = false,
  style,
  ...props
}: TextInputProps & { label?: string; password?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ gap: 8, marginBottom: 16 }}>
      {!!label && <Txt style={{ color: "#545454" }}>{label}</Txt>}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#FAFAFA",
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "#F1F1F1",
        }}
      >
        <TextInput
          accessibilityLabel={label || props.placeholder}
          {...props}
          secureTextEntry={password && !visible}
          placeholderTextColor="#9CA3AF"
          style={[
            {
              flex: 1,
              minHeight: 50,
              paddingHorizontal: 16,
              paddingVertical: 14,
              fontFamily: "Inter",
              fontSize: 14,
              color: palette.ink,
            },
            style,
          ]}
        />
        {password && (
          <Pressable
            accessibilityLabel={visible ? "Hide password" : "Show password"}
            onPress={() => setVisible(!visible)}
            style={{ padding: 14 }}
          >
            {visible ? (
              <Eye size={20} color="#9CA3AF" />
            ) : (
              <EyeOff size={20} color="#9CA3AF" />
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}
export function Header({
  title,
  dark = false,
  back = true,
  right,
}: {
  title: string;
  dark?: boolean;
  back?: boolean;
  right?: React.ReactNode;
}) {
  const segments = useSegments() as string[];
  const home = segments[0] === "shop" ? "/shop/home" : "/(user)/home";
  return (
    <View
      style={{
        backgroundColor: dark ? palette.navy : "white",
        minHeight: 60,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      {back && (
        <Pressable
          accessibilityLabel="Back"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace(home)
          }
          hitSlop={12}
        >
          <ArrowLeft size={24} color={dark ? "white" : palette.navy} />
        </Pressable>
      )}
      <Txt
        style={{
          flex: 1,
          fontSize: 20,
          fontWeight: "600",
          color: dark ? "white" : palette.navy,
        }}
      >
        {title}
      </Txt>
      {right}
    </View>
  );
}
export function Screen({
  title,
  children,
  footer,
  dark = false,
  background = "white",
  back = true,
  scroll = true,
  padded = true,
  right,
}: {
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  dark?: boolean;
  background?: string;
  back?: boolean;
  scroll?: boolean;
  padded?: boolean;
  right?: React.ReactNode;
}) {
  const segments = useSegments() as string[];
  const inTab =
    segments[0] === "shop" ||
    (segments[0] === "(user)" &&
      !segments.some((segment) => ["order", "orders", "shops"].includes(segment)));
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: dark ? palette.navy : background }}
      edges={
        inTab ? ["top", "left", "right"] : ["top", "left", "right", "bottom"]
      }
    >
      <StatusBar
        style={
          dark ||
          [
            "#1E54AB",
            "#48006A",
            palette.navy,
            palette.purple,
            "#003366",
          ].includes(background)
            ? "light"
            : "dark"
        }
      />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: background }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {!!title && (
          <Header title={title} dark={dark} back={back} right={right} />
        )}
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: padded ? 16 : 0, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, padding: padded ? 16 : 0 }}>{children}</View>
        )}
        {footer && (
          <View
            style={{
              padding: 16,
              backgroundColor: "white",
              borderTopWidth: 1,
              borderTopColor: palette.line,
            }}
          >
            {footer}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Section({
  title,
  action,
  onPress,
  light = false,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
  light?: boolean;
}) {
  return (
    <View style={[styles.between, { marginVertical: 12 }]}>
      <Txt
        style={{
          fontSize: 16,
          fontWeight: "700",
          color: light ? "white" : palette.navy,
        }}
      >
        {title}
      </Txt>
      {!!action && (
        <Pressable onPress={onPress}>
          <Txt style={{ color: light ? "white" : palette.blue, fontSize: 12 }}>
            {action}
          </Txt>
        </Pressable>
      )}
    </View>
  );
}
export function MenuRow({
  title,
  detail,
  asset,
  onPress,
  color = palette.navy,
}: {
  title: string;
  detail?: string;
  asset?: keyof typeof flutterAssets;
  onPress?: () => void;
  color?: string;
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={[
        styles.row,
        {
          padding: 16,
          borderWidth: 1,
          borderColor: palette.line,
          borderRadius: 12,
          backgroundColor: "white",
        },
      ]}
    >
      {asset && <Asset name={asset} tint={color} />}
      <View style={styles.grow}>
        <Txt style={{ fontWeight: "500", color }}>{title}</Txt>
        {!!detail && (
          <Txt style={[styles.muted, { marginTop: 4 }]}>{detail}</Txt>
        )}
      </View>
      {onPress && <ChevronRight size={18} color="#9CA3AF" />}
    </Pressable>
  );
}
export function SearchBox({
  value,
  onChangeText,
  onPress,
  placeholder = "Search for laundry shop",
}: {
  value?: string;
  onChangeText?: (value: string) => void;
  onPress?: () => void;
  placeholder?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.row,
        {
          backgroundColor: "white",
          borderRadius: 12,
          paddingHorizontal: 16,
          minHeight: 52,
          borderWidth: 1,
          borderColor: "#F0F0F2",
        },
      ]}
    >
      <Search size={20} color="#9CA3AF" />
      <TextInput
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={onChangeText}
        editable={!onPress}
        pointerEvents={onPress ? "none" : "auto"}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        style={{
          flex: 1,
          minHeight: 50,
          fontFamily: "Inter",
          color: palette.ink,
        }}
      />
    </Pressable>
  );
}
export function TabsRow({
  items,
  value,
  onChange,
  color = palette.blue,
}: {
  items: string[];
  value: string;
  onChange: (value: string) => void;
  color?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: palette.line,
        marginBottom: 16,
      }}
    >
      {items.map((item) => (
        <Pressable
          key={item}
          onPress={() => onChange(item)}
          style={{
            flex: 1,
            paddingVertical: 14,
            borderBottomWidth: 3,
            borderBottomColor: value === item ? color : "transparent",
          }}
        >
          <Txt
            style={{
              textAlign: "center",
              fontWeight: "600",
              color: value === item ? color : "#9CA3AF",
            }}
          >
            {item}
          </Txt>
        </Pressable>
      ))}
    </View>
  );
}
export function Choice({
  label,
  selected,
  onPress,
  square = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  square?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={square ? "checkbox" : "radio"}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.row, { paddingVertical: 12 }]}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: square ? 4 : 11,
          borderWidth: 1.5,
          borderColor: selected ? palette.blue : "#9CA3AF",
          backgroundColor: selected ? palette.blue : "white",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected && <Check size={14} color="white" />}
      </View>
      <Txt style={styles.grow}>{label}</Txt>
    </Pressable>
  );
}
export function Empty({
  title,
  message,
  action,
  onPress,
}: {
  title: string;
  message?: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={{ alignItems: "center", padding: 28, gap: 12 }}>
      <Asset name="washingmachine.png" size={48} tint={palette.navy} />
      <Txt style={styles.heading}>{title}</Txt>
      {message && (
        <Txt style={[styles.muted, { textAlign: "center" }]}>{message}</Txt>
      )}
      {!!action && onPress && <Button title={action} onPress={onPress} round />}
    </View>
  );
}
export function PriceRow({
  label,
  value,
  total = false,
}: {
  label: string;
  value: string;
  total?: boolean;
}) {
  return (
    <View style={[styles.between, { paddingVertical: 6 }]}>
      <Txt
        style={{
          color: total ? palette.navy : palette.muted,
          fontWeight: total ? "700" : "400",
        }}
      >
        {label}
      </Txt>
      <Txt
        style={{
          color: palette.navy,
          fontWeight: total ? "700" : "500",
          fontSize: total ? 18 : 14,
        }}
      >
        {value}
      </Txt>
    </View>
  );
}
export const money = (value: number | string | undefined) =>
  `₱${Number(value || 0).toFixed(2)}`;
