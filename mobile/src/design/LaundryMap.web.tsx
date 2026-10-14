import { useEffect, useRef } from "react";
import { View } from "react-native";
import type { MapProps } from "./LaundryMap";

const WASHING_MACHINE_B64 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAUCAYAAACEYr13AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAEESURBVHgBtVMBDcIwEPwWBFQACcUJOAAFDAUEBXQOwEFxgAScUAgCKoAw7qEkZbRLtoVLmv2vf5f7/01otVpWVO2ISFE7OEHCiLEqzkg0dYOXPcgMJeNMEE341OMmSOqJYZxUROdU/FcHOYEj+p9dvBV8OIajQ6qQ11jFL5CUV29NqlirwuB+m3WAS9tAVu59d8wKPDI2Qd7yUFkE7eyzAjdvTxmyofenrl2tpnELEfmFe+J/+RIYqWKaIwOOHeqo5kdgQLQOZA1yEZPR+4IDzGkZc1JrNNhEGYSmeHgWQO8+4epXIIhY3shnqNxacDev1yYF2kAGi13hJIaz4YDaw4NbPgFmc2MkMzudKgAAAABJRU5ErkJggg==";

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
      if (!L || !containerRef.current) return;

      // Clean up previous map if exists
      if ((containerRef.current as any)._leaflet_map) {
        (containerRef.current as any)._leaflet_map.remove();
      }

      const map = L.map(containerRef.current).setView([latitude, longitude], 14);
      (containerRef.current as any)._leaflet_map = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      const markers: any[] = [];
      const shopIcon = L.divIcon({
        className: "",
        html: '<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.35));cursor:pointer;">' +
                '<div style="background:#1E54AB;border:2px solid white;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;">' +
                  '<img src="' + WASHING_MACHINE_B64 + '" style="width:20px;height:20px;object-fit:contain;" />' +
                '</div>' +
                '<div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #1E54AB;margin-top:-1px;"></div>' +
              '</div>',
        iconSize: [38, 45],
        iconAnchor: [19, 45],
        popupAnchor: [0, -45]
      });

      const pinIcon = L.divIcon({
        className: "",
        html: '<div style="background:#EF4444;color:white;border:2px solid white;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 8px rgba(0,0,0,0.3);font-size:14px;">📍</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      shops
        .filter(
          (s) =>
            typeof s.latitude === "number" &&
            typeof s.longitude === "number" &&
            Number.isFinite(s.latitude) &&
            Number.isFinite(s.longitude),
        )
        .forEach((s) => {
          const marker = L.marker([s.latitude!, s.longitude!], {
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
        map.fitBounds(group.getBounds().pad(0.3), { maxZoom: 13, minZoom: 10 });
      } else if (markers.length === 1) {
        map.setView([shops[0].latitude!, shops[0].longitude!], 13);
      } else {
        map.setView([13.6217, 123.1948], 11);
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
      if (containerRef.current && (containerRef.current as any)._leaflet_map) {
        (containerRef.current as any)._leaflet_map.remove();
        (containerRef.current as any)._leaflet_map = null;
      }
    };
  }, [shops, latitude, longitude, onSelect, onPin]);

  return (
    <View style={{ flex: 1, borderRadius: 12, overflow: "hidden" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </View>
  );
}
