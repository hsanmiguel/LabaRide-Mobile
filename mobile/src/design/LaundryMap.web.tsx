import { createElement, useState, useEffect } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, View } from "react-native";
import { Button, Txt, usePalette } from "./ui";
import { coordinates } from "./discovery";
import type { MapProps } from "./LaundryMap";
export default function LaundryMap({
  latitude: suppliedLatitude,
  longitude: suppliedLongitude,
  shops = [], onSelect,
}: MapProps) {
  const palette = usePalette();
  const [selectedId, setSelectedId] = useState<number>();
  const pinned = shops.filter(shop => coordinates(shop));
  const selected = pinned.find(shop => shop.id === selectedId);
  const point = coordinates(selected) || coordinates({ latitude: suppliedLatitude, longitude: suppliedLongitude }) || coordinates(pinned[0]);
  const latitude = point?.latitude ?? 13.6217;
  const longitude = point?.longitude ?? 123.1948;
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setLoaded(false); setFailed(false);
    const controller = new AbortController();
    const timer = setTimeout(() => { controller.abort(); setFailed(true); }, 12000);
    // Cross-origin iframe load events also fire for browser error pages. Probe
    // transport availability so a blocked provider has an actionable fallback.
    fetch("https://www.openstreetmap.org/export/embed.html", { method: "HEAD", mode: "no-cors", signal: controller.signal })
      .then(() => clearTimeout(timer))
      .catch(() => { clearTimeout(timer); if (!controller.signal.aborted) setFailed(true); });
    return () => { clearTimeout(timer); controller.abort(); };
  }, [latitude, longitude, attempt]);
  const bbox = `${longitude - 0.02},${latitude - 0.02},${longitude + 0.02},${latitude + 0.02}`;
  return (
    <View style={{ flex: 1, backgroundColor: palette.surface }}>
      <View style={{ flex: 1, minHeight: 140 }}>
      {failed ? <View style={{ flex: 1, padding: 16, justifyContent: "center", gap: 8 }}>
        <Txt style={{ color: palette.muted }}>Map unavailable. You can still browse shops below.</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Button title="Retry map" compact outline onPress={() => setAttempt(value => value + 1)} />
          <Button title="Open map" compact outline onPress={() => { void Linking.openURL(`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=14/${latitude}/${longitude}`); }} />
        </View>
      </View> : <>
      {!loaded && <View style={{ position: "absolute", top: 12, left: 12, padding: 8, backgroundColor: "white", zIndex: 1, borderRadius: 8 }}>
        <ActivityIndicator accessibilityLabel="Loading map" color={palette.primary} />
      </View>}
      {createElement("iframe", {
        key: attempt,
        title: "Laundry shop location",
        src: `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik${point ? `&marker=${latitude},${longitude}` : ""}`,
        style: {
          width: "100%",
          height: "100%",
          border: 0,
          position: "absolute",
          opacity: loaded ? 1 : 0,
        },
        onLoad: () => setLoaded(true),
        onError: () => setFailed(true),
        loading: "lazy",
      })}
      </>}
      </View>
      {!!pinned.length && <ScrollView horizontal style={{ flexGrow: 0 }} contentContainerStyle={{ padding: 8, gap: 8 }}>
        {pinned.map(shop => <Pressable key={shop.id} accessibilityRole="button" accessibilityLabel={`Locate ${shop.shopName}`}
          accessibilityState={{ selected: selectedId === shop.id }} onPress={() => setSelectedId(shop.id)}
          style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderColor: palette.line, backgroundColor: selectedId === shop.id ? palette.soft : "white" }}>
          <Txt numberOfLines={1} style={{ maxWidth: 180, color: palette.primary }}>{shop.shopName}</Txt>
        </Pressable>)}
        {selected && onSelect && <Pressable accessibilityRole="button" onPress={() => onSelect(selected)} style={{ padding: 12, borderRadius: 10, backgroundColor: palette.primary }}><Txt style={{ color: "white" }}>View shop</Txt></Pressable>}
      </ScrollView>}
    </View>
  );
}
