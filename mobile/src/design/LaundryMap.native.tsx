import React, { useMemo, useRef, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
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

const CAMSUR_CENTER = { latitude: 13.6217, longitude: 123.1948 };

const WASHING_MACHINE_B64 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAUCAYAAACEYr13AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAEESURBVHgBtVMBDcIwEPwWBFQACcUJOAAFDAUEBXQOwEFxgAScUAgCKoAw7qEkZbRLtoVLmv2vf5f7/01otVpWVO2ISFE7OEHCiLEqzkg0dYOXPcgMJeNMEE341OMmSOqJYZxUROdU/FcHOYEj+p9dvBV8OIajQ6qQ11jFL5CUV29NqlirwuB+m3WAS9tAVu59d8wKPDI2Qd7yUFkE7eyzAjdvTxmyofenrl2tpnELEfmFe+J/+RIYqWKaIwOOHeqo5kdgQLQOZA1yEZPR+4IDzGkZc1JrNNhEGYSmeHgWQO8+4epXIIhY3shnqNxacDev1yYF2kAGi13hJIaz4YDaw4NbPgFmc2MkMzudKgAAAABJRU5ErkJggg==";

export default function LaundryMap({
  shops = [],
  latitude = CAMSUR_CENTER.latitude,
  longitude = CAMSUR_CENTER.longitude,
  onSelect,
  onPin,
  showExpand = true,
}: MapProps) {
  const webViewRef = useRef<WebView>(null);
  const fullWebViewRef = useRef<WebView>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter valid shops with numerical coordinates
  const validShops = useMemo(
    () =>
      shops.filter(
        (s) =>
          typeof s.latitude === "number" &&
          typeof s.longitude === "number" &&
          Number.isFinite(s.latitude) &&
          Number.isFinite(s.longitude),
      ),
    [shops],
  );

  // Search results for full screen search bar
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

  // Build HTML containing Leaflet & OpenStreetMap tiles locked to Camarines Sur
  const htmlContent = useMemo(() => {
    const shopsJson = JSON.stringify(
      validShops.map((s) => ({
        id: s.id,
        name: s.shopName,
        address: s.address || s.barangay || "Laundry Shop",
        lat: s.latitude,
        lng: s.longitude,
      })),
    );

    const isPinMode = Boolean(onPin);
    const centerLat = latitude || CAMSUR_CENTER.latitude;
    const centerLng = longitude || CAMSUR_CENTER.longitude;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { box-sizing: border-box; }
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background-color: #d1d5db; }
    
    .shop-marker-pin {
      display: flex;
      flex-direction: column;
      align-items: center;
      filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35));
      cursor: pointer;
    }
    .shop-marker-bubble {
      background: #1E54AB;
      border: 2px solid white;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .shop-marker-bubble img {
      width: 22px;
      height: 22px;
      object-fit: contain;
    }
    .shop-marker-arrow {
      width: 0;
      height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 8px solid #1E54AB;
      margin-top: -1px;
    }

    .pin-marker-pin {
      display: flex;
      flex-direction: column;
      align-items: center;
      filter: drop-shadow(0 3px 6px rgba(0,0,0,0.4));
    }
    .pin-marker-bubble {
      background: #EF4444;
      border: 2px solid white;
      border-radius: 50%;
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 16px;
    }
    .pin-marker-arrow {
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 7px solid #EF4444;
      margin-top: -1px;
    }

    .leaflet-popup-content-wrapper {
      border-radius: 14px;
      padding: 6px 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.25);
    }
    .popup-title {
      font-weight: 700;
      font-size: 15px;
      color: #1F2937;
      margin-bottom: 2px;
      font-family: sans-serif;
    }
    .popup-address {
      font-size: 12px;
      color: #6B7280;
      margin-bottom: 10px;
      line-height: 1.3;
      font-family: sans-serif;
    }
    .popup-btn {
      background: #1E54AB;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 8px 14px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const shops = ${shopsJson};
    const isPinMode = ${isPinMode};
    const defaultCenter = [${centerLat}, ${centerLng}];

    const map = L.map('map', {
      zoomControl: true,
      attributionControl: false,
      minZoom: 9
    }).setView(defaultCenter, 11);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    const shopIcon = L.divIcon({
      className: '',
      html: '<div class="shop-marker-pin">' +
              '<div class="shop-marker-bubble">' +
                '<img src="' + '${WASHING_MACHINE_B64}' + '" alt="laundry" />' +
              '</div>' +
              '<div class="shop-marker-arrow"></div>' +
            '</div>',
      iconSize: [40, 48],
      iconAnchor: [20, 48],
      popupAnchor: [0, -48]
    });

    const pinIcon = L.divIcon({
      className: '',
      html: '<div class="pin-marker-pin">' +
              '<div class="pin-marker-bubble">📍</div>' +
              '<div class="pin-marker-arrow"></div>' +
            '</div>',
      iconSize: [34, 41],
      iconAnchor: [17, 41],
      popupAnchor: [0, -41]
    });

    const markers = [];

    // Render shops with washingmachine icon
    shops.forEach(function(shop) {
      const marker = L.marker([shop.lat, shop.lng], { icon: shopIcon }).addTo(map);
      marker.shopId = shop.id;
      const popupHtml = '<div class="popup-title">' + shop.name + '</div>' +
        '<div class="popup-address">' + shop.address + '</div>' +
        '<button class="popup-btn" onclick="selectShop(' + shop.id + ')">Select Shop</button>';
      marker.bindPopup(popupHtml);
      markers.push(marker);
    });

    window.selectShop = function(id) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'selectShop', shopId: id }));
      }
    };

    let pinMarker = null;
    if (isPinMode) {
      pinMarker = L.marker(defaultCenter, { icon: pinIcon }).addTo(map);

      map.on('click', function(e) {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        if (pinMarker) {
          pinMarker.setLatLng([lat, lng]);
        } else {
          pinMarker = L.marker([lat, lng], { icon: pinIcon }).addTo(map);
        }
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'pin', latitude: lat, longitude: lng }));
        }
      });
    }

    // Camarines Sur view adjustment
    function fitCamSur() {
      map.invalidateSize();
      if (!isPinMode && markers.length > 1) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.3), { maxZoom: 13, minZoom: 10 });
      } else if (!isPinMode && markers.length === 1) {
        map.setView([shops[0].lat, shops[0].lng], 13);
      } else {
        map.setView(defaultCenter, 11);
      }
    }

    setTimeout(fitCamSur, 150);
    setTimeout(fitCamSur, 500);

    window.updatePosition = function(lat, lng) {
      map.setView([lat, lng], 13);
      if (pinMarker) {
        pinMarker.setLatLng([lat, lng]);
      }
    };

    window.flyToShop = function(lat, lng, id) {
      map.flyTo([lat, lng], 15, { duration: 1.2 });
      markers.forEach(function(m) {
        if (m.shopId === id) {
          setTimeout(function() {
            m.openPopup();
          }, 600);
        }
      });
    };
  </script>
</body>
</html>`;
  }, [validShops, onPin, latitude, longitude]);

  useEffect(() => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `if (window.updatePosition) { window.updatePosition(${latitude}, ${longitude}); } true;`,
      );
    }
    if (fullWebViewRef.current) {
      fullWebViewRef.current.injectJavaScript(
        `if (window.updatePosition) { window.updatePosition(${latitude}, ${longitude}); } true;`,
      );
    }
  }, [latitude, longitude]);

  function handleMessage(event: { nativeEvent: { data: string } }) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "selectShop") {
        const found = shops.find((s) => s.id === data.shopId);
        if (found) {
          setFullscreen(false);
          onSelect?.(found);
        }
      } else if (data.type === "pin") {
        onPin?.({ latitude: data.latitude, longitude: data.longitude });
      }
    } catch {
      // Ignore parse errors
    }
  }

  function handleSelectSearchResult(shop: (typeof validShops)[0]) {
    setSearchQuery("");
    if (fullWebViewRef.current && shop.latitude && shop.longitude) {
      fullWebViewRef.current.injectJavaScript(
        `if (window.flyToShop) { window.flyToShop(${shop.latitude}, ${shop.longitude}, ${shop.id}); } true;`,
      );
    }
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html: htmlContent }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#1E54AB" />
          </View>
        )}
        onMessage={handleMessage}
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
        <SafeAreaView style={styles.fullscreenContainer}>
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

          {/* Search bar inside full screen map */}
          <View style={styles.searchWrapper}>
            <View style={styles.searchBar}>
              <Search size={18} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search laundry shop or location..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => setSearchQuery("")}
                  hitSlop={8}
                  style={{ padding: 4 }}
                >
                  <X size={18} color="#6B7280" />
                </Pressable>
              )}
            </View>

            {/* Search results dropdown */}
            {searchQuery.trim().length > 0 && (
              <View style={styles.resultsContainer}>
                {searchResults.length > 0 ? (
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    style={{ maxHeight: 220 }}
                  >
                    {searchResults.map((shop) => (
                      <Pressable
                        key={shop.id}
                        style={styles.resultItem}
                        onPress={() => handleSelectSearchResult(shop)}
                      >
                        <View style={styles.resultIcon}>
                          <MapPin size={16} color="white" />
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
                      No shops found matching "{searchQuery}"
                    </Txt>
                  </View>
                )}
              </View>
            )}
          </View>

          <View style={{ flex: 1, position: "relative" }}>
            <WebView
              ref={fullWebViewRef}
              originWhitelist={["*"]}
              source={{ html: htmlContent }}
              style={styles.webview}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState
              renderLoading={() => (
                <View style={styles.loading}>
                  <ActivityIndicator size="large" color="#1E54AB" />
                </View>
              )}
              onMessage={handleMessage}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    position: "relative",
  },
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
  loading: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
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
  searchWrapper: {
    position: "relative",
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1F2937",
    padding: 0,
  },
  resultsContainer: {
    position: "absolute",
    top: 56,
    left: 16,
    right: 16,
    backgroundColor: "white",
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    zIndex: 20,
    overflow: "hidden",
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
