import MapView, { Marker } from "react-native-maps";
import { useEffect, useRef } from "react";
import type { MapProps } from "./LaundryMap";
import { Asset } from "./ui";
export default function LaundryMap({
  shops = [],
  latitude = 13.6217,
  longitude = 123.1948,
  onSelect,
  onPin,
}: MapProps) {
  const map = useRef<MapView>(null);
  useEffect(() => {
    map.current?.animateToRegion(
      { latitude, longitude, latitudeDelta: 0.035, longitudeDelta: 0.035 },
      300,
    );
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
            Number.isFinite(shop.latitude) && Number.isFinite(shop.longitude),
        )
        .map((shop) => (
          <Marker
            key={shop.id}
            coordinate={{
              latitude: shop.latitude!,
              longitude: shop.longitude!,
            }}
            title={shop.shopName}
            description={shop.address || shop.barangay}
            onPress={() => onSelect?.(shop)}
          >
            <Asset name="laundryiconmap.png" size={42} />
          </Marker>
        ))}
      {onPin && <Marker coordinate={{ latitude, longitude }} />}
    </MapView>
  );
}
