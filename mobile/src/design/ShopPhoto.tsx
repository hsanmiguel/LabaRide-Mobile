import { useState } from "react";
import { ActivityIndicator, Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Store, WashingMachine } from "lucide-react-native";
import { API_URL } from "../api/client";
import { Txt, usePalette } from "./ui";

export function shopPhotoUri(photoUrl?: string | null) {
  return photoUrl && /^\/api\/shops\/[1-9]\d*\/photo\?v=\d+$/.test(photoUrl)
    ? `${API_URL.replace(/\/$/, "")}${photoUrl}` : undefined;
}

export function ShopPhoto({ photoUrl, name, style }: { photoUrl?: string | null; name: string; style?: StyleProp<ViewStyle> }) {
  const palette = usePalette();
  const uri = shopPhotoUri(photoUrl);
  const [failed, setFailed] = useState<string>();
  const [loaded, setLoaded] = useState<string>();
  const showImage = !!uri && failed !== uri;
  return <View style={[{ aspectRatio: 1.55, backgroundColor: palette.soft, borderRadius: 18, overflow: "hidden" }, style]}>
    <View accessible accessibilityLabel={`Photo placeholder for ${name}`} style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 18, borderRadius: 20, backgroundColor: "#FFFFFFCC" }}>
        <Store size={36} color={palette.primary} strokeWidth={1.5} />
        <View style={{ width: 1, height: 32, backgroundColor: palette.line }} />
        <WashingMachine size={36} color={palette.primary} strokeWidth={1.5} />
      </View>
      {!showImage && <Txt style={{ color: palette.muted, fontSize: 12 }}>{uri ? "Shop photo unavailable" : "Shop photo coming soon"}</Txt>}
    </View>
    {showImage && <Image key={uri} source={{ uri }} resizeMode="cover" accessibilityLabel={`${name} shop photo`}
      style={StyleSheet.absoluteFill} onLoad={() => setLoaded(uri)} onError={() => setFailed(uri)} />}
    {showImage && loaded !== uri && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
      <ActivityIndicator accessibilityLabel="Loading shop photo" color={palette.primary} />
    </View>}
  </View>;
}
