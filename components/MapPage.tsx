"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import { useAuth } from "./auth/AuthProvider";
import { doc, onSnapshot } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import styles from "./WeatherStation.module.css";

type SensorKey = "temperature" | "humidity" | "pressure" | "rain" | "light";
type SensorValues = Record<SensorKey, number | null>;

const sensorKeys: SensorKey[] = ["temperature", "humidity", "pressure", "rain", "light"];
const sensorUnits: Record<SensorKey, string> = {
  temperature: "°C",
  humidity: "%",
  pressure: "hPa",
  rain: "mm",
  light: "Lux"
};

const sensorIcons: Record<SensorKey, string> = {
  temperature: "🌡️",
  humidity: "💧",
  pressure: "🔵",
  rain: "🌧️",
  light: "💡"
};

export default function MapPage() {
  const { lang } = useLanguage();
  const { user } = useAuth();

  const [values, setValues] = useState<SensorValues>({
    temperature: null, humidity: null, pressure: null, rain: null, light: null
  });
  const [connected, setConnected] = useState(false);
  const [locationName, setLocationName] = useState("");

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [rssi, setRssi] = useState<number | null>(null);
  const [lastSeen, setLastSeen] = useState<string>("");

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const userInteractedRef = useRef(false);
  const initialCenterDoneRef = useRef(false);
  const [mapStyle, setMapStyle] = useState<"satellite" | "streets">("satellite");

  // Tile layer definitions
  const tileLayers: Record<string, { url: string; attribution: string; maxZoom: number; subdomains?: string }> = {
    satellite: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: '&copy; <a href="https://www.esri.com">Esri</a>, Maxar, Earthstar Geographics',
      maxZoom: 19,
    },
    streets: {
      url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20,
      subdomains: "abcd",
    },
  };

  // Use browser geolocation as fallback when ESP32 doesn't send lat/lng
  useEffect(() => {
    if (lat !== null && lng !== null) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
        },
        () => {
          fetch("https://ipapi.co/json/")
            .then((res) => res.json())
            .then((data) => {
              if (data.latitude && data.longitude) {
                setLat(data.latitude);
                setLng(data.longitude);
                if (data.city) setLocationName(data.city);
              }
            })
            .catch(() => {
              setLat(33.5731);
              setLng(-7.5898);
            });
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      fetch("https://ipapi.co/json/")
        .then((res) => res.json())
        .then((data) => {
          if (data.latitude && data.longitude) {
            setLat(data.latitude);
            setLng(data.longitude);
            if (data.city) setLocationName(data.city);
          }
        })
        .catch(() => {
          setLat(33.5731);
          setLng(-7.5898);
        });
    }
  }, []);

  // Listen to Firebase for sensor data + location
  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    if (!db) return;

    const unsub = onSnapshot(
      doc(db, "stations", "station-meteo"),
      (snap) => {
        if (!snap.exists()) {
          setConnected(false);
          return;
        }
        const data = snap.data();

        const sensors = data.sensors ?? {};
        const newValues: SensorValues = {} as SensorValues;
        sensorKeys.forEach((key) => {
          newValues[key] = sensors[key] ?? null;
        });
        setValues(newValues);
        setConnected(Boolean(data.connected));

        if (data.lat !== undefined && data.lng !== undefined) {
          setLat(data.lat);
          setLng(data.lng);
        }
        if (data.locationName) {
          setLocationName(data.locationName);
        } else if (lat !== null && lng !== null) {
          // Reverse geocode to get real place name
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=12&accept-language=ar`)
            .then(res => res.json())
            .then(geo => {
              if (geo.address) {
                const city = geo.address.city || geo.address.town || geo.address.village || geo.address.suburb;
                const state = geo.address.state;
                if (city) setLocationName(city + (state ? `, ${state}` : ""));
              }
            })
            .catch(() => {});
        }
        if (typeof data.rssi === "number") {
          setRssi(data.rssi);
        }
        if (data.lastSeen) {
          const ts = data.lastSeen;
          if (ts?.toDate) {
            setLastSeen(ts.toDate().toLocaleString(lang === "ar" ? "ar-MA" : "fr-FR"));
          } else if (typeof ts === "string") {
            setLastSeen(ts);
          }
        }
      },
      (err) => { console.error("Firestore error:", err); setConnected(false); }
    );

    return () => unsub();
  }, [user, lang]);

  // Initialize map once when coordinates are available
  useEffect(() => {
    if (!mapRef.current || mapInstance.current || lat === null || lng === null) return;

    const map = L.map(mapRef.current, {
      center: [lat, lng],
      zoom: 15,
      zoomControl: false, // We add custom controls below
      scrollWheelZoom: true,
      doubleClickZoom: true,
      touchZoom: true,
    });

    // Track user interaction to prevent auto-recenter
    map.on("zoomstart", () => { userInteractedRef.current = true; });
    map.on("movestart", () => { userInteractedRef.current = true; });
    map.on("dragstart", () => { userInteractedRef.current = true; });

    // Use ESRI World Imagery (satellite) for detailed view
    const tile = L.tileLayer(tileLayers.satellite.url, {
      attribution: tileLayers.satellite.attribution,
      maxZoom: tileLayers.satellite.maxZoom,
    }).addTo(map);
    tileLayerRef.current = tile;

    mapInstance.current = map;
    initialCenterDoneRef.current = true;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [lat, lng]);

  // Switch tile layer when mapStyle changes
  useEffect(() => {
    if (!mapInstance.current || !tileLayerRef.current) return;
    const current = tileLayerRef.current;
    const config = tileLayers[mapStyle];
    const newTile = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
      subdomains: config.subdomains,
    }).addTo(mapInstance.current);
    current.remove();
    tileLayerRef.current = newTile;
  }, [mapStyle]);

  // Build popup HTML from current data
  const buildPopupContent = useCallback(() => {
    const sensorList = sensorKeys.map((key) => {
      const val = values[key];
      const formatted = val !== null ? `${val.toFixed(key === "pressure" ? 0 : 1)} ${sensorUnits[key]}` : `-- ${sensorUnits[key]}`;
      return `<div style="display:flex;justify-content:space-between;padding:2px 0;">
        <span>${sensorIcons[key]} ${key}</span>
        <strong style="color:#1e40af;">${formatted}</strong>
      </div>`;
    }).join("");

    const name = locationName || (lang === "ar" ? "محطة الطقس" : lang === "fr" ? "Station Meteo" : "Weather Station");

    return `
      <div style="min-width:220px;font-family:sans-serif;direction:${lang === "ar" ? "rtl" : "ltr"};padding:4px;">
        <h4 style="margin:0 0 10px;color:#1e40af;font-size:15px;border-bottom:1px solid #e5e7eb;padding-bottom:6px;">
          ${name}
        </h4>
        <div style="font-size:12px;line-height:2.2;">${sensorList}</div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:8px 0;">
        <div style="display:flex;justify-content:space-between;font-size:11px;">
          <span style="color:#666;">${lang === "ar" ? "الحالة" : "Status"}</span>
          <span style="color:${connected ? "#16a34a" : "#ef4444"};font-weight:bold;">
            ${connected ? (lang === "ar" ? "● متصل" : "● Connected") : (lang === "ar" ? "● غير متصل" : "● Disconnected")}
          </span>
        </div>
        ${rssi !== null ? `<div style="display:flex;justify-content:space-between;font-size:11px;margin-top:4px;">
          <span style="color:#666;">RSSI</span>
          <span style="color:${rssi > -70 ? "#16a34a" : rssi > -85 ? "#eab308" : "#ef4444"}">${rssi} dBm</span>
        </div>` : ""}
        ${lastSeen ? `<div style="display:flex;justify-content:space-between;font-size:11px;margin-top:4px;">
          <span style="color:#666;">${lang === "ar" ? "آخر تحديث" : "Last update"}</span>
          <span>${lastSeen}</span>
        </div>` : ""}
        <div style="font-size:10px;color:#999;margin-top:8px;text-align:center;direction:ltr;">
          📍 ${lat?.toFixed(5) ?? "--"}, ${lng?.toFixed(5) ?? "--"}
        </div>
      </div>
    `;
  }, [values, connected, locationName, rssi, lastSeen, lang, lat, lng]);

  // Update marker position only when lat/lng actually changes
  useEffect(() => {
    if (!mapInstance.current || lat === null || lng === null) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      const icon = L.divIcon({
        className: styles.stationMarker,
        html: `<div class="${styles.markerPulse} ${connected ? "" : styles.markerOffline}"></div><div class="${styles.markerLabel}">${connected ? "ON" : "OFF"}</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
      const marker = L.marker([lat, lng], { icon, draggable: false }).addTo(mapInstance.current);
      markerRef.current = marker;
    }

    // Only center map on first load or if user hasn't interacted
    if (!userInteractedRef.current && !initialCenterDoneRef.current) {
      mapInstance.current.setView([lat, lng], 15, { animate: true });
    }
    // After initial center, never auto-recenter again
    initialCenterDoneRef.current = false;
  }, [lat, lng]);

  // Update popup content and marker icon when data changes (without recentering)
  useEffect(() => {
    if (!mapInstance.current || !markerRef.current) return;

    // Update popup content
    markerRef.current.setPopupContent(buildPopupContent());

    // Update marker icon for connection status
    const icon = L.divIcon({
      className: styles.stationMarker,
      html: `<div class="${styles.markerPulse} ${connected ? "" : styles.markerOffline}"></div><div class="${styles.markerLabel}">${connected ? "ON" : "OFF"}</div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
    markerRef.current.setIcon(icon);

    // Keep popup open
    if (!markerRef.current.isPopupOpen()) {
      markerRef.current.openPopup();
    }
  }, [buildPopupContent, connected]);

  // Custom zoom handlers
  const handleZoomIn = () => {
    mapInstance.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstance.current?.zoomOut();
  };

  const handleLocateMe = () => {
    userInteractedRef.current = false;
    if (lat !== null && lng !== null && mapInstance.current) {
      mapInstance.current.setView([lat, lng], 16, { animate: true });
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newLat = pos.coords.latitude;
          const newLng = pos.coords.longitude;
          setLat(newLat);
          setLng(newLng);
          if (mapInstance.current) {
            mapInstance.current.setView([newLat, newLng], 16, { animate: true });
          }
        },
        () => {},
        { enableHighAccuracy: true }
      );
    }
  };

  const displayName = locationName || (lang === "ar" ? "في انتظار موقع المحطة..." : lang === "fr" ? "En attente de la position..." : "Waiting for station location...");

  return (
    <div className={styles.mapPageWrapper}>
      <div className={styles.mapPageHeader}>
        <Link href="/home" className={styles.mapBackBtn}>
          ← {lang === "ar" ? "رجوع" : lang === "fr" ? "Retour" : "Back"}
        </Link>
        <div className={styles.mapTitleWrap}>
          <h2 className={styles.mapPageTitle}>
            {lang === "ar" ? "موقع المحطة" : lang === "fr" ? "Position de la station" : "Station Location"}
          </h2>
          <div className={styles.mapLocationsList}>{displayName}</div>
        </div>
        <div className={styles.mapPageStatus}>
          <span className={`${styles.statusDot} ${connected ? styles.statusOnline : styles.statusOffline}`} />
          {connected ? (lang === "ar" ? "متصل" : "Online") : (lang === "ar" ? "غير متصل" : "Offline")}
        </div>
      </div>

      {lat === null && (
        <div className={styles.mapWaitingOverlay}>
          <div className={styles.waitingSpinner} />
          <p>
            {lang === "ar"
              ? "جاري تحديد الموقع..."
              : "Detecting your location..."}
          </p>
        </div>
      )}

      {/* Custom zoom controls + layer toggle */}
      <div className={styles.mapCustomControls}>
        <button className={styles.mapZoomBtn} onClick={handleZoomIn} title={lang === "ar" ? "تكبير" : "Zoom in"}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button className={styles.mapZoomBtn} onClick={handleZoomOut} title={lang === "ar" ? "تصغير" : "Zoom out"}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button
          className={styles.mapLocateBtn}
          onClick={() => setMapStyle((s) => s === "satellite" ? "streets" : "satellite")}
          title={mapStyle === "satellite"
            ? (lang === "ar" ? "عرض الشوارع" : lang === "fr" ? "Vue rues" : "Street view")
            : (lang === "ar" ? "عرض القمر الصناعي" : lang === "fr" ? "Vue satellite" : "Satellite view")}
        >
          {mapStyle === "satellite" ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
              <line x1="3" y1="10.5" x2="21" y2="10.5" strokeWidth="1"/><line x1="10.5" y1="3" x2="10.5" y2="21" strokeWidth="1"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z"/>
            </svg>
          )}
        </button>
        <button className={styles.mapLocateBtn} onClick={handleLocateMe} title={lang === "ar" ? "موقعي" : "My location"}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="8" strokeDasharray="4 2"/></svg>
        </button>
      </div>

      <div ref={mapRef} className={styles.mapFullContainer} />
    </div>
  );
}
