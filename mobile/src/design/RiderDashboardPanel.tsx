import { useEffect, useRef, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing, Modal, Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { Txt, usePalette } from "./ui";

export function RiderDashboardPanel({ title, drawer = false, children, footer, onClose }: {
  title: string; drawer?: boolean; children: ReactNode; footer?: ReactNode; onClose: () => void;
}) {
  const palette = usePalette();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= 768;
  const closeButton = useRef<View>(null);
  const side = wide && drawer;
  const progress = useRef(new Animated.Value(1)).current;
  const closing = useRef(false);
  const reducedMotion = useRef(false);
  const finishClose = useRef(onClose);
  finishClose.current = onClose;
  useEffect(() => {
    let live = true;
    const open = (reduce: boolean) => {
      if (!live || closing.current) return;
      reducedMotion.current = reduce;
      Animated.timing(progress, { toValue: 0, duration: reduce ? 0 : 280, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web" })
        .start(({ finished }) => { if (finished && live && Platform.OS === "web") closeButton.current?.focus(); });
    };
    void AccessibilityInfo.isReduceMotionEnabled().then(open, () => open(false));
    return () => { live = false; progress.stopAnimation(); };
  }, [progress]);
  function dismiss() {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(progress, { toValue: 1, duration: reducedMotion.current ? 0 : 200, easing: Easing.in(Easing.cubic), useNativeDriver: Platform.OS !== "web" })
      .start(({ finished }) => { if (finished) finishClose.current(); });
  }
  return <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={dismiss}
    aria-labelledby="rider-panel-title">
    <View style={{ flex: 1, justifyContent: wide ? "center" : "flex-end", alignItems: side ? "flex-end" : "center" }}>
      <Animated.View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "#111827", opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }) }} />
      <Pressable accessibilityRole="button" accessibilityLabel={`Dismiss ${title}`} tabIndex={-1} onPress={dismiss}
        style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }} />
      <Animated.View testID="rider-dashboard-panel" accessibilityViewIsModal aria-labelledby="rider-panel-title" onAccessibilityEscape={dismiss}
        style={{ backgroundColor: "white", width: side ? 400 : wide ? Math.min(520, width - 48) : "100%",
          height: side ? "100%" : undefined, maxHeight: side ? height : height - Math.max(insets.top, 16) - (wide ? 32 : 0),
          paddingTop: side ? insets.top : 0, borderTopLeftRadius: side ? 0 : 24, borderTopRightRadius: side ? 0 : 24,
          borderBottomLeftRadius: wide && !side ? 24 : 0, borderBottomRightRadius: wide && !side ? 24 : 0, overflow: "hidden",
          transform: side ? [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 420] }) }]
            : [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, wide ? 24 : height] }) }],
          opacity: wide && !side ? progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) : 1 }}>
        {!wide && <View style={{ paddingTop: 10, alignItems: "center" }}><View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: palette.line }} /></View>}
        <View style={{ paddingHorizontal: 18, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: palette.line }}>
          <Txt nativeID="rider-panel-title" accessibilityRole="header" style={{ flex: 1, fontSize: 20, fontWeight: "700" }}>{title}</Txt>
          <Pressable ref={closeButton} accessibilityRole="button" accessibilityLabel={`Close ${title}`} onPress={dismiss}
            style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: palette.surface, alignItems: "center", justifyContent: "center" }}><X size={20} color={palette.primary} /></Pressable>
        </View>
        <ScrollView style={{ flexShrink: 1, ...(side ? { flex: 1 } : {}) }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18, gap: 18 }}>
          {children}
        </ScrollView>
        {!!footer && <View testID="rider-panel-footer" style={{ borderTopWidth: 1, borderTopColor: palette.line, padding: 18, paddingBottom: Math.max(insets.bottom, 18) }}>{footer}</View>}
      </Animated.View>
    </View>
  </Modal>;
}
