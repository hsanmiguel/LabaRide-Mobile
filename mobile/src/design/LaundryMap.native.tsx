import MapView, { Marker } from "react-native-maps";
import { useEffect, useRef } from "react";
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
  const latitude = suppliedLatitude == null ? 13.6217 : Number(suppliedLatitude);
  const longitude = suppliedLongitude == null ? 123.1948 : Number(suppliedLongitude);
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
      {onPin && <Marker coordinate={{ latitude, longitude }} />}
    </MapView>
  );
}
