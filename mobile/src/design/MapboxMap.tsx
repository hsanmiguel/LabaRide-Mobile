import React, { useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Image,
  Pressable,
  Modal,
  Platform,
  StatusBar,
  TextInput,
  ScrollView,
} from "react-native";
import Mapbox from "@rnmapbox/maps";
import {
  Maximize2,
  Minimize2,
  ArrowLeft,
  MapPin,
  Search,
  X,
} from "lucide-react-native";
import type { MapProps } from "./LaundryMap";
import { Txt } from "./ui";
import { flutterAssets } from "./assets";

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

if (MAPBOX_TOKEN) {
  try {
    Mapbox.setAccessToken(MAPBOX_TOKEN);
  } catch {
    // Ignored in non-native runtimes
  }
}

const CAMSUR_CENTER = { latitude: 13.6217, longitude: 123.1948 };
const LOGO_SOURCE = flutterAssets["logosplash.jpg"];

function MapContent({
  cameraRef,
  validShops,
  centerLat,
  centerLng,
  onSelect,
  onPin,
}: {
  cameraRef?: React.RefObject<Mapbox.Camera | null>;
  validShops: Array<{
    id: number | string;
    parsedLat: number;
    parsedLng: number;
    [key: string]: unknown;
  }>;
  centerLat: number;
  centerLng: number;
  onSelect?: MapProps["onSelect"];
  onPin?: MapProps["onPin"];
}) {
  const localCameraRef = useRef<Mapbox.Camera>(null);
  const activeCameraRef = cameraRef || localCameraRef;

  return (
    <Mapbox.MapView
      style={styles.map}
      styleURL={Mapbox.StyleURL.Street}
      logoEnabled={false}
      attributionEnabled={false}
      scaleBarEnabled={false}
      onPress={(feature) => {
        if (onPin && feature.geometry && feature.geometry.type === "Point") {
          const coords = feature.geometry.coordinates as [number, number];
          onPin({ latitude: coords[1], longitude: coords[0] });
        }
      }}
    >
      <Mapbox.Camera
        ref={activeCameraRef}
        centerCoordinate={[centerLng, centerLat]}
        zoomLevel={13}
        animationMode="flyTo"
        animationDuration={1000}
      />

      {/* Shop markers with custom logo pin using MarkerView (native Android view annotations) */}
      {validShops.map((shop) => (
        <Mapbox.MarkerView
          key={String(shop.id)}
          id={`shop-${shop.id}`}
          coordinate={[shop.parsedLng, shop.parsedLat]}
          anchor={{ x: 0.5, y: 1.0 }}
          allowOverlap
        >
          <Pressable
            onPress={() => onSelect?.(shop as any)}
            style={styles.markerContainer}
          >
            <View style={styles.logoBubble}>
              <Image
                source={LOGO_SOURCE}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.arrow} />
          </Pressable>
        </Mapbox.MarkerView>
      ))}

      {/* User pin marker if in pin mode */}
      {Boolean(onPin) && (
        <Mapbox.MarkerView
          id="pinned-location"
          coordinate={[centerLng, centerLat]}
          anchor={{ x: 0.5, y: 0.5 }}
          allowOverlap
        >
          <View style={styles.pinBubble}>
            <Txt style={{ color: "white", fontSize: 16 }}>📍</Txt>
          </View>
        </Mapbox.MarkerView>
      )}
    </Mapbox.MapView>
  );
}

export default function MapboxMap({
  shops = [],
  latitude = CAMSUR_CENTER.latitude,
  longitude = CAMSUR_CENTER.longitude,
  onSelect,
  onPin,
  showExpand = true,
}: MapProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fullCameraRef = useRef<Mapbox.Camera>(null);

  const statusBarHeight =
    Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) : 0;

  const validShops = useMemo(
    () =>
      shops
        .map((s) => {
          const lat =
            typeof s.latitude === "number"
              ? s.latitude
              : parseFloat(String(s.latitude));
          const lng =
            typeof s.longitude === "number"
              ? s.longitude
              : parseFloat(String(s.longitude));
          return {
            ...s,
            parsedLat: lat,
            parsedLng: lng,
          };
        })
        .filter(
          (s) => Number.isFinite(s.parsedLat) && Number.isFinite(s.parsedLng),
        ),
    [shops],
  );

  const centerLng =
    typeof longitude === "number"
      ? longitude
      : parseFloat(String(longitude)) || CAMSUR_CENTER.longitude;
  const centerLat =
    typeof latitude === "number"
      ? latitude
      : parseFloat(String(latitude)) || CAMSUR_CENTER.latitude;

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return validShops.filter(
      (s) =>
        s.shopName.toLowerCase().includes(q) ||
        (s.address && s.address.toLowerCase().includes(q)) ||
        (s.barangay && s.barangay.toLowerCase().includes(q)) ||
        (s.street && s.street.toLowerCase().includes(q)),
    );
  }, [validShops, searchQuery]);

  function handleSelectSearchResult(shop: (typeof validShops)[0]) {
    setSearchQuery("");
    fullCameraRef.current?.setCamera({
      centerCoordinate: [shop.parsedLng, shop.parsedLat],
      zoomLevel: 15,
      animationDuration: 1000,
    });
  }

  return (
    <View style={styles.container}>
      <MapContent
        validShops={validShops}
        centerLat={centerLat}
        centerLng={centerLng}
        onSelect={onSelect}
        onPin={onPin}
      />

      {showExpand && (
        <Pressable
          style={styles.expandButton}
          onPress={() => {
            setSearchQuery("");
            setFullscreen(true);
          }}
          accessibilityLabel="Expand map to full screen"
        >
          <Maximize2 size={16} color="#1E54AB" />
          <Txt style={styles.expandText}>Expand</Txt>
        </Pressable>
      )}

      {/* Full-screen Map Modal */}
      <Modal
        visible={fullscreen}
        animationType="slide"
        onRequestClose={() => setFullscreen(false)}
      >
        <View style={[styles.fullscreenContainer, { paddingTop: statusBarHeight }]}>
          <View style={styles.fullscreenHeader}>
            <Pressable
              style={styles.closeButton}
              onPress={() => setFullscreen(false)}
              accessibilityLabel="Close full screen map"
            >
              <ArrowLeft size={22} color="#1F2937" />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Txt style={styles.headerTitle}>Laundry Map</Txt>
              <Txt style={styles.headerSubtitle}>
                Camarines Sur • {validShops.length} shops
              </Txt>
            </View>
            <Pressable
              style={styles.closeIconButton}
              onPress={() => setFullscreen(false)}
            >
              <Minimize2 size={20} color="#1E54AB" />
            </Pressable>
          </View>

          <View style={{ flex: 1, position: "relative" }}>
            <MapContent
              cameraRef={fullCameraRef}
              validShops={validShops}
              centerLat={centerLat}
              centerLng={centerLng}
              onSelect={(shop) => {
                setFullscreen(false);
                onSelect?.(shop);
              }}
              onPin={onPin}
            />

            {/* Floating search bar overlaid on map */}
            <View style={styles.floatingSearchWrapper}>
              <View style={styles.floatingSearchBar}>
                <Search size={17} color="#6B7280" />
                <TextInput
                  style={styles.floatingSearchInput}
                  placeholder="Search laundry shop..."
                  placeholderTextColor="#9CA3AF"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <Pressable
                    onPress={() => setSearchQuery("")}
                    hitSlop={8}
                    style={{ padding: 2 }}
                  >
                    <X size={16} color="#6B7280" />
                  </Pressable>
                )}
              </View>

              {/* Floating results dropdown */}
              {searchQuery.trim().length > 0 && (
                <View style={styles.resultsContainer}>
                  {searchResults.length > 0 ? (
                    <ScrollView
                      keyboardShouldPersistTaps="handled"
                      style={{ maxHeight: 240 }}
                    >
                      {searchResults.map((shop) => (
                        <Pressable
                          key={shop.id}
                          style={styles.resultItem}
                          onPress={() => handleSelectSearchResult(shop)}
                        >
                          <View style={styles.resultIcon}>
                            <MapPin size={15} color="white" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Txt style={styles.resultName}>{shop.shopName}</Txt>
                            <Txt style={styles.resultAddress} numberOfLines={1}>
                              {shop.address || shop.barangay || "Camarines Sur"}
                            </Txt>
                          </View>
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : (
                    <View style={styles.noResults}>
                      <Txt style={{ color: "#6B7280", fontSize: 13 }}>
                        No shops found for "{searchQuery}"
                      </Txt>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 12,
    position: "relative",
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 56,
  },
  logoBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    borderColor: "#1E54AB",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  logoImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#1E54AB",
    marginTop: -1,
  },
  pinBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#EF4444",
    borderWidth: 2,
    borderColor: "white",
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
  },
  expandButton: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  expandText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E54AB",
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "white",
  },
  fullscreenHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "white",
    zIndex: 20,
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
  },
  closeIconButton: {
    padding: 8,
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6B7280",
  },
  floatingSearchWrapper: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 16,
    zIndex: 30,
  },
  floatingSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "white",
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 11,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingSearchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1F2937",
    padding: 0,
  },
  resultsContainer: {
    marginTop: 6,
    backgroundColor: "white",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  resultIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1E54AB",
    alignItems: "center",
    justifyContent: "center",
  },
  resultName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
  },
  resultAddress: {
    fontSize: 12,
    color: "#6B7280",
  },
  noResults: {
    padding: 16,
    alignItems: "center",
  },
});
