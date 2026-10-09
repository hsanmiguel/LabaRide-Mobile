import { createElement, useState } from "react";
import { View } from "react-native";
import { Asset } from "./ui";
import type { MapProps } from "./LaundryMap";
export default function LaundryMap({
  latitude: suppliedLatitude,
  longitude: suppliedLongitude,
}: MapProps) {
  const latitude = suppliedLatitude == null ? 13.6217 : Number(suppliedLatitude);
  const longitude = suppliedLongitude == null ? 123.1948 : Number(suppliedLongitude);
  const [loaded, setLoaded] = useState(false);
  const bbox = `${longitude - 0.02},${latitude - 0.02},${longitude + 0.02},${latitude + 0.02}`;
  return (
    <View style={{ flex: 1, position: "relative", backgroundColor: "#F5F7F9" }}>
      <Asset
        name="maps.png"
        style={{ width: "100%", height: "100%", position: "absolute" }}
      />
      {createElement("iframe", {
        title: "Laundry shop location",
        src: `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`,
        style: {
          width: "100%",
          height: "100%",
          border: 0,
          position: "absolute",
          opacity: loaded ? 1 : 0,
        },
        onLoad: () => setLoaded(true),
        loading: "lazy",
      })}
    </View>
  );
}
