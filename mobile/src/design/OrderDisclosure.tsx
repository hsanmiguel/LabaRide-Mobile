import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { Txt, usePalette } from "./ui";

export function OrderDisclosure({ title, children }: { title: string; children: ReactNode }) {
  const palette = usePalette();
  const [open, setOpen] = useState(false);
  const [visited, setVisited] = useState(false);
  const Icon = open ? ChevronUp : ChevronDown;
  return <View style={{ borderWidth: 1, borderColor: palette.line, borderRadius: 12, backgroundColor: "white", overflow: "hidden" }}>
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded: open }}
      onPress={() => { setVisited(true); setOpen(value => !value); }}
      style={{ paddingHorizontal: 16, paddingVertical: 12, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <Txt style={{ fontSize: 14, fontWeight: "600" }}>{title}</Txt><Icon size={18} color={palette.primary} />
    </Pressable>
    {visited && <View style={{ display: open ? "flex" : "none", padding: 16, paddingTop: 0, gap: 12 }}>{children}</View>}
  </View>;
}
