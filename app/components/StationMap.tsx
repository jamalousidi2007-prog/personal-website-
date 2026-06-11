"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import styles from "./WeatherStation.module.css";

type StationMapProps = {
  lat: number;
  lng: number;
  stationName: string;
  sensorValues: {
    temperature: string;
    humidity: string;
    pressure: string;
    rain: string;
    light: string;
  };
  connected: boolean;
  lang: string;
};

export default function StationMap({ lat, lng, stationName, sensorValues, connected, lang }: StationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const [currentLat, setCurrentLat] = useState(lat);
  const [currentLng, setCurrentLng] = useState(lng);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: [lat, lng],
      zoom: 13,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20,
      subdomains: "abcd",
    }).addTo(map);

    const stationIcon = L.divIcon({
      className: styles.stationMarker,
      html: `<div class="${styles.markerPulse}"></div><div class="${styles.markerLabel}">${connected ? "ON" : "OFF"}</div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    const marker = L.marker([lat, lng], { icon: stationIcon, draggable: true }).addTo(map);

    const popupContent = `
      <div style="min-width:180px;font-family:sans-serif;direction:${lang === "ar" ? "rtl" : "ltr"}">
        <h4 style="margin:0 0 8px;color:#1e40af;font-size:14px;">${stationName}</h4>
        <div style="font-size:12px;line-height:1.8;">
          <div>🌡️ ${sensorValues.temperature}</div>
          <div>💧 ${sensorValues.humidity}</div>
          <div>🔵 ${sensorValues.pressure}</div>
          <div>🌧️ ${sensorValues.rain}</div>
          <div>💡 ${sensorValues.light}</div>
        </div>
        <div style="margin-top:6px;font-size:11px;color:${connected ? "#16a34a" : "#ef4444"}">
          ${connected ? (lang === "ar" ? "متصل" : "Connected") : (lang === "ar" ? "غير متصل" : "Disconnected")}
        </div>
        <div style="margin-top:4px;font-size:10px;color:#666;">
          📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}
        </div>
      </div>
    `;

    marker.bindPopup(popupContent).openPopup();

    marker.on("dragstart", () => setIsDragging(true));
    marker.on("dragend", () => {
      const pos = marker.getLatLng();
      setCurrentLat(pos.lat);
      setCurrentLng(pos.lng);
      setIsDragging(false);
    });

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Update popup content when values change
  useEffect(() => {
    if (!mapInstance.current) return;
    mapInstance.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        const popupContent = `
          <div style="min-width:180px;font-family:sans-serif;direction:${lang === "ar" ? "rtl" : "ltr"}">
            <h4 style="margin:0 0 8px;color:#1e40af;font-size:14px;">${stationName}</h4>
            <div style="font-size:12px;line-height:1.8;">
              <div>🌡️ ${sensorValues.temperature}</div>
              <div>💧 ${sensorValues.humidity}</div>
              <div>🔵 ${sensorValues.pressure}</div>
              <div>🌧️ ${sensorValues.rain}</div>
              <div>💡 ${sensorValues.light}</div>
            </div>
            <div style="margin-top:6px;font-size:11px;color:${connected ? "#16a34a" : "#ef4444"}">
              ${connected ? (lang === "ar" ? "متصل" : "Connected") : (lang === "ar" ? "غير متصل" : "Disconnected")}
            </div>
            <div style="margin-top:4px;font-size:10px;color:#666;">
              📍 ${currentLat.toFixed(4)}, ${currentLng.toFixed(4)}
            </div>
          </div>
        `;
        layer.setPopupContent(popupContent);

        const stationIcon = L.divIcon({
          className: styles.stationMarker,
          html: `<div class="${styles.markerPulse} ${connected ? "" : styles.markerOffline}"></div><div class="${styles.markerLabel}">${connected ? "ON" : "OFF"}</div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });
        layer.setIcon(stationIcon);
      }
    });
  }, [sensorValues, connected, stationName, currentLat, currentLng, lang]);

  return (
    <div className={styles.mapSection}>
      <h3 className={styles.mapTitle}>
        {lang === "ar" ? "موقع المحطة" : lang === "fr" ? "Position de la station" : "Station Location"}
        <span className={styles.mapCoords}>
          {currentLat.toFixed(4)}, {currentLng.toFixed(4)}
        </span>
      </h3>
      <div ref={mapRef} className={styles.mapContainer} />
      {isDragging && (
        <div className={styles.mapDragHint}>
          {lang === "ar" ? "اسحب العلامة لتغيير الموقع..." : "Drag marker to change location..."}
        </div>
      )}
    </div>
  );
}
