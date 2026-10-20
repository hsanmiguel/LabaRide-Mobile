import { useEffect, useRef, useSyncExternalStore } from "react";
import { Modal, Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { CircleHelp, Info, Trash2, X } from "lucide-react-native";
import { usePathname } from "expo-router";
import { useAuthStore } from "../store/authStore";
import { Button, Txt, usePalette } from "./ui";
import { dismissAllDialogs, dismissConfirmations, getDialog, settleDialog, subscribeToDialogs } from "./dialog-service";

export function AppDialogHost() {
  const dialog = useSyncExternalStore(subscribeToDialogs, getDialog, getDialog);
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const userId = useAuthStore(state => state.user?.id);
  const previous = useRef({ pathname, userId });
  const safeAction = useRef<View>(null);
  useEffect(() => {
    if (previous.current.userId !== userId) dismissAllDialogs();
    else if (previous.current.pathname !== pathname) dismissConfirmations();
    previous.current = { pathname, userId };
  }, [pathname, userId]);
  useEffect(() => () => dismissAllDialogs(), []);
  if (!dialog) return null;
  const confirmation = dialog.kind === "confirm";
  const accent = dialog.destructive ? palette.danger : palette.primary;
  const Icon = dialog.destructive ? Trash2 : confirmation ? CircleHelp : Info;
  const cancel = () => settleDialog(dialog.id, false);
  return <Modal key={dialog.id} visible transparent animationType="fade" statusBarTranslucent
    aria-labelledby="app-dialog-title" aria-describedby="app-dialog-message"
    onRequestClose={cancel} onShow={() => { if (Platform.OS === "web") safeAction.current?.focus(); }}>
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: "rgba(18, 24, 40, 0.48)" }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss dialog" tabIndex={-1} focusable={false} onPress={cancel}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} />
      <View testID="app-dialog" accessibilityViewIsModal aria-labelledby="app-dialog-title" aria-describedby="app-dialog-message"
        style={{ width: "100%", maxWidth: 440, maxHeight: "90%", padding: width < 400 ? 22 : 28, borderRadius: 24,
          backgroundColor: "white", borderWidth: 1, borderColor: palette.line, shadowColor: "#101828", shadowOpacity: 0.18,
          shadowRadius: 32, shadowOffset: { width: 0, height: 16 }, elevation: 12 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 20 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: dialog.destructive ? "#FFF1F0" : palette.soft,
              alignItems: "center", justifyContent: "center" }}><Icon size={25} color={accent} strokeWidth={1.8} /></View>
            <Pressable ref={confirmation ? undefined : safeAction} accessibilityRole="button" accessibilityLabel="Close dialog" onPress={cancel}
              style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? palette.soft : "white" })}>
              <X size={19} color={palette.muted} />
            </Pressable>
          </View>
          <View style={{ gap: 10 }}>
            <Txt nativeID="app-dialog-title" accessibilityRole="header" style={{ fontSize: 23, lineHeight: 31, fontWeight: "700", color: palette.ink }}>{dialog.title}</Txt>
            <Txt nativeID="app-dialog-message" style={{ color: palette.muted, lineHeight: 24 }}>{dialog.message}</Txt>
          </View>
          <View style={{ flexDirection: width < 400 ? "column" : "row", gap: 12, paddingTop: 4 }}>
            {confirmation && <Pressable ref={safeAction} accessibilityRole="button" accessibilityLabel="Cancel" onPress={cancel}
              style={({ pressed }) => ({ flex: width < 400 ? undefined : 1, minHeight: 46, paddingVertical: 12, paddingHorizontal: 18,
                borderRadius: 12, borderWidth: 1, borderColor: palette.line, backgroundColor: pressed ? palette.surface : "white", alignItems: "center", justifyContent: "center" })}>
              <Txt style={{ fontWeight: "600", color: palette.ink }}>Cancel</Txt>
            </Pressable>}
            <Button title={dialog.confirmLabel || (confirmation ? "Continue" : "Got it")} color={accent}
              onPress={() => settleDialog(dialog.id, true)} style={{ flex: width < 400 ? undefined : 1, minHeight: 46 }} />
          </View>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
