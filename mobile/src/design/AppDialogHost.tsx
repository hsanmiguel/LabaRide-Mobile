import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { AccessibilityInfo, Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { CircleHelp, Info, LogOut, Trash2, X } from "lucide-react-native";
import { BlurView } from "expo-blur";
import { usePathname } from "expo-router";
import { useAuthStore } from "../store/authStore";
import { Button, Txt, usePalette } from "./ui";
import { dismissAllDialogs, dismissConfirmations, getDialog, settleDialog, subscribeToDialogs } from "./dialog-service";

export function AppDialogHost({ blurTarget }: { blurTarget?: RefObject<View | null> }) {
  const dialog = useSyncExternalStore(subscribeToDialogs, getDialog, getDialog);
  const [presented, setPresented] = useState(dialog);
  const [reduceMotion, setReduceMotion] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const userId = useAuthStore(state => state.user?.id);
  const previous = useRef({ pathname, userId });
  const safeAction = useRef<View>(null);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(enabled => { if (mounted) setReduceMotion(enabled); });
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { mounted = false; listener.remove(); };
  }, []);
  useEffect(() => {
    if (dialog) setPresented(dialog);
    const animation = Animated.timing(opacity, { toValue: dialog ? 1 : 0,
      duration: reduceMotion ? 0 : dialog ? 180 : 140, useNativeDriver: Platform.OS !== "web" });
    animation.start(({ finished }) => { if (finished && !dialog) setPresented(null); });
    return () => animation.stop();
  }, [dialog?.id, reduceMotion, opacity]);
  useEffect(() => {
    if (previous.current.userId !== userId) dismissAllDialogs();
    else if (previous.current.pathname !== pathname) dismissConfirmations();
    previous.current = { pathname, userId };
  }, [pathname, userId]);
  useEffect(() => () => dismissAllDialogs(), []);
  const current = dialog || presented;
  if (!current) return null;
  const confirmation = current.kind === "confirm";
  const accent = current.destructive ? palette.danger : palette.primary;
  const Icon = current.icon === "logout" ? LogOut : current.destructive ? Trash2 : confirmation ? CircleHelp : Info;
  const disabled = !dialog || !!current.busy;
  const cancel = () => { if (!disabled) settleDialog(current.id, false); };
  return <Modal visible transparent animationType="none" statusBarTranslucent
    aria-labelledby="app-dialog-title" aria-describedby="app-dialog-message"
    onRequestClose={cancel} onShow={() => { if (Platform.OS === "web") safeAction.current?.focus(); }}>
    <Animated.View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20, opacity }}>
      {current.backdrop === "blur" && <BlurView testID="dialog-backdrop-blur" pointerEvents="none" accessible={false}
        intensity={32} tint="default" blurTarget={Platform.OS === "android" ? blurTarget : undefined}
        blurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined} style={StyleSheet.absoluteFill} />}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: current.backdrop === "blur" ? "rgba(18, 24, 40, 0.28)" : "rgba(18, 24, 40, 0.48)" }]} />
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss dialog" tabIndex={-1} focusable={false} disabled={disabled} onPress={cancel}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} />
      <Animated.View testID="app-dialog" accessibilityViewIsModal aria-labelledby="app-dialog-title" aria-describedby="app-dialog-message"
        style={{ width: "100%", maxWidth: 440, maxHeight: "90%", padding: width < 400 ? 22 : 28, borderRadius: 24,
          backgroundColor: "white", borderWidth: 1, borderColor: palette.line, shadowColor: "#101828", shadowOpacity: 0.18,
          shadowRadius: 32, shadowOffset: { width: 0, height: 16 }, elevation: 12,
          transform: [{ scale: opacity.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }] }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 20 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: current.destructive ? "#FFF1F0" : palette.soft,
              alignItems: "center", justifyContent: "center" }}><Icon size={25} color={accent} strokeWidth={1.8} /></View>
            <Pressable ref={confirmation ? undefined : safeAction} accessibilityRole="button" accessibilityLabel="Close dialog" disabled={disabled} onPress={cancel}
              style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : 1, backgroundColor: pressed ? palette.soft : "white" })}>
              <X size={19} color={palette.muted} />
            </Pressable>
          </View>
          <View style={{ gap: 10 }}>
            <Txt nativeID="app-dialog-title" accessibilityRole="header" style={{ fontSize: 23, lineHeight: 31, fontWeight: "700", color: palette.ink }}>{current.title}</Txt>
            <Txt nativeID="app-dialog-message" style={{ color: palette.muted, lineHeight: 24 }}>{current.message}</Txt>
          </View>
          {!!current.error && <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={{ padding: 12, borderRadius: 10, backgroundColor: "#FFF1F0" }}>
            <Txt style={{ color: palette.danger, fontSize: 13, lineHeight: 21 }}>{current.error}</Txt>
          </View>}
          <View style={{ flexDirection: width < 400 ? "column" : "row", gap: 12, paddingTop: 4 }}>
            {confirmation && <Pressable ref={safeAction} accessibilityRole="button" accessibilityLabel="Cancel" disabled={disabled} onPress={cancel}
              style={({ pressed }) => ({ flex: width < 400 ? undefined : 1, minHeight: 46, paddingVertical: 12, paddingHorizontal: 18,
                borderRadius: 12, borderWidth: 1, borderColor: palette.line, backgroundColor: pressed ? palette.surface : "white", opacity: disabled ? 0.5 : 1, alignItems: "center", justifyContent: "center" })}>
              <Txt style={{ fontWeight: "600", color: palette.ink }}>Cancel</Txt>
            </Pressable>}
            <Button title={current.confirmLabel || (confirmation ? "Continue" : "Got it")} color={accent} busy={!!current.busy} disabled={disabled}
              onPress={() => settleDialog(current.id, true)} style={{ flex: width < 400 ? undefined : 1, minHeight: 46 }} />
          </View>
        </ScrollView>
      </Animated.View>
    </Animated.View>
  </Modal>;
}
