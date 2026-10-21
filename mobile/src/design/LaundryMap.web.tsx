import { useEffect, useRef } from "react";
import { View } from "react-native";
import type { MapProps } from "./LaundryMap";
import { LOGO_SPLASH_B64 } from "./mapLogo";

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

export default function LaundryMap({
  shops = [],
  latitude = 13.6217,
  longitude = 123.1948,
  onSelect,
  onPin,
  showExpand = true,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // If running in browser environment
    if (typeof window === "undefined" || !containerRef.current) return;
    const container = containerRef.current;
    let disposed = false;
    let activeMap: any = null;

    // Load leaflet CSS if not present
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    function initMap() {
      const L = (window as any).L;
      if (!L || disposed) return;

      // Clean up previous map if exists
      if ((container as any)._leaflet_map) {
        (container as any)._leaflet_map.stop();
        (container as any)._leaflet_map.remove();
      }

      const map = L.map(container, { zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false }).setView([latitude, longitude], 14);
      activeMap = map;
      (container as any)._leaflet_map = map;

      L.tileLayer(
        `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`,
        {
          maxZoom: 19,
          tileSize: 256,
          attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a>',
        }
      ).addTo(map);

      const markers: any[] = [];
      const shopIcon = L.divIcon({
        className: "",
        html: '<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.35));cursor:pointer;">' +
                '<div style="background-color:#FFFFFF;border:2.5px solid #1E54AB;border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.25);">' +
                  '<img src="' + LOGO_SPLASH_B64 + '" width="36" height="36" style="width:36px;height:36px;object-fit:contain;border-radius:18px;display:block;" alt="LabaRide" />' +
                '</div>' +
                '<div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #1E54AB;margin-top:-1px;"></div>' +
              '</div>',
        iconSize: [44, 52],
        iconAnchor: [22, 52],
        popupAnchor: [0, -52]
      });

      const pinIcon = L.divIcon({
        className: "",
        html: '<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.35));cursor:pointer;">' +
                '<div style="background-color:#FFFFFF;border:2.5px solid #1E54AB;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.25);">' +
                  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1E54AB" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
                    '<line x1="2" x2="5" y1="12" y2="12"></line>' +
                    '<line x1="19" x2="22" y1="12" y2="12"></line>' +
                    '<line x1="12" x2="12" y1="2" y2="5"></line>' +
                    '<line x1="12" x2="12" y1="19" y2="22"></line>' +
                    '<circle cx="12" cy="12" r="7"></circle>' +
                    '<circle cx="12" cy="12" r="3"></circle>' +
                  '</svg>' +
                '</div>' +
                '<div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #1E54AB;margin-top:-1px;"></div>' +
              '</div>',
        iconSize: [38, 45],
        iconAnchor: [19, 45],
      });

      const validShops = shops
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
          (s) =>
            Number.isFinite(s.parsedLat) &&
            Number.isFinite(s.parsedLng),
        );

      validShops.forEach((s) => {
        const marker = L.marker([s.parsedLat, s.parsedLng], {
          icon: shopIcon,
        }).addTo(map);
        marker.bindPopup(
          `<b>${s.shopName}</b><br/>${s.address || s.barangay || ""}`,
        );
        marker.on("click", () => onSelect?.(s));
        markers.push(marker);
      });

      if (onPin) {
        const pinMarker = L.marker([latitude, longitude], {
          icon: pinIcon,
        }).addTo(map);
        map.on("click", (e: any) => {
          pinMarker.setLatLng(e.latlng);
          onPin({ latitude: e.latlng.lat, longitude: e.latlng.lng });
        });
      } else if (markers.length > 1) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.3), { maxZoom: 13, minZoom: 10, animate: false });
      } else if (markers.length === 1) {
        map.setView([validShops[0].parsedLat, validShops[0].parsedLng], 13, { animate: false });
      } else {
        map.setView([13.6217, 123.1948], 11, { animate: false });
      }
    }

    if (!(window as any).L) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = initMap;
      document.head.appendChild(script);
    } else {
      initMap();
    }

    return () => {
      disposed = true;
      if (activeMap) {
        activeMap.stop();
        activeMap.remove();
        if ((container as any)._leaflet_map === activeMap) (container as any)._leaflet_map = null;
      }
    };
  }, [shops, latitude, longitude, onSelect, onPin]);

  return (
    <View style={{ flex: 1, borderRadius: 12, overflow: "hidden" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </View>
  );
}
