import MapView, { Marker } from "react-native-maps";
import { useEffect, useRef } from "react";
import { AccessibilityInfo } from "react-native";
import { coordinates } from "./discovery";
import { usePalette } from "./theme";
import type { MapProps } from "./LaundryMap";
import { Asset } from "./ui";
import { formatAddress } from "./address";
export default function LaundryMap({
  shops = [],
  latitude: suppliedLatitude,
  longitude: suppliedLongitude,
  onSelect,
  onPin,
}: MapProps) {
  const palette = usePalette();
  const point = coordinates({ latitude: suppliedLatitude, longitude: suppliedLongitude }) || coordinates(shops.find(shop => coordinates(shop)));
  const latitude = point?.latitude ?? 13.6217;
  const longitude = point?.longitude ?? 123.1948;
  const map = useRef<MapView>(null);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (active) map.current?.animateToRegion({ latitude, longitude, latitudeDelta: 0.035, longitudeDelta: 0.035 }, reduced ? 0 : 300);
    });
    return () => { active = false; };
  }, [latitude, longitude]);
  return (
    <MapView
      ref={map}
      style={{ flex: 1 }}
      initialRegion={{
        latitude,
        longitude,
        latitudeDelta: 0.035,
        longitudeDelta: 0.035,
      }}
      onPress={(e) => onPin?.(e.nativeEvent.coordinate)}
      showsUserLocation
    >
      {shops
        .filter(
          (shop) =>
            shop.latitude != null && shop.longitude != null &&
            Number.isFinite(Number(shop.latitude)) && Number.isFinite(Number(shop.longitude)),
        )
        .map((shop) => (
          <Marker
            key={shop.id}
            coordinate={{
              latitude: Number(shop.latitude),
              longitude: Number(shop.longitude),
            }}
            title={shop.shopName}
            description={formatAddress(shop)}
            onPress={() => onSelect?.(shop)}
          >
            <Asset name="laundryiconmap.png" size={42} />
          </Marker>
        ))}
      {onPin && point && <Marker pinColor={palette.primary} coordinate={{ latitude, longitude }} />}
    </MapView>
  );
}
