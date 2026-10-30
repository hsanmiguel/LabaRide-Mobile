import React, { useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View, useWindowDimensions, type ColorValue, type ImageStyle, type StyleProp,
  type TextInputProps, type TextProps, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, ChevronRight, Eye, EyeOff, Search, Check, WashingMachine } from "lucide-react-native";
import { router, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { flutterAssets } from "./assets";
import { interfaceIcons } from "./icons";
import { usePalette } from "./theme";
import { useWebAccessibility } from "./web-accessibility";
import type { Service } from "./data";
export { usePalette } from "./theme";
type AssetName = keyof typeof flutterAssets | keyof typeof interfaceIcons;
const brandBlue = '#2457AD';

export const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  between: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 },
  stack: { gap: 20 }, grow: { flex: 1, minWidth: 0 },
  center: { alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 20, gap: 12, borderWidth: 1, borderColor: "#E4E9F2" },
  title: { fontSize: 26, lineHeight: 36, color: "#202033", fontWeight: "700" },
  heading: { fontSize: 18, lineHeight: 26, color: "#202033", fontWeight: "600" },
  muted: { color: "#626B7D", fontSize: 14, lineHeight: 22 },
  divider: { height: 1, backgroundColor: "#E4E9F2", marginVertical: 8 },
});
export function Txt({ style, ...props }: TextProps) {
  const flat = StyleSheet.flatten(style) || {};
  const weight = Number(flat.fontWeight || 400);
  const fontFamily = `Inter${weight >= 700 ? "-Bold" : weight >= 600 ? "-SemiBold" : weight >= 500 ? "-Medium" : ""}`;
  return <Text {...props} style={[{ fontSize: 14, lineHeight: 22, color: "#202033", flexShrink: 1 }, style,
    { fontFamily, fontWeight: "normal" }, flat.fontSize && !flat.lineHeight ? { lineHeight: Math.ceil(flat.fontSize * 1.4) } : undefined]} />;
}
export function Asset({ name, size = 24, style, tint }: { name: AssetName; size?: number; style?: StyleProp<ImageStyle>; tint?: ColorValue }) {
  const palette = usePalette();
  const Icon = interfaceIcons[name as keyof typeof interfaceIcons];
  if (Icon) return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={[{ width: size, height: size, alignItems: "center", justifyContent: "center", flexShrink: 0 }, style as StyleProp<ViewStyle>]}>
    <Icon size={size} color={tint || palette.primary} strokeWidth={1.8} />
  </View>;
  return <Image source={flutterAssets[name as keyof typeof flutterAssets]} resizeMode="contain" style={[{ width: size, height: size, tintColor: tint }, style]} />;
}
export function Brand({ white = false, compact = false }: { white?: boolean; compact?: boolean }) {
  const palette = usePalette();
  return <View style={[styles.row, compact ? undefined : styles.center]}>
    <Asset name={white ? "whitelogo.png" : "blacklogo.png"} size={40} />
    {!compact && <Txt style={{ fontSize: 26, fontWeight: "700", color: white ? "white" : brandBlue }}>LabaRide</Txt>}
  </View>;
}
export function Button({ title, onPress, busy, disabled, color, textColor, outline = false, round = false, compact = false, icon, style }: {
  title: string; onPress: () => void; busy?: boolean; disabled?: boolean; color?: string;
  textColor?: string; outline?: boolean; round?: boolean; compact?: boolean; icon?: React.ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const palette = usePalette();
  const accent = color || palette.primary;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
    disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [{
      minHeight: 44, paddingHorizontal: compact ? 14 : 20, paddingVertical: compact ? 10 : 12,
      borderRadius: round ? 24 : 12, backgroundColor: outline ? "white" : pressed && accent === palette.primary ? palette.hover : accent,
      borderColor: accent, borderWidth: 1, opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
      flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center", flexShrink: 1,
    }, style]}>
    {busy ? <ActivityIndicator accessibilityLabel={`${title}, please wait`} color={outline ? accent : "white"} /> : <>
      {icon}<Txt style={{ color: textColor || (outline ? accent : "white"), fontWeight: "600", fontSize: 14, textAlign: "center" }}>{title}</Txt>
    </>}
  </Pressable>;
}
export function IconButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  const palette = usePalette();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center",
      backgroundColor: pressed ? palette.soft : "white", borderWidth: 1, borderColor: palette.line })}>{children}</Pressable>;
}
export function Field({ label, password = false, suffix, style, appearance = "outlined", ...props }: TextInputProps & { label?: string; password?: boolean; suffix?: string; appearance?: "outlined" | "soft" }) {
  const palette = usePalette();
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  return <View style={{ gap: 8, marginBottom: 16 }}>
    {!!label && <Txt style={{ fontWeight: "500" }}>{label}</Txt>}
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: appearance === "soft" ? "#FAFAFA" : "white", borderRadius: 12, borderWidth: 1, borderColor: focused ? palette.primary : appearance === "soft" ? "#F1F1F1" : "#8A94A6" }}>
      <TextInput accessibilityLabel={label || props.placeholder} {...props} secureTextEntry={password && !visible}
        onFocus={event => { setFocused(true); props.onFocus?.(event); }} onBlur={event => { setFocused(false); props.onBlur?.(event); }}
        placeholderTextColor={palette.muted} style={[{ flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: 16, paddingVertical: 12,
          fontFamily: "Inter", fontSize: 16, color: palette.ink }, style]} />
      {!!suffix && <Txt style={{ color: palette.muted, paddingRight: 16 }}>{suffix}</Txt>}
      {password && <Pressable accessibilityRole="button" accessibilityLabel={visible ? "Hide password" : "Show password"} onPress={() => setVisible(!visible)} style={{ padding: 14 }}>
        {visible ? <Eye size={20} color={palette.muted} /> : <EyeOff size={20} color={palette.muted} />}
      </Pressable>}
    </View>
  </View>;
}
export function Header({ title, dark = false, back = true, right, branded = false }: { title: string; dark?: boolean; back?: boolean; right?: React.ReactNode; branded?: boolean }) {
  const palette = usePalette();
  const segments = useSegments() as string[];
  const home = segments[0] === "shop" ? "/shop/home" : "/(user)/home";
  return <View style={{ backgroundColor: dark ? palette.primary : "white", borderBottomWidth: 1, borderBottomColor: palette.line }}>
    <View style={{ width: "100%", maxWidth: 1200, alignSelf: "center", minHeight: 72, paddingHorizontal: 20, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
      {back && <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace(home)}
        style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><ArrowLeft size={22} color={dark ? "white" : palette.primary} /></Pressable>}
      {branded ? <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Asset name={dark ? 'whitelogo.png' : 'blacklogo.png'} size={36} style={{ flexShrink: 0 }} />
        <View style={{ flex: 1, minWidth: 0, gap: 1 }}><Txt numberOfLines={1} style={{ fontSize: 20, lineHeight: 26, fontWeight: '700', color: dark ? 'white' : brandBlue }}>LabaRide</Txt><Txt accessibilityRole="header" numberOfLines={1} style={{ fontSize: 12, lineHeight: 18, color: dark ? 'white' : palette.muted }}>{title}</Txt></View>
      </View> : <Txt accessibilityRole="header" style={{ flex: 1, fontSize: 22, fontWeight: "700", color: dark ? "white" : palette.ink }}>{title}</Txt>}{right}
    </View>
  </View>;
}
export function Screen({ title, children, footer, dark, background, back = true, scroll = true, padded = true, right, brandedHeader = false }: {
  title?: string; children: React.ReactNode; footer?: React.ReactNode; dark?: boolean; background?: string;
  back?: boolean; scroll?: boolean; padded?: boolean; right?: React.ReactNode;
  brandedHeader?: boolean;
}) {
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const segments = useSegments() as string[];
  const darkHeader = dark ?? (segments[0] === "shop" && !!title);
  const inTab = segments[0] === "admin" || segments[0] === "rider" || segments[0] === "shop" || (segments[0] === "(user)" && !segments.some(s => ["order", "orders", "shops"].includes(s)));
  useWebAccessibility(palette.primary);
  const content = { width: "100%" as const, maxWidth: 1200, alignSelf: "center" as const, padding: padded ? width >= 768 ? 32 : 20 : 0, paddingBottom: padded ? 32 : 0, flexGrow: 1 };
  return <SafeAreaView style={{ flex: 1, backgroundColor: darkHeader ? palette.primary : background || palette.surface }} edges={inTab ? ["top", "left", "right"] : ["top", "left", "right", "bottom"]}>
    <StatusBar style={darkHeader ? "light" : "dark"} />
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: background || palette.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {!!title && <Header title={title} dark={darkHeader} back={back} right={right} branded={brandedHeader} />}
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={content} showsVerticalScrollIndicator={false}>{children}</ScrollView> : <View style={[content, { flex: 1 }]}>{children}</View>}
      {footer && <View style={{ backgroundColor: "white", borderTopWidth: 1, borderTopColor: palette.line }}><View style={{ width: "100%", maxWidth: 1200, alignSelf: "center", padding: 20 }}>{footer}</View></View>}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
export function Card({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const palette = usePalette();
  return <View testID={testID} style={[styles.card, { borderColor: palette.line }, style]}>{children}</View>;
}
export function Section({ title, action, onPress, light = false }: { title: string; action?: string; onPress?: () => void; light?: boolean }) {
  const palette = usePalette();
  return <View style={[styles.between, { marginTop: 8, marginBottom: 12 }]}><Txt accessibilityRole="header" style={{ fontSize: 18, fontWeight: "700", color: light ? "white" : palette.ink }}>{title}</Txt>
    {!!action && onPress && <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 4 }}><Txt style={{ color: light ? "white" : palette.primary, fontWeight: "600" }}>{action}</Txt></Pressable>}
  </View>;
}
export function MenuRow({ title, detail, asset, onPress, color }: { title: string; detail?: string; asset?: AssetName; onPress?: () => void; color?: string }) {
  const palette = usePalette();
  const accent = color || palette.primary;
  return <Pressable accessibilityRole={onPress ? "button" : undefined} disabled={!onPress} onPress={onPress}
    style={({ pressed }) => [styles.row, { minHeight: 64, padding: 16, borderWidth: 1, borderColor: palette.line, borderRadius: 12, backgroundColor: pressed ? palette.soft : "white" }]}>
    {asset && <Asset name={asset} tint={accent} />}<View style={styles.grow}><Txt style={{ fontWeight: "600", color: accent }}>{title}</Txt>{!!detail && <Txt style={[styles.muted, { marginTop: 4 }]}>{detail}</Txt>}</View>
    {onPress && <ChevronRight size={18} color={palette.muted} />}
  </Pressable>;
}
export function SearchBox({ value, onChangeText, onPress, placeholder = "Search laundry shops" }: { value?: string; onChangeText?: (value: string) => void; onPress?: () => void; placeholder?: string }) {
  const palette = usePalette();
  const [focused, setFocused] = useState(false);
  const content = <><Search size={20} color={palette.primary} />{onPress ? <Txt style={{ color: palette.muted }}>{placeholder}</Txt> : <TextInput accessibilityLabel={placeholder} value={value} onChangeText={onChangeText} placeholder={placeholder}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholderTextColor={palette.muted} style={{ flex: 1, minWidth: 0, minHeight: 50, fontSize: 16, fontFamily: "Inter", color: palette.ink }} />}</>;
  const style = [styles.row, { backgroundColor: "white", borderRadius: 12, paddingHorizontal: 16, minHeight: 52, borderWidth: 1, borderColor: focused ? palette.primary : palette.line }];
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={placeholder} onPress={onPress} style={style}>{content}</Pressable> : <View style={style}>{content}</View>;
}
export function TabsRow({ items, value, onChange, color }: { items: string[]; value: string; onChange: (value: string) => void; color?: string }) {
  const palette = usePalette();
  const accent = color || palette.primary;
  return <View accessibilityRole="tablist" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>{items.map(item =>
    <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: value === item }} aria-selected={value === item} onPress={() => onChange(item)} style={{ minHeight: 44, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
      backgroundColor: value === item ? palette.soft : "white", borderColor: value === item ? accent : palette.line }}><Txt style={{ fontWeight: "600", color: value === item ? accent : palette.muted }}>{item}</Txt></Pressable>)}
  </View>;
}
export function Choice({ label, selected, onPress, square = false }: { label: string; selected: boolean; onPress: () => void; square?: boolean }) {
  const palette = usePalette();
  return <Pressable accessibilityRole={square ? "checkbox" : "radio"} accessibilityState={{ checked: selected }} onPress={onPress} style={[styles.row, { minHeight: 44, paddingVertical: 12 }]}>
    <View style={{ width: 22, height: 22, borderRadius: square ? 6 : 11, borderWidth: 1.5, borderColor: selected ? palette.primary : palette.muted, backgroundColor: selected ? palette.primary : "white", alignItems: "center", justifyContent: "center" }}>{selected && <Check size={14} color="white" />}</View>
    <Txt style={styles.grow}>{label}</Txt>
  </Pressable>;
}
export function Empty({ title, message, action, onPress }: { title: string; message?: string; action?: string; onPress?: () => void }) {
  const palette = usePalette();
  return <View style={{ alignItems: "center", padding: 28, gap: 12 }}><View style={{ padding: 16, borderRadius: 20, backgroundColor: palette.soft }}><WashingMachine size={28} color={palette.primary} /></View>
    <Txt style={[styles.heading, { textAlign: "center" }]}>{title}</Txt>{message && <Txt style={[styles.muted, { textAlign: "center", maxWidth: 440 }]}>{message}</Txt>}{!!action && onPress && <Button title={action} onPress={onPress} />}
  </View>;
}
export function PriceRow({ label, value, total = false }: { label: string; value: string; total?: boolean }) {
  const palette = usePalette();
  return <View style={[styles.between, { paddingVertical: 8 }]}><Txt style={{ color: total ? palette.ink : palette.muted, fontWeight: total ? "700" : "400" }}>{label}</Txt><Txt style={{ color: total ? palette.primary : palette.ink, fontWeight: total ? "700" : "500", fontSize: total ? 20 : 14 }}>{value}</Txt></View>;
}
export const money = (value: number | string | undefined) => `₱${Number(value || 0).toFixed(2)}`;
export function servicePriceLabel(service: Service) {
  return service.packageKilos != null ? `${money(service.price)} / load (up to ${Number(service.packageKilos)} kg)` : `${money(service.price)} / kg`;
}
