import { View } from "react-native";
import { Asset } from "./ui";
import type { Shop } from "./data";
export interface MapProps {
  shops?: Shop[];
  latitude?: number | string | null;
  longitude?: number | string | null;
  onSelect?: (shop: Shop) => void;
  onPin?: (coordinate: { latitude: number; longitude: number }) => void;
}
export default function LaundryMap(_props: MapProps) {
  return (
    <View style={{ flex: 1 }}>
      <Asset name="maps.png" style={{ width: "100%", height: "100%" }} />
    </View>
  );
}
