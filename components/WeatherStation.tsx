"use client";

import Link from "next/link";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, type ChartOptions } from "chart.js";
import { doc, onSnapshot, setDoc, collection, query, orderBy, limit, getDocs, type Timestamp } from "firebase/firestore";
import { useLanguage } from "./LanguageProvider";
import EditableText from "./InlineEdit";
import { useAuth } from "./auth/AuthProvider";
import { getFirebaseDb } from "@/lib/firebase/client";
import {
  defaultProjectBackgrounds,
  defaultProjectImages,
  defaultProjectImageStyles,
  PROJECT_BG_STORAGE_KEY,
  PROJECT_IMAGE_STORAGE_KEY,
  PROJECT_IMAGE_SECONDARY_STORAGE_KEY,
  PROJECT_IMAGE_STYLE_STORAGE_KEY
} from "@/lib/projectVisuals";
import styles from "./WeatherStation.module.css";
import { sendSensorAlert, sendDailyReport, sendDeviceOfflineAlert } from "@/lib/emailService";
import { SUPER_ADMIN_EMAIL } from "@/lib/constants";
import { getWeatherForecast, type ForecastDay, type ForecastResult } from "@/lib/weatherForecast";
import { analyzeSensorTrends, type SensorReading, type TrendAnalysis, getConditionIcon } from "@/lib/weatherAnalysis";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

type SensorKey = "temperature" | "humidity" | "pressure" | "rain" | "light";
type SensorValues = Record<SensorKey, number | null>;
type History = Record<SensorKey, number[]>;
type SensorWave = "sine" | "square" | "triangle" | "sawtooth";

const sensorKeys: SensorKey[] = ["temperature", "humidity", "pressure", "rain", "light"];
const seedLabels = ["08:00", "08:05", "08:10", "08:15", "08:20", "08:25", "08:30", "08:35"];
const seedHistory: History = {
  temperature: [22.4, 22.8, 23.1, 23.7, 24.2, 24.0, 24.5, 24.9],
  humidity: [58, 60, 61, 62, 63, 64, 62, 61],
  pressure: [1010, 1011, 1011.8, 1012.2, 1011.5, 1012.6, 1013, 1012.7],
  rain: [4, 4.8, 5.1, 4.4, 4.9, 5.3, 5.7, 5.2],
  light: [320, 340, 360, 380, 410, 430, 450, 470]
};
const seedValues: SensorValues = {
  temperature: seedHistory.temperature[seedHistory.temperature.length - 1],
  humidity: seedHistory.humidity[seedHistory.humidity.length - 1],
  pressure: seedHistory.pressure[seedHistory.pressure.length - 1],
  rain: seedHistory.rain[seedHistory.rain.length - 1],
  light: seedHistory.light[seedHistory.light.length - 1]
};

const chartBaseOptions: ChartOptions<"line"> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  interaction: {
    mode: "nearest",
    intersect: true
  },
  events: ["mousemove", "mouseout"],
  plugins: {
    legend: { display: false },
    tooltip: {
      enabled: false
    }
  },
  scales: {
    x: { display: false, grid: { color: "#1f2e45" } },
    y: {
      reverse: false,
      grid: { color: "#1f2e45" },
      ticks: {
        color: "#88a5c8",
        maxTicksLimit: 6,
        callback(value) {
          const num = typeof value === "number" ? value : Number(value);
          if (!Number.isFinite(num)) return "";
          return num.toFixed(1);
        }
      }
    }
  },
  elements: { point: { radius: 0, hoverRadius: 0, hitRadius: 0 }, line: { tension: 0.35, borderWidth: 2.5 } },
  locale: "en-US"
};

const chartColors: Record<SensorKey, string> = {
  temperature: "#e24b4a",
  humidity: "#378add",
  pressure: "#a855f7",
  rain: "#1d9e75",
  light: "#ef9f27"
};

const units: Record<SensorKey, string> = {
  temperature: "deg C",
  humidity: "%",
  pressure: "hPa",
  rain: "%",
  light: "Lux"
};

function formatSensorValue(value: number | null, decimals = 1) {
  if (value === null || Number.isNaN(value)) return "--";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  return `${sign}${abs.toFixed(decimals)}`;
}

const copy = {
  ar: {
    brand: "مشاريع المهندس جمال اوسيدي",
    title: "Station Meteo",
    subtitle: "محطة طقس ذكية ببيانات حقيقية مباشرة من الحساسات",
    back: "رجوع",
    connected: "Connected",
    disconnected: "Disconnected",
    lastSeen: "آخر اتصال",
    unknownLastSeen: "Derniere connexion inconnue",
    rssi: "Wi-Fi RSSI",
    signal: "Signal Quality",
    exportBtn: "تحميل Excel",
    noteOffline: "الجهاز غير متصل حاليا. يتم عرض آخر البيانات أو القيم الافتراضية المؤقتة.",
    placeholdersTitle: "القيم الافتراضية عند الانقطاع",
    sensors: {
      temperature: "الحرارة",
      humidity: "الرطوبة",
      pressure: "الضغط الجوي",
      rain: "الأمطار",
      light: "الضوء"
    },
    toast: "تم تحميل الملف بنجاح"
  },
  fr: {
    brand: "Projets de l'ingenieur Jamal Ousidi",
    title: "Station Meteo",
    subtitle: "Station meteo intelligente avec donnees en temps reel des capteurs",
    back: "Retour",
    connected: "Connected",
    disconnected: "Disconnected",
    lastSeen: "Last Seen",
    unknownLastSeen: "Derniere connexion inconnue",
    rssi: "Wi-Fi RSSI",
    signal: "Signal Quality",
    exportBtn: "Exporter Excel",
    noteOffline: "Appareil hors ligne. Le site affiche les dernieres valeurs ou les valeurs par defaut.",
    placeholdersTitle: "Valeurs par defaut en cas de coupure",
    sensors: {
      temperature: "Temperature",
      humidity: "Humidite",
      pressure: "Pression",
      rain: "Pluie",
      light: "Lumiere"
    },
    toast: "Fichier telecharge avec succes"
  },
  en: {
    brand: "Engineer Jamal Ousidi Projects",
    title: "Station Meteo",
    subtitle: "Smart weather station with real-time sensor data",
    back: "Back",
    connected: "Connected",
    disconnected: "Disconnected",
    lastSeen: "Last Seen",
    unknownLastSeen: "Derniere connexion inconnue",
    rssi: "Wi-Fi RSSI",
    signal: "Signal Quality",
    exportBtn: "Export Excel",
    noteOffline: "Device disconnected. The website is showing last data or temporary default values.",
    placeholdersTitle: "Default values during disconnection",
    sensors: {
      temperature: "Temperature",
      humidity: "Humidity",
      pressure: "Pressure",
      rain: "Rain",
      light: "Light"
    },
    toast: "File downloaded successfully"
  }
};

function formatLastSeen(value: Timestamp | string | number | null | undefined, locale: string, fallback: string) {
  if (!value && value !== 0) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    // ESP32 sends millis()/1000 as uptime — show as "X seconds ago"
    const seconds = Math.floor(value);
    if (seconds < 60) return `${seconds}s uptime`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}min uptime`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}min uptime`;
  }
  if (value?.toDate) return value.toDate().toLocaleString(locale);
  return fallback;
}

function generateFake(current: SensorValues) {
  const tRaw = (current.temperature ?? 24) + (Math.random() - 0.5) * 1.2;
  const t = Math.max(12, Math.min(42, tRaw));
  const h = (current.humidity ?? 62) + (Math.random() - 0.5) * 2;
  const p = (current.pressure ?? 1012) + (Math.random() - 0.5) * 1.6;
  const r = Math.max(0, Math.min(100, (current.rain ?? 8) + (Math.random() - 0.5) * 2));
  const l = Math.max(0, Math.min(1000, (current.light ?? 420) + (Math.random() - 0.5) * 24));

  return {
    temperature: Number(t.toFixed(2)),
    humidity: Number(Math.max(0, Math.min(100, h)).toFixed(2)),
    pressure: Number(p.toFixed(2)),
    rain: Number(r.toFixed(2)),
    light: Number(l.toFixed(2))
  } satisfies SensorValues;
}

function getChartOptions(sensor: SensorKey, unit: string): ChartOptions<"line"> {
  const options: ChartOptions<"line"> = {
    ...chartBaseOptions,
    scales: {
      ...chartBaseOptions.scales,
      y: {
        ...chartBaseOptions.scales?.y
      }
    }
  };

  if (sensor === "temperature") {
    options.scales = {
      ...options.scales,
      y: {
        ...options.scales?.y,
        suggestedMin: 10,
        suggestedMax: 45
      }
    };
  }

  return options;
}

function getTrend(history: number[], current: number | null): "up" | "down" | "flat" {
  if (current === null || Number.isNaN(current)) return "flat";
  const validHistory = history.filter((n) => Number.isFinite(n));
  const prev = validHistory.length >= 2 ? validHistory[validHistory.length - 2] : null;
  if (prev === null) return "flat";
  if (current > prev) return "up";
  if (current < prev) return "down";
  return "flat";
}

export default function WeatherStation() {
  const { lang } = useLanguage();
  const { role } = useAuth();
  const t = copy[lang];
  const canEditText = role === "superadmin";
  const locale = lang === "ar" ? "ar-MA" : lang === "fr" ? "fr-FR" : "en-US";

  const [connected, setConnected] = useState(false);
  const [lastSeen, setLastSeen] = useState(t.unknownLastSeen);
  const [rssi, setRssi] = useState<number | null>(null);
  const [signalQuality, setSignalQuality] = useState<number | null>(null);
  const [values, setValues] = useState<SensorValues>(seedValues);
  const [history, setHistory] = useState<History>(seedHistory);
  const [labels, setLabels] = useState<string[]>(seedLabels);
  const [toast, setToast] = useState(false);
  const [heroImage, setHeroImage] = useState(defaultProjectImages[1]);
  const [heroSecondaryImage, setHeroSecondaryImage] = useState<string | null>(null);
  const [heroImageStyle, setHeroImageStyle] = useState(defaultProjectImageStyles[1]);
  const [projectBackground, setProjectBackground] = useState(defaultProjectBackgrounds[1]);
  const [soundEnabled, setSoundEnabled] = useState<Record<SensorKey, boolean>>({
    temperature: true,
    humidity: true,
    pressure: true,
    rain: true,
    light: true
  });
  const audioCtxRef = useRef<AudioContext | null>(null);
  const beepTimersRef = useRef<Partial<Record<SensorKey, number>>>({});
  const startedByUserRef = useRef(false);
  const firstRealDataRef = useRef(true);
  const [activeSoundSensor, setActiveSoundSensor] = useState<SensorKey | null>(null);
  const [soundNames, setSoundNames] = useState<Record<SensorKey, string>>({
    temperature: "Temperature",
    humidity: "Humidité",
    pressure: "Pression",
    rain: "Pluie",
    light: "Lumière"
  });
  const [soundFrequencies, setSoundFrequencies] = useState<Record<SensorKey, number>>({
    temperature: 740,
    humidity: 590,
    pressure: 460,
    rain: 830,
    light: 680
  });
  const [soundVolumes, setSoundVolumes] = useState<Record<SensorKey, number>>({
    temperature: 65,
    humidity: 55,
    pressure: 50,
    rain: 75,
    light: 60
  });
  const [soundWaves, setSoundWaves] = useState<Record<SensorKey, SensorWave>>({
    temperature: "sine",
    humidity: "triangle",
    pressure: "square",
    rain: "sawtooth",
    light: "sine"
  });
  const [soundFileURLs, setSoundFileURLs] = useState<Record<SensorKey, string | null>>({
    temperature: null,
    humidity: null,
    pressure: null,
    rain: null,
    light: null
  });
  const [soundFileNames, setSoundFileNames] = useState<Record<SensorKey, string>>({
    temperature: "",
    humidity: "",
    pressure: "",
    rain: "",
    light: ""
  });
  const [repeatShortSounds, setRepeatShortSounds] = useState<Record<SensorKey, boolean>>({
    temperature: true,
    humidity: true,
    pressure: true,
    rain: true,
    light: true
  });
  const soundAudioRefs = useRef<Partial<Record<SensorKey, HTMLAudioElement>>>({});
  const soundFileDurations = useRef<Partial<Record<SensorKey, number>>>({});

  type AlertThresholds = Record<SensorKey, { min: number | null; max: number | null }>;
  type AlertHistoryEntry = { sensor: SensorKey; time: string; value: string; type: "high" | "low" };

  const defaultThresholds: AlertThresholds = {
    temperature: { min: 10, max: 38 },
    humidity: { min: 20, max: 80 },
    pressure: { min: 985, max: 1030 },
    rain: { min: null, max: 15 },
    light: { min: 50, max: 10000 }
  };

  const [alertCounts, setAlertCounts] = useState<Record<SensorKey, number>>({
    temperature: 0,
    humidity: 0,
    pressure: 0,
    rain: 0,
    light: 0
  });

  const [alertThresholds, setAlertThresholds] = useState<AlertThresholds>(() => {
    if (typeof window === "undefined") return defaultThresholds;
    try {
      const saved = localStorage.getItem("sensor-alert-thresholds");
      if (saved) return JSON.parse(saved) as AlertThresholds;
    } catch { /* ignore */ }
    return defaultThresholds;
  });

  const [editingThreshold, setEditingThreshold] = useState<SensorKey | null>(null);
  const [editingMin, setEditingMin] = useState("");
  const [editingMax, setEditingMax] = useState("");

  const [alertHistory, setAlertHistory] = useState<AlertHistoryEntry[]>([]);

  const [showHistory, setShowHistory] = useState(false);
  const [chartRange, setChartRange] = useState(8);
  const [expandedSensor, setExpandedSensor] = useState<SensorKey | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  // Weather forecast state
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [stationLat, setStationLat] = useState<number | null>(null);
  const [stationLng, setStationLng] = useState<number | null>(null);
  const [trendAnalysis, setTrendAnalysis] = useState<TrendAnalysis | null>(null);
  const [forecastVisible, setForecastVisible] = useState(false);

  type EmailSettings = {
    sensorAlerts: boolean;
    dailyReport: boolean;
    deviceOffline: boolean;
    recipientEmail: string;
    reportHour: number;
    sensorCooldownMin: number;
    offlineCooldownMin: number;
  };

  const defaultEmailSettings: EmailSettings = {
    sensorAlerts: true,
    dailyReport: true,
    deviceOffline: true,
    recipientEmail: SUPER_ADMIN_EMAIL,
    reportHour: 20,
    sensorCooldownMin: 10,
    offlineCooldownMin: 30
  };

  const [emailSettings, setEmailSettings] = useState<EmailSettings>(() => {
    if (typeof window === "undefined") return defaultEmailSettings;
    try {
      const saved = localStorage.getItem("station-email-settings");
      if (saved) return { ...defaultEmailSettings, ...JSON.parse(saved) };
    } catch { /* ignore */ }
    return defaultEmailSettings;
  });

  const [showEmailSettings, setShowEmailSettings] = useState(false);

  const lastSensorAlertTime = useRef<Partial<Record<SensorKey, number>>>({});
  const lastOfflineAlertTime = useRef<number>(0);
  const previousAlerts = useRef<Record<SensorKey, boolean>>({
    temperature: false, humidity: false, pressure: false, rain: false, light: false
  });
  const previousConnected = useRef<boolean>(true);

  const [connectionHistory, setConnectionHistory] = useState<{ online: boolean; hour: number }[]>(() => {
    const now = new Date();
    const currentHour = now.getHours();
    return Array.from({ length: 24 }, (_, i) => ({
      online: i <= currentHour,
      hour: i
    }));
  });

  const uptimePercent = useMemo(() => {
    const online = connectionHistory.filter((h) => h.online).length;
    return Math.round((online / connectionHistory.length) * 100);
  }, [connectionHistory]);

  // Track mounted state for client-side only rendering (fixes Chart.js SSR issues)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Update connection history based on real connection state
  useEffect(() => {
    const currentHour = new Date().getHours();
    setConnectionHistory((prev) =>
      prev.map((h) => (h.hour === currentHour ? { ...h, online: connected } : h))
    );
  }, [connected]);

  // Get station location for weather forecast
  useEffect(() => {
    if (stationLat !== null && stationLng !== null) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setStationLat(pos.coords.latitude);
          setStationLng(pos.coords.longitude);
        },
        () => {
          // Fallback to IP geolocation
          fetch("https://ipapi.co/json/")
            .then((res) => res.json())
            .then((data) => {
              if (data.latitude && data.longitude) {
                setStationLat(data.latitude);
                setStationLng(data.longitude);
              }
            })
            .catch(() => {
              // Default to Casablanca
              setStationLat(33.5731);
              setStationLng(-7.5898);
            });
        },
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }
  }, []);

  // Fetch weather forecast when location is available
  useEffect(() => {
    if (stationLat === null || stationLng === null) return;
    if (!mounted) return;

    const fetchForecast = async () => {
      setForecastLoading(true);
      try {
        const result = await getWeatherForecast(stationLat, stationLng, lang as "ar" | "fr" | "en");
        setForecast(result);
      } catch (error) {
        console.error("Forecast fetch error:", error);
      } finally {
        setForecastLoading(false);
      }
    };

    fetchForecast();
    // Refresh every hour
    const interval = setInterval(fetchForecast, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [stationLat, stationLng, lang, mounted]);

  // Analyze sensor trends when history changes
  useEffect(() => {
    const readings: SensorReading[] = labels.map((label, i) => ({
      timestamp: i,
      temperature: history.temperature[i] ?? null,
      humidity: history.humidity[i] ?? null,
      pressure: history.pressure[i] ?? null,
      rain: history.rain[i] ?? null,
      light: history.light[i] ?? null
    })).filter((r) => r.temperature !== null || r.humidity !== null);

    if (readings.length > 5) {
      const analysis = analyzeSensorTrends(readings);
      setTrendAnalysis(analysis);
    }
  }, [history, labels]);

  // Store historical sensor data in Firestore (hourly snapshots)
  useEffect(() => {
    if (!connected) return;
    const db = getFirebaseDb();
    if (!db) return;

    const now = new Date();
    const docId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}`;

    // Store hourly snapshot (debounced - only once per hour)
    const storeSnapshot = async () => {
      try {
        await setDoc(
          doc(db, "stations", "station-meteo", "history", docId),
          {
            timestamp: now.getTime(),
            temperature: values.temperature,
            humidity: values.humidity,
            pressure: values.pressure,
            rain: values.rain,
            light: values.light
          },
          { merge: true }
        );
      } catch (error) {
        console.error("Failed to store history:", error);
      }
    };

    // Only store once per hour (check if this hour's data exists)
    const minute = now.getMinutes();
    if (minute < 2) {
      storeSnapshot();
    }
  }, [connected, values]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandedSensor(null);
    };
    if (expandedSensor) {
      window.addEventListener("keydown", handleEsc);
      return () => window.removeEventListener("keydown", handleEsc);
    }
  }, [expandedSensor]);

  const alertZonePlugin = {
    id: "alertZones",
    beforeDraw(chart: ChartJS) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !scales.y) return;
      const meta = (chart.options.plugins as Record<string, unknown>)?.alertZones as { min: number | null; max: number | null; color: string } | undefined;
      if (!meta) return;
      ctx.save();
      if (meta.max !== null) {
        const yMax = scales.y.getPixelForValue(meta.max);
        ctx.fillStyle = "#ef444418";
        ctx.fillRect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, yMax - chartArea.top);
      }
      if (meta.min !== null) {
        const yMin = scales.y.getPixelForValue(meta.min);
        ctx.fillStyle = "#3b82f618";
        ctx.fillRect(chartArea.left, yMin, chartArea.right - chartArea.left, chartArea.bottom - yMin);
      }
      ctx.restore();
    }
  };

  const saveThreshold = (sensor: SensorKey) => {
    const newThresholds = {
      ...alertThresholds,
      [sensor]: {
        min: editingMin !== "" ? Number(editingMin) : null,
        max: editingMax !== "" ? Number(editingMax) : null
      }
    };
    setAlertThresholds(newThresholds);
    localStorage.setItem("sensor-alert-thresholds", JSON.stringify(newThresholds));
    setEditingThreshold(null);
  };

  const startEditThreshold = (sensor: SensorKey) => {
    setEditingThreshold(sensor);
    setEditingMin(alertThresholds[sensor].min !== null ? String(alertThresholds[sensor].min) : "");
    setEditingMax(alertThresholds[sensor].max !== null ? String(alertThresholds[sensor].max) : "");
  };

  const computeStats = (arr: number[]) => {
    const valid = arr.filter((n) => Number.isFinite(n));
    if (!valid.length) return { min: "--", max: "--", avg: "--" };
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
    return { min: min.toFixed(1), max: max.toFixed(1), avg: avg.toFixed(1) };
  };

  const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
    const valid = data.filter((n) => Number.isFinite(n));
    if (valid.length < 2) return null;
    const last8 = valid.slice(-8);
    const min = Math.min(...last8);
    const max = Math.max(...last8);
    const range = max - min || 1;
    const w = 80;
    const h = 24;
    const points = last8.map((v, i) => {
      const x = (i / (last8.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    }).join(" ");
    return (
      <div className={styles.sparklineWrap}>
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
          <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
          {last8.map((v, i) => {
            const x = (i / (last8.length - 1)) * w;
            const y = h - ((v - min) / range) * (h - 4) - 2;
            return <circle key={i} cx={x} cy={y} r="1.5" fill={color} opacity="0.6" />;
          })}
        </svg>
      </div>
    );
  };

  useEffect(() => {
    return () => {
      sensorKeys.forEach((sensor) => {
        if (soundFileURLs[sensor]) {
          URL.revokeObjectURL(soundFileURLs[sensor]!);
        }
        const activeAudio = soundAudioRefs.current[sensor];
        if (activeAudio) {
          activeAudio.pause();
          activeAudio.currentTime = 0;
        }
        if (beepTimersRef.current[sensor]) {
          window.clearInterval(beepTimersRef.current[sensor]);
        }
      });
    };
  }, []);

  const [showSoundEditor, setShowSoundEditor] = useState(false);
  const [editingSoundNames, setEditingSoundNames] = useState<Record<SensorKey, string>>(soundNames);
  const [editingSoundFreqs, setEditingSoundFreqs] = useState<Record<SensorKey, number>>(soundFrequencies);
  const [editingSoundVolumes, setEditingSoundVolumes] = useState<Record<SensorKey, number>>(soundVolumes);
  const [editingSoundWaves, setEditingSoundWaves] = useState<Record<SensorKey, SensorWave>>(soundWaves);
  const alerts: Record<SensorKey, boolean> = {
    temperature: values.temperature !== null ? (alertThresholds.temperature.min !== null && values.temperature < alertThresholds.temperature.min) || (alertThresholds.temperature.max !== null && values.temperature > alertThresholds.temperature.max) : false,
    humidity: values.humidity !== null ? (alertThresholds.humidity.min !== null && values.humidity < alertThresholds.humidity.min) || (alertThresholds.humidity.max !== null && values.humidity > alertThresholds.humidity.max) : false,
    pressure: values.pressure !== null ? (alertThresholds.pressure.min !== null && values.pressure < alertThresholds.pressure.min) || (alertThresholds.pressure.max !== null && values.pressure > alertThresholds.pressure.max) : false,
    rain: values.rain !== null ? (alertThresholds.rain.max !== null && values.rain > alertThresholds.rain.max) : false,
    light: values.light !== null ? (alertThresholds.light.min !== null && values.light < alertThresholds.light.min) || (alertThresholds.light.max !== null && values.light > alertThresholds.light.max) : false
  };

  // Task 2: Sensor Alert Email Triggering
  useEffect(() => {
    if (!emailSettings.sensorAlerts) return;
    const now = Date.now();
    const cooldownMs = emailSettings.sensorCooldownMin * 60 * 1000;

    sensorKeys.forEach((sensor) => {
      const wasAlert = previousAlerts.current[sensor];
      const isAlert = alerts[sensor];

      // Only send email when transitioning from normal to alert
      if (isAlert && !wasAlert) {
        const lastTime = lastSensorAlertTime.current[sensor] || 0;
        if (now - lastTime >= cooldownMs) {
          const value = values[sensor];
          const threshold = alertThresholds[sensor];
          const isHigh = threshold.max !== null && value !== null && value > threshold.max;
          const thresholdText = isHigh
            ? `> ${threshold.max}`
            : `< ${threshold.min}`;

          sendSensorAlert(
            {
              sensorName: t.sensors[sensor],
              value: value !== null ? value.toFixed(1) : "--",
              threshold: thresholdText,
              unit: units[sensor],
              timestamp: new Date().toLocaleString(locale),
              type: isHigh ? "high" : "low"
            },
            emailSettings.recipientEmail
          );
          lastSensorAlertTime.current[sensor] = now;

          // Track real alert count and history
          setAlertCounts((prev) => ({ ...prev, [sensor]: prev[sensor] + 1 }));
          setAlertHistory((prev) => [
            {
              sensor,
              time: new Date().toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
              value: `${value !== null ? value.toFixed(1) : "--"} ${units[sensor]}`,
              type: isHigh ? "high" : "low"
            },
            ...prev.slice(0, 49)
          ]);
        }
      }
      previousAlerts.current[sensor] = isAlert;
    });
  }, [alerts, values, emailSettings, t.sensors, locale]);

  // Task 3: Daily Report
  useEffect(() => {
    if (!emailSettings.dailyReport) return;

    const checkAndSendReport = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const today = now.toDateString();
      const lastReportDate = localStorage.getItem("station-last-daily-report");

      if (currentHour === emailSettings.reportHour && lastReportDate !== today) {
        const sensorData = sensorKeys.map((key) => {
          const stats = computeStats(history[key]);
          return {
            name: t.sensors[key],
            min: stats.min,
            max: stats.max,
            avg: stats.avg,
            alertCount: alertCounts[key]
          };
        });

        const totalAlerts = Object.values(alertCounts).reduce((a, b) => a + b, 0);

        sendDailyReport(
          {
            date: today,
            sensors: sensorData,
            totalAlerts,
            uptimePercent
          },
          emailSettings.recipientEmail
        );

        localStorage.setItem("station-last-daily-report", today);
      }
    };

    checkAndSendReport();
    const interval = setInterval(checkAndSendReport, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [emailSettings, history, alertCounts, uptimePercent, t.sensors]);

  // Task 4: Device Offline Alert
  useEffect(() => {
    if (!emailSettings.deviceOffline) return;

    const wasConnected = previousConnected.current;
    const isNowDisconnected = !connected;

    if (wasConnected && isNowDisconnected) {
      const now = Date.now();
      const cooldownMs = emailSettings.offlineCooldownMin * 60 * 1000;

      if (now - lastOfflineAlertTime.current >= cooldownMs) {
        const lastValues: Record<string, string> = {};
        sensorKeys.forEach((key) => {
          lastValues[key] = values[key] !== null ? `${values[key]!.toFixed(1)} ${units[key]}` : "--";
        });

        sendDeviceOfflineAlert(
          {
            timestamp: new Date().toLocaleString(locale),
            lastValues,
            rssi: rssi !== null ? `${rssi} dBm` : "--"
          },
          emailSettings.recipientEmail
        );

        lastOfflineAlertTime.current = now;
      }
    }

    previousConnected.current = connected;
  }, [connected, values, rssi, emailSettings, locale]);

  useEffect(() => {
    if (!activeSoundSensor) return;
    const sensor = activeSoundSensor;
    if (!alerts[sensor] || !soundEnabled[sensor]) return;

    const customUrl = soundFileURLs[sensor];
    const currentAudio = soundAudioRefs.current[sensor];
    if (customUrl && (!currentAudio || currentAudio.src !== customUrl)) {
      stopSensorSound(sensor);
      playSensorSound(sensor);
    }
  }, [activeSoundSensor, alerts, soundEnabled, soundFileURLs, soundVolumes, repeatShortSounds]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const bootAudio = async () => {
      if (audioCtxRef.current) return;
      const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      audioCtxRef.current = new Ctx();
      if (audioCtxRef.current.state === "suspended") {
        try {
          await audioCtxRef.current.resume();
        } catch {
          // ignore
        }
      }
    };

    const onFirstUserAction = async () => {
      startedByUserRef.current = true;
      await bootAudio();
      if (audioCtxRef.current?.state === "suspended") {
        try {
          await audioCtxRef.current.resume();
        } catch {
          // ignore
        }
      }
      window.removeEventListener("pointerdown", onFirstUserAction);
    };

    window.addEventListener("pointerdown", onFirstUserAction, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onFirstUserAction);
    };
  }, []);

  useEffect(() => {
    const loadSoundSettings = () => {
      try {
        const saved = localStorage.getItem("sound-settings");
        if (saved) {
          const { names, frequencies, volumes, waves } = JSON.parse(saved);
          if (names) setSoundNames(names);
          if (frequencies) setSoundFrequencies(frequencies);
          if (volumes) setSoundVolumes(volumes);
          if (waves) setSoundWaves(waves);
        }
      } catch {
        // ignore
      }
    };
    loadSoundSettings();
  }, []);

  const stopSensorSound = (sensor: SensorKey) => {
    if (beepTimersRef.current[sensor]) {
      window.clearInterval(beepTimersRef.current[sensor]);
      delete beepTimersRef.current[sensor];
    }
    const activeAudio = soundAudioRefs.current[sensor];
    if (activeAudio) {
      activeAudio.onended = null;
      activeAudio.pause();
      activeAudio.currentTime = 0;
      delete soundAudioRefs.current[sensor];
    }
  };

  const playSensorSound = (sensor: SensorKey) => {
    const customUrl = soundFileURLs[sensor];
    if (customUrl) {
      const existingAudio = soundAudioRefs.current[sensor];
      if (existingAudio && !existingAudio.paused && !existingAudio.ended) {
        return;
      }

      if (existingAudio) {
        existingAudio.onended = null;
        existingAudio.pause();
        existingAudio.currentTime = 0;
      }

      const audio = new Audio(customUrl);
      audio.volume = Math.max(0.05, Math.min(0.9, soundVolumes[sensor] / 100));
      audio.loop = repeatShortSounds[sensor];
      audio.onended = () => {
        if (!repeatShortSounds[sensor]) {
          delete soundAudioRefs.current[sensor];
        }
      };
      soundAudioRefs.current[sensor] = audio;
      audio.play().catch(() => {
        // ignore play errors from user gesture restrictions
      });
      return;
    }

    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state !== "running") return;

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = soundWaves[sensor];
    oscillator.frequency.value = soundFrequencies[sensor];
    const maxGain = Math.max(0.01, Math.min(0.6, soundVolumes[sensor] / 100));
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(maxGain, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.24);
  };

  const isSensorSoundPlaying = (sensor: SensorKey) => {
    const activeAudio = soundAudioRefs.current[sensor];
    if (activeAudio && !activeAudio.paused && !activeAudio.ended) {
      return true;
    }
    return Boolean(beepTimersRef.current[sensor]);
  };

  useEffect(() => {
    const manageSensorSound = () => {
      const activeSensors = sensorKeys.filter((s) => alerts[s] && soundEnabled[s]);

      if (activeSoundSensor !== null) {
        const currentValid = soundEnabled[activeSoundSensor];
        if (!currentValid) {
          stopSensorSound(activeSoundSensor);
          setActiveSoundSensor(null);
        } else {
          return;
        }
      }

      if (activeSoundSensor === null && activeSensors.length > 0) {
        const randomSensor = activeSensors[Math.floor(Math.random() * activeSensors.length)];
        setActiveSoundSensor(randomSensor);
        playSensorSound(randomSensor);
      }
    };

    manageSensorSound();

    return () => {
      sensorKeys.forEach((sensor) => stopSensorSound(sensor));
    };
  }, [alerts, soundEnabled, soundFileURLs, repeatShortSounds, activeSoundSensor]);

  useEffect(() => {
    const raw = localStorage.getItem(PROJECT_IMAGE_STORAGE_KEY);
    if (!raw) return;
    try {
      const map = JSON.parse(raw) as Record<number, string>;
      if (map[1]) setHeroImage(map[1]);
    } catch {
      // ignore invalid cache
    }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(PROJECT_IMAGE_SECONDARY_STORAGE_KEY);
    if (!raw) return;
    try {
      const map = JSON.parse(raw) as Record<number, string>;
      if (map[1]) setHeroSecondaryImage(map[1]);
    } catch {
      // ignore invalid cache
    }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(PROJECT_IMAGE_STYLE_STORAGE_KEY);
    if (!raw) return;
    try {
      const map = JSON.parse(raw) as Record<number, (typeof defaultProjectImageStyles)[1]>;
      if (map[1]) setHeroImageStyle(map[1]);
    } catch {
      // ignore invalid cache
    }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(PROJECT_BG_STORAGE_KEY);
    if (!raw) return;
    try {
      const map = JSON.parse(raw) as Record<number, string>;
      if (map[1]) setProjectBackground(map[1]);
    } catch {
      // ignore invalid cache
    }
  }, []);

  // Real ESP32 data is written directly to Firestore by the device.
  // No fake data writer — the onSnapshot listener below picks up real updates.

  useEffect(() => {
    const db = getFirebaseDb();
    if (!db) return;

    const ref = doc(db, "stations", "station-meteo");
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setConnected(false);
        setLastSeen(t.unknownLastSeen);
        setRssi(null);
        setSignalQuality(null);
        return;
      }

      const data = snap.data() as {
        connected?: boolean;
        lastSeen?: Timestamp | string | number;
        rssi?: number | null;
        signalQuality?: number | null;
        sensors?: SensorValues;
      };

      const sensorValues = data.sensors ?? { temperature: null, humidity: null, pressure: null, rain: null, light: null };
      setConnected(Boolean(data.connected));
      setLastSeen(formatLastSeen(data.lastSeen, locale, t.unknownLastSeen));
      setRssi(typeof data.rssi === "number" ? data.rssi : null);
      setSignalQuality(typeof data.signalQuality === "number" ? data.signalQuality : null);
      setValues(sensorValues);

      const stamp = new Date().toLocaleTimeString(locale);

      // Clear seed data on first real data from ESP32
      if (firstRealDataRef.current) {
        firstRealDataRef.current = false;
        setLabels([stamp]);
        setHistory({
          temperature: [sensorValues.temperature ?? NaN],
          humidity: [sensorValues.humidity ?? NaN],
          pressure: [sensorValues.pressure ?? NaN],
          rain: [sensorValues.rain ?? NaN],
          light: [sensorValues.light ?? NaN]
        });
      } else {
        setLabels((prev) => [...prev.slice(-26), stamp]);
        setHistory((prev) => ({
          temperature: [...prev.temperature.slice(-26), sensorValues.temperature ?? NaN],
          humidity: [...prev.humidity.slice(-26), sensorValues.humidity ?? NaN],
          pressure: [...prev.pressure.slice(-26), sensorValues.pressure ?? NaN],
          rain: [...prev.rain.slice(-26), sensorValues.rain ?? NaN],
          light: [...prev.light.slice(-26), sensorValues.light ?? NaN]
        }));
      }
    }, (err) => {
      console.warn("[WeatherStation] Firestore listener error:", err.message);
      setConnected(false);
    });

    return () => unsub();
  }, [locale, t.unknownLastSeen]);

  useEffect(() => {
    const db = getFirebaseDb();
    if (db) return;

    const applyLocalReading = () => {
      setValues((current) => {
        const nextValues = generateFake(current);
        const nextConnected = Math.random() > 0.12;
        const nextRssi = nextConnected ? -45 - Math.floor(Math.random() * 35) : null;
        const nextSignal = nextConnected ? Math.max(10, Math.min(100, 100 + (nextRssi ?? -100))) : null;
        const stamp = new Date().toLocaleTimeString(locale);

        setConnected(nextConnected);
        setLastSeen(new Date().toLocaleString(locale));
        setRssi(nextRssi);
        setSignalQuality(nextSignal);
        setLabels((prev) => [...prev.slice(-26), stamp]);
        setHistory((prev) => ({
          temperature: [...prev.temperature.slice(-26), nextValues.temperature ?? NaN],
          humidity: [...prev.humidity.slice(-26), nextValues.humidity ?? NaN],
          pressure: [...prev.pressure.slice(-26), nextValues.pressure ?? NaN],
          rain: [...prev.rain.slice(-26), nextValues.rain ?? NaN],
          light: [...prev.light.slice(-26), nextValues.light ?? NaN]
        }));

        return nextValues;
      });
    };

    applyLocalReading();
    const timer = window.setInterval(applyLocalReading, 2800);
    return () => window.clearInterval(timer);
  }, [locale]);

  const statusLabel = connected ? t.connected : t.disconnected;

  const downloadExcel = () => {
    const readings: Array<{
      time: string;
      temperature: number | string;
      humidity: number | string;
      pressure: number | string;
      rain: number | string;
      light: number | string;
      status: string;
      rssi: number | string;
      signal: number | string;
    }> = [];

    const len = labels.length;
    for (let i = 0; i < len; i += 1) {
      readings.push({
        time: labels[i] || "",
        temperature: Number.isFinite(history.temperature[i]) ? Number(history.temperature[i].toFixed(2)) : "--",
        humidity: Number.isFinite(history.humidity[i]) ? Number(history.humidity[i].toFixed(2)) : "--",
        pressure: Number.isFinite(history.pressure[i]) ? Number(history.pressure[i].toFixed(2)) : "--",
        rain: Number.isFinite(history.rain[i]) ? Number(history.rain[i].toFixed(2)) : "--",
        light: Number.isFinite(history.light[i]) ? Number(history.light[i].toFixed(2)) : "--",
        status: statusLabel,
        rssi: rssi ?? "--",
        signal: signalQuality ?? "--"
      });
    }

    if (readings.length === 0) {
      readings.push({
        time: new Date().toLocaleTimeString(locale),
        temperature: values.temperature ?? "--",
        humidity: values.humidity ?? "--",
        pressure: values.pressure ?? "--",
        rain: values.rain ?? "--",
        light: values.light ?? "--",
        status: statusLabel,
        rssi: rssi ?? "--",
        signal: signalQuality ?? "--"
      });
    }

    const numericOnly = (arr: number[]) => arr.filter((n) => Number.isFinite(n));
    const maxVal = (arr: number[]) => {
      const cleaned = numericOnly(arr);
      return cleaned.length ? Math.max(...cleaned).toFixed(2) : "--";
    };
    const minVal = (arr: number[]) => {
      const cleaned = numericOnly(arr);
      return cleaned.length ? Math.min(...cleaned).toFixed(2) : "--";
    };
    const avgVal = (arr: number[]) => {
      const cleaned = numericOnly(arr);
      if (!cleaned.length) return "--";
      const avg = cleaned.reduce((a, b) => a + b, 0) / cleaned.length;
      return avg.toFixed(2);
    };

    const escapeXml = (value: string | number) =>
      String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");

    const headerRow = `
      <Row>
        <Cell><Data ss:Type="String">Time</Data></Cell>
        <Cell><Data ss:Type="String">Temperature (deg C)</Data></Cell>
        <Cell><Data ss:Type="String">Humidity (%)</Data></Cell>
        <Cell><Data ss:Type="String">Pressure (hPa)</Data></Cell>
        <Cell><Data ss:Type="String">Rain (%)</Data></Cell>
        <Cell><Data ss:Type="String">Light (Lux)</Data></Cell>
        <Cell><Data ss:Type="String">Status</Data></Cell>
        <Cell><Data ss:Type="String">RSSI (dBm)</Data></Cell>
        <Cell><Data ss:Type="String">Signal Quality (%)</Data></Cell>
      </Row>`;

    const dataRows = readings
      .map(
        (r) => `
      <Row>
        <Cell><Data ss:Type="String">${escapeXml(r.time)}</Data></Cell>
        <Cell><Data ss:Type="${typeof r.temperature === "number" ? "Number" : "String"}">${escapeXml(r.temperature)}</Data></Cell>
        <Cell><Data ss:Type="${typeof r.humidity === "number" ? "Number" : "String"}">${escapeXml(r.humidity)}</Data></Cell>
        <Cell><Data ss:Type="${typeof r.pressure === "number" ? "Number" : "String"}">${escapeXml(r.pressure)}</Data></Cell>
        <Cell><Data ss:Type="${typeof r.rain === "number" ? "Number" : "String"}">${escapeXml(r.rain)}</Data></Cell>
        <Cell><Data ss:Type="${typeof r.light === "number" ? "Number" : "String"}">${escapeXml(r.light)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(r.status)}</Data></Cell>
        <Cell><Data ss:Type="${typeof r.rssi === "number" ? "Number" : "String"}">${escapeXml(r.rssi)}</Data></Cell>
        <Cell><Data ss:Type="${typeof r.signal === "number" ? "Number" : "String"}">${escapeXml(r.signal)}</Data></Cell>
      </Row>`
      )
      .join("");

    const summaryRows = `
      <Row><Cell><Data ss:Type="String">Metric</Data></Cell><Cell><Data ss:Type="String">Max</Data></Cell><Cell><Data ss:Type="String">Min</Data></Cell><Cell><Data ss:Type="String">Avg</Data></Cell></Row>
      <Row><Cell><Data ss:Type="String">Temperature</Data></Cell><Cell><Data ss:Type="String">${maxVal(history.temperature)}</Data></Cell><Cell><Data ss:Type="String">${minVal(history.temperature)}</Data></Cell><Cell><Data ss:Type="String">${avgVal(history.temperature)}</Data></Cell></Row>
      <Row><Cell><Data ss:Type="String">Humidity</Data></Cell><Cell><Data ss:Type="String">${maxVal(history.humidity)}</Data></Cell><Cell><Data ss:Type="String">${minVal(history.humidity)}</Data></Cell><Cell><Data ss:Type="String">${avgVal(history.humidity)}</Data></Cell></Row>
      <Row><Cell><Data ss:Type="String">Pressure</Data></Cell><Cell><Data ss:Type="String">${maxVal(history.pressure)}</Data></Cell><Cell><Data ss:Type="String">${minVal(history.pressure)}</Data></Cell><Cell><Data ss:Type="String">${avgVal(history.pressure)}</Data></Cell></Row>
      <Row><Cell><Data ss:Type="String">Rain</Data></Cell><Cell><Data ss:Type="String">${maxVal(history.rain)}</Data></Cell><Cell><Data ss:Type="String">${minVal(history.rain)}</Data></Cell><Cell><Data ss:Type="String">${avgVal(history.rain)}</Data></Cell></Row>
      <Row><Cell><Data ss:Type="String">Light</Data></Cell><Cell><Data ss:Type="String">${maxVal(history.light)}</Data></Cell><Cell><Data ss:Type="String">${minVal(history.light)}</Data></Cell><Cell><Data ss:Type="String">${avgVal(history.light)}</Data></Cell></Row>
    `;

    const excelXml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <Worksheet ss:Name="Readings">
    <Table>
      ${headerRow}
      ${dataRows}
    </Table>
  </Worksheet>
  <Worksheet ss:Name="Summary">
    <Table>
      ${summaryRows}
    </Table>
  </Worksheet>
</Workbook>`;

    const blob = new Blob(["\uFEFF" + excelXml], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(
      now.getHours()
    ).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(now.getSeconds()).padStart(2, "0")}`;
    a.href = url;
    a.download = `station_meteo_${stamp}.xls`;
    a.click();
    URL.revokeObjectURL(url);

    setToast(true);
    setTimeout(() => setToast(false), 2200);
  };

  const cards = sensorKeys.map((key) => ({
    key,
    title: t.sensors[key],
    value: values[key],
    color: chartColors[key],
    unit: units[key],
    history: history[key],
    trend: getTrend(history[key], values[key])
  }));
  const sensorAlertRules: Record<SensorKey, string> = {
    temperature: `temp ${alertThresholds.temperature.min !== null ? `< ${alertThresholds.temperature.min}` : ""}${alertThresholds.temperature.min !== null && alertThresholds.temperature.max !== null ? " OR " : ""}${alertThresholds.temperature.max !== null ? `> ${alertThresholds.temperature.max}` : ""} deg C`,
    humidity: `humidity ${alertThresholds.humidity.min !== null ? `< ${alertThresholds.humidity.min}%` : ""}${alertThresholds.humidity.min !== null && alertThresholds.humidity.max !== null ? " OR " : ""}${alertThresholds.humidity.max !== null ? `> ${alertThresholds.humidity.max}%` : ""}`,
    pressure: `pressure ${alertThresholds.pressure.min !== null ? `< ${alertThresholds.pressure.min}` : ""}${alertThresholds.pressure.min !== null && alertThresholds.pressure.max !== null ? " OR " : ""}${alertThresholds.pressure.max !== null ? `> ${alertThresholds.pressure.max}` : ""} hPa`,
    light: `light ${alertThresholds.light.min !== null ? `< ${alertThresholds.light.min}` : ""}${alertThresholds.light.min !== null && alertThresholds.light.max !== null ? " OR " : ""}${alertThresholds.light.max !== null ? `> ${alertThresholds.light.max}` : ""} lux`,
    rain: `rain ${alertThresholds.rain.max !== null ? `> ${alertThresholds.rain.max} mm/h` : ""}`
  };

  const toggleSound = (sensor: SensorKey) => {
    setSoundEnabled((prev) => {
      const nextEnabled = { ...prev, [sensor]: !prev[sensor] };
      if (prev[sensor] && activeSoundSensor) {
        stopSensorSound(activeSoundSensor);
        setActiveSoundSensor(null);
      }
      return nextEnabled;
    });
  };

  const saveSoundSettings = () => {
    setSoundNames(editingSoundNames);
    setSoundFrequencies(editingSoundFreqs);
    setSoundVolumes(editingSoundVolumes);
    setSoundWaves(editingSoundWaves);
    localStorage.setItem(
      "sound-settings",
      JSON.stringify({
        names: editingSoundNames,
        frequencies: editingSoundFreqs,
        volumes: editingSoundVolumes,
        waves: editingSoundWaves
      })
    );
    setShowSoundEditor(false);
  };

  const resetSoundSettings = () => {
    setEditingSoundNames(soundNames);
    setEditingSoundFreqs(soundFrequencies);
    setEditingSoundVolumes(soundVolumes);
    setEditingSoundWaves(soundWaves);
    setShowSoundEditor(false);
  };

  return (
    <section className={styles.page} style={{ background: projectBackground }}>
      <header className={styles.navbar}>
        <Link href="/home" className={styles.backBtn}>
          {t.back}
        </Link>
        <div className={styles.navbarText}>
          <EditableText id={`station-brand-${lang}`} defaultText={t.brand} as="h2" className={styles.brand} editable={canEditText} />
          <EditableText id={`station-sub-${lang}`} defaultText={t.subtitle} as="p" className={styles.subtitle} editable={canEditText} />
        </div>
      </header>

      <div className={styles.body}>
        <article className={styles.heroCard}>
          <div className={styles.heroMedia}>
            <img
              src={heroImage}
              alt="Station Meteo"
              className={styles.heroImg}
              style={{ objectFit: "cover" }}
            />
          </div>

          <div className={styles.statusCard}>
            <div className={styles.statusHead}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.3rem" }}>📡</span>
                <EditableText id={`station-title-${lang}`} defaultText={t.title} as="h3" editable={canEditText} />
                <button
                  className={`${styles.refreshBtn} ${refreshing ? styles.refreshBtnSpin : ""}`}
                  onClick={() => {
                    setRefreshing(true);
                    setTimeout(() => setRefreshing(false), 600);
                  }}
                  title="Refresh"
                >
                  &#x21BB;
                </button>
              </div>
              <span className={`${styles.statusBadge} ${connected ? styles.good : styles.bad}`}>
                <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: connected ? "#58d3ad" : "#ff9d9c", marginRight: 4 }} />
                {statusLabel}
              </span>
            </div>

            <EditableText
              id={`station-hero-sub-${lang}`}
              defaultText={t.subtitle}
              as="p"
              className={styles.heroDescription}
              editable={canEditText}
            />

            {/* Enhanced Metrics Grid */}
            <div className={styles.statusMeta}>
              {/* Signal Quality */}
              <div className={styles.metricCard}>
                <div className={styles.metricIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={signalQuality && signalQuality > 50 ? "#58d3ad" : "#ffb347"} strokeWidth="2">
                    <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
                    <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
                    <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
                    <line x1="12" y1="20" x2="12.01" y2="20"/>
                  </svg>
                </div>
                <EditableText id={`station-signal-${lang}`} defaultText={t.signal} as="span" editable={canEditText} />
                <strong className={signalQuality && signalQuality > 70 ? styles.metricGood : signalQuality && signalQuality > 40 ? styles.metricWarning : styles.metricBad}>
                  {signalQuality === null ? "-- %" : `${signalQuality}%`}
                </strong>
                {signalQuality !== null && (
                  <div className={styles.signalBar}>
                    <div
                      className={`${styles.signalBarFill} ${signalQuality > 70 ? styles.signalGood : signalQuality > 40 ? styles.signalMedium : styles.signalWeak}`}
                      style={{ width: `${signalQuality}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Wi-Fi RSSI */}
              <div className={styles.metricCard}>
                <div className={styles.metricIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={rssi && rssi > -60 ? "#58d3ad" : rssi && rssi > -80 ? "#ffb347" : "#ff6b6b"} strokeWidth="2">
                    <path d="M1 1l22 22"/>
                    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
                    <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
                    <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
                    <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
                    <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
                    <line x1="12" y1="20" x2="12.01" y2="20"/>
                  </svg>
                </div>
                <EditableText id={`station-rssi-${lang}`} defaultText={t.rssi} as="span" editable={canEditText} />
                <strong className={rssi && rssi > -60 ? styles.metricGood : rssi && rssi > -80 ? styles.metricWarning : styles.metricBad}>
                  {rssi === null ? "-- dBm" : `${rssi} dBm`}
                </strong>
                {rssi !== null && (
                  <div className={styles.signalBar}>
                    <div
                      className={`${styles.signalBarFill} ${rssi > -50 ? styles.signalGood : rssi > -70 ? styles.signalMedium : styles.signalWeak}`}
                      style={{ width: `${Math.min(100, Math.max(5, 100 + rssi))}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Uptime Percentage */}
              <div className={styles.metricCard}>
                <div className={styles.metricIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={Number(uptimePercent) > 90 ? "#58d3ad" : Number(uptimePercent) > 70 ? "#ffb347" : "#ff6b6b"} strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                </div>
                <span>{lang === "ar" ? "نسبة التشغيل" : lang === "fr" ? "Temps en ligne" : "Uptime"}</span>
                <strong className={Number(uptimePercent) > 90 ? styles.metricGood : Number(uptimePercent) > 70 ? styles.metricWarning : styles.metricBad}>
                  {uptimePercent}%
                </strong>
                <div className={styles.signalBar}>
                  <div
                    className={`${styles.signalBarFill} ${Number(uptimePercent) > 90 ? styles.signalGood : Number(uptimePercent) > 70 ? styles.signalMedium : styles.signalWeak}`}
                    style={{ width: `${uptimePercent}%` }}
                  />
                </div>
              </div>

              {/* Last Seen / Connection Time */}
              <div className={styles.metricCard}>
                <div className={styles.metricIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={connected ? "#58d3ad" : "#ff6b6b"} strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <EditableText id={`station-lastseen-${lang}`} defaultText={t.lastSeen} as="span" editable={canEditText} />
                <strong style={{ fontSize: "0.72rem" }}>{lastSeen || t.unknownLastSeen}</strong>
              </div>
            </div>

            {/* Export Button */}
            <div className={styles.exportWrap} style={{ marginTop: "0.8rem" }}>
              <button className={styles.exportBtn} onClick={downloadExcel}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                <EditableText id={`station-export-${lang}`} defaultText={t.exportBtn} editable={canEditText} />
              </button>
            </div>

            {/* 24h Connection Timeline */}
            <div className={styles.connectionTimeline}>
              {connectionHistory.map((h, i) => (
                <div
                  key={i}
                  className={`${styles.connectionBar} ${h.online ? styles.connectionOnline : styles.connectionOffline}`}
                  style={{ height: `${h.online ? 100 : 30}%` }}
                  onMouseEnter={() => setHoveredBar(i)}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  {hoveredBar === i && (
                    <div className={styles.barTooltip}>
                      {`${String(h.hour).padStart(2, "0")}:00`}
                      <span className={h.online ? styles.tooltipOnline : styles.tooltipOffline}>
                        {h.online ? "Online" : "Offline"}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.3rem", fontSize: "0.65rem", color: "#7a95b8" }}>
              <span>📊 {lang === "ar" ? "سجل 24 ساعة" : lang === "fr" ? "Historique 24h" : "24h History"}</span>
              <span>{connected ? "🟢 " + (lang === "ar" ? "متصل الآن" : lang === "fr" ? "En ligne" : "Online Now") : "🔴 " + (lang === "ar" ? "غير متصل" : lang === "fr" ? "Hors ligne" : "Offline")}</span>
            </div>

            {!connected && (
              <div>
                <EditableText
                  id={`station-offline-msg-${lang}`}
                  defaultText={t.noteOffline}
                  as="p"
                  className={styles.offlineMsg}
                  editable={canEditText}
                />
                <button className={styles.retryBtn} onClick={() => window.location.reload()}>
                  {lang === "ar" ? "\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629" : lang === "fr" ? "Reessayer" : "Retry"}
                </button>
              </div>
            )}
          </div>
        </article>
        
        <div className={styles.mapLinkSection}>
          <Link href="/map" className={styles.mapLinkBtn}>
            {"\uD83D\uDDFA\uFE0F"} {lang === "ar" ? "\u0639\u0631\u0636 \u0627\u0644\u062E\u0631\u064A\u0637\u0629" : lang === "fr" ? "Voir la carte" : "View Map"}
          </Link>
        </div>
        
        <div className={styles.rangeSelector}>
          {[
            { value: 8, label: lang === "ar" ? "اليوم" : lang === "fr" ? "Jour" : "Today" },
            { value: 16, label: lang === "ar" ? "\u0623\u0633\u0628\u0648\u0639" : lang === "fr" ? "Semaine" : "Week" },
            { value: 28, label: lang === "ar" ? "\u0634\u0647\u0631" : lang === "fr" ? "Mois" : "Month" }
          ].map((r) => (
            <button
              key={r.value}
              className={`${styles.rangeBtn} ${chartRange === r.value ? styles.rangeBtnActive : ""}`}
              onClick={() => setChartRange(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className={styles.sensorGrid}>
          {cards.map((sensor, index) => {
            const stats = computeStats(sensor.history);
            const validHist = sensor.history.filter((n) => Number.isFinite(n));
            const firstVal = validHist.length > 0 ? validHist[0] : null;
            const changePercent = firstVal !== null && firstVal !== 0 && sensor.value !== null
              ? (((sensor.value - firstVal) / Math.abs(firstVal)) * 100).toFixed(1)
              : null;
            const rangeLabels = labels.slice(-chartRange);
            const rangeHistory = sensor.history.slice(-chartRange);
            const threshold = alertThresholds[sensor.key];
            return (
              <article key={sensor.key} className={styles.sensorCard} style={{ "--delay": `${index * 90}ms` } as CSSProperties}>
                <div className={styles.sensorTitleRow}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <EditableText id={`station-sensor-title-${lang}-${sensor.key}`} defaultText={sensor.title} as="h3" editable={canEditText} />
                    <button className={styles.expandBtn} onClick={() => setExpandedSensor(sensor.key)} title="Expand">
                      &#x26F6;
                    </button>
                  </div>
                  <strong style={{ color: sensor.color }} dir="ltr">
                    {formatSensorValue(sensor.value, 1)} {sensor.unit}{" "}
                    <span
                      className={
                        sensor.trend === "up" ? styles.trendUp : sensor.trend === "down" ? styles.trendDown : styles.trendFlat
                      }
                    >
                      {sensor.trend === "up" ? "\u25B2" : sensor.trend === "down" ? "\u25BC" : "\u25AC"}
                    </span>
                    {changePercent !== null && (
                      <span className={`${styles.changePercent} ${Number(changePercent) >= 0 ? styles.changePercentUp : styles.changePercentDown}`}>
                        {Number(changePercent) >= 0 ? "+" : ""}{changePercent}%
                      </span>
                    )}
                  </strong>
                </div>
                <div className={styles.chartWrap} dir="ltr">
                  {mounted ? (
                    <Line
                      data={{
                        labels: rangeLabels,
                        datasets: [
                          {
                            data: rangeHistory,
                            borderColor: sensor.color,
                            backgroundColor: `${sensor.color}22`,
                            fill: true
                          }
                        ]
                      }}
                      options={{
                        ...getChartOptions(sensor.key, sensor.unit),
                        events: [] as string[],
                        plugins: {
                          ...getChartOptions(sensor.key, sensor.unit).plugins,
                          tooltip: { enabled: false },
                          alertZones: {
                            min: threshold.min,
                            max: threshold.max,
                            color: sensor.color
                          }
                        } as Record<string, unknown>
                      } as ChartOptions<"line">}
                      plugins={[alertZonePlugin]}
                    />
                  ) : (
                    <div className={styles.chartLoading}>Loading chart...</div>
                  )}
                </div>
                <div className={styles.cardStatsBar}>
                  <span>Min: {stats.min}</span>
                  <span>|</span>
                  <span>Max: {stats.max}</span>
                  <span>|</span>
                  <span>Avg: {stats.avg}</span>
                </div>
              </article>
            );
          })}
        </div>

        {expandedSensor && (() => {
          const card = cards.find((c) => c.key === expandedSensor);
          if (!card) return null;
          const stats = computeStats(card.history);
          return (
            <div className={styles.chartModalOverlay} onClick={() => setExpandedSensor(null)}>
              <div className={styles.chartModal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.chartModalHeader}>
                  <span className={styles.chartModalTitle}>{card.title} ({card.unit})</span>
                  <button className={styles.chartModalClose} onClick={() => setExpandedSensor(null)}>\u2715</button>
                </div>
                <div className={styles.chartModalBody} dir="ltr">
                  {mounted && (
                    <Line
                      data={{
                        labels,
                        datasets: [
                          {
                            data: card.history,
                            borderColor: card.color,
                            backgroundColor: `${card.color}22`,
                            fill: true
                          }
                        ]
                      }}
                      options={{
                        ...getChartOptions(card.key, card.unit),
                        events: ["mousemove", "mouseout", "click"],
                        interaction: { mode: "index", intersect: false },
                        plugins: {
                          ...getChartOptions(card.key, card.unit).plugins,
                          tooltip: {
                            enabled: true,
                            displayColors: false,
                            backgroundColor: "rgba(10, 18, 32, 0.96)",
                            borderColor: "rgba(148, 163, 184, 0.55)",
                            borderWidth: 1,
                            titleColor: "#e2e8f0",
                            bodyColor: "#f8fafc",
                            padding: 10,
                            callbacks: {
                              title(context) {
                                const label = context[0]?.label || "";
                                return label ? `Time: ${label}` : "Reading";
                              },
                              label(context) {
                                const current = typeof context.parsed.y === "number" ? context.parsed.y : Number.NaN;
                                const rawData = (context.dataset.data as number[]).filter((n) => Number.isFinite(n));
                                const max = rawData.length ? Math.max(...rawData) : Number.NaN;
                                const min = rawData.length ? Math.min(...rawData) : Number.NaN;
                                const currentTxt = Number.isFinite(current) ? current.toFixed(2) : "--";
                                const maxTxt = Number.isFinite(max) ? max.toFixed(2) : "--";
                                const minTxt = Number.isFinite(min) ? min.toFixed(2) : "--";
                                return [
                                  `Now: ${currentTxt} ${card.unit}`,
                                  `Max: ${maxTxt} ${card.unit}`,
                                  `Min: ${minTxt} ${card.unit}`
                                ];
                              }
                            }
                          }
                        }
                      }}
                    />
                  )}
                </div>
                <div className={styles.chartModalStats}>
                  <span>Min: {stats.min} {card.unit}</span>
                  <span>|</span>
                  <span>Max: {stats.max} {card.unit}</span>
                  <span>|</span>
                  <span>Avg: {stats.avg} {card.unit}</span>
                  <span>|</span>
                  <span>Current: {formatSensorValue(card.value, 1)} {card.unit}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Weather Forecast Panel - Toggle */}
        <button
          type="button"
          className={styles.forecastToggleButton}
          onClick={() => setForecastVisible(!forecastVisible)}
          aria-expanded={forecastVisible}
        >
          <span className={styles.forecastToggleIcon}>🤖</span>
          <span className={styles.forecastToggleText}>
            {lang === "ar" ? "التنبؤ بالطقس" : lang === "fr" ? "Previsions meteo" : "Weather Forecast"}
          </span>
          <span className={styles.forecastToggleArrow}>{forecastVisible ? "▲" : "▼"}</span>
        </button>

        {/* Weather Forecast Panel */}
        {forecastVisible && (
          <article className={styles.forecastSection}>
            <div className={styles.forecastHeader}>
              <div className={styles.forecastTitleRow}>
                <span className={styles.forecastAiIcon}>🤖</span>
                <h3 className={styles.forecastTitle}>
                  {lang === "ar" ? "التنبؤ بالطقس" : lang === "fr" ? "Previsions meteo" : "Weather Forecast"}
                </h3>
                <span className={styles.forecastDays}>
                  {lang === "ar" ? "3 أيام" : lang === "fr" ? "3 jours" : "3 days"}
                </span>
              </div>
              {trendAnalysis && (
                <span className={styles.forecastBadge}>
                  {trendAnalysis.confidence > 50 ? "🔬 " : "📊 "}
                  {lang === "ar" ? "تحليل الحساسات" : lang === "fr" ? "Analyse capteurs" : "Sensor Analysis"}
                </span>
              )}
            </div>

            {forecastLoading ? (
              <div className={styles.forecastLoading}>
                <div className={styles.forecastSpinner} />
                <span>{lang === "ar" ? "جاري جلب التنبؤات..." : lang === "fr" ? "Chargement des previsions..." : "Loading forecast..."}</span>
              </div>
            ) : forecast && forecast.days.length > 0 ? (
              <div className={styles.forecastGrid}>
                {forecast.days.map((day, index) => {
                  const intensityLabel = day.rainIntensity === "light"
                    ? (lang === "ar" ? "خفيفة" : lang === "fr" ? "légère" : "light")
                    : day.rainIntensity === "moderate"
                    ? (lang === "ar" ? "متوسطة" : lang === "fr" ? "modérée" : "moderate")
                    : day.rainIntensity === "heavy"
                    ? (lang === "ar" ? "غزيرة" : lang === "fr" ? "forte" : "heavy")
                    : null;

                  return (
                  <div key={day.date} className={styles.forecastCard} style={{ "--delay": `${index * 100}ms` } as CSSProperties}>
                    <div className={styles.forecastCardHeader}>
                      <span className={styles.forecastDayName}>{day.dayName}</span>
                      <span className={styles.forecastDate}>{new Date(day.date).toLocaleDateString(locale, { day: "numeric", month: "short" })}</span>
                    </div>
                    <div className={styles.forecastIcon}>
                      <img src={day.iconUrl} alt={day.description} width={64} height={64} />
                    </div>
                    <div className={styles.forecastDescription}>{day.description}</div>
                    <div className={styles.forecastTempRow}>
                      <span className={styles.forecastTempHigh}>↑ {day.tempMax}°</span>
                      <span className={styles.forecastTempLow}>↓ {day.tempMin}°</span>
                    </div>

                    {/* Sensor-based forecast events */}
                    <div className={styles.forecastEventsList}>
                      {/* Humidity - always shown as it's always measurable */}
                      <div className={styles.forecastEventItem}>
                        <span className={styles.forecastEventIcon}>💧</span>
                        <span className={styles.forecastEventLabel}>
                          {lang === "ar" ? "الرطوبة المتوقعة" : lang === "fr" ? "Humidité prévue" : "Expected humidity"}:
                        </span>
                        <span className={styles.forecastEventValue}>{day.humidity}%</span>
                      </div>

                      {/* Rain - shown with intensity if probability > 0 */}
                      {day.rainProbability > 0 && intensityLabel && (
                        <div className={styles.forecastEventItem}>
                          <span className={styles.forecastEventIcon}>🌧️</span>
                          <span className={styles.forecastEventLabel}>
                            {lang === "ar"
                              ? `احتمال أمطار ${intensityLabel}`
                              : lang === "fr"
                              ? `Pluie ${intensityLabel}`
                              : `${intensityLabel} rain`}:
                          </span>
                          <span className={styles.forecastEventValue}>{day.rainProbability}%</span>
                        </div>
                      )}

                      {/* Fog - only if probability > 0 */}
                      {day.fogProbability > 0 && (
                        <div className={styles.forecastEventItem}>
                          <span className={styles.forecastEventIcon}>🌫️</span>
                          <span className={styles.forecastEventLabel}>
                            {lang === "ar" ? "احتمال تشكل الضباب" : lang === "fr" ? "Brouillard probable" : "Fog likely"}:
                          </span>
                          <span className={styles.forecastEventValue}>{day.fogProbability}%</span>
                        </div>
                      )}

                      {/* Storm - only if probability > 0 */}
                      {day.stormProbability > 0 && (
                        <div className={styles.forecastEventItem}>
                          <span className={styles.forecastEventIcon}>⛈️</span>
                          <span className={styles.forecastEventLabel}>
                            {lang === "ar" ? "احتمال عواصف" : lang === "fr" ? "Orages probables" : "Storms likely"}:
                          </span>
                          <span className={styles.forecastEventValue}>{day.stormProbability}%</span>
                        </div>
                      )}

                      {/* Wind */}
                      <div className={styles.forecastEventItem}>
                        <span className={styles.forecastEventIcon}>💨</span>
                        <span className={styles.forecastEventLabel}>
                          {lang === "ar" ? "سرعة الرياح" : lang === "fr" ? "Vent" : "Wind"}:
                        </span>
                        <span className={styles.forecastEventValue}>{day.windSpeed} m/s</span>
                      </div>
                    </div>
                  </div>
                  );
                })}
            </div>
          ) : trendAnalysis ? (
            <div className={styles.forecastGrid}>
              {[1, 2, 3].map((dayOffset, index) => {
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + dayOffset);
                const dayNames: Record<string, string[]> = {
                  ar: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
                  fr: ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"],
                  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
                };
                const dayName = dayNames[lang]?.[futureDate.getDay()] || dayNames.en[futureDate.getDay()];
                const icon = getConditionIcon(trendAnalysis.predictedCondition);
                const desc = trendAnalysis.description[lang as "ar" | "fr" | "en"] || trendAnalysis.description.en;

                // ── Predicted temperature from sensor trend ──
                const currentTemp = values.temperature ?? 25;
                const tempHistory = history.temperature || [];
                let tempDeltaPerDay = 0;
                if (tempHistory.length > 4) {
                  const recentThird = tempHistory.slice(-Math.floor(tempHistory.length / 3));
                  const olderThird = tempHistory.slice(0, Math.floor(tempHistory.length / 3));
                  const recentAvg = recentThird.reduce((a, b) => a + b, 0) / recentThird.length;
                  const olderAvg = olderThird.reduce((a, b) => a + b, 0) / olderThird.length;
                  // Extrapolate: the history covers hours, scale to ~24h per day
                  const hoursSpan = Math.max(1, tempHistory.length * 0.5); // ~30min intervals
                  const hoursPerDay = 24;
                  tempDeltaPerDay = ((recentAvg - olderAvg) / hoursSpan) * hoursPerDay;
                  // Clamp to realistic range
                  tempDeltaPerDay = Math.max(-8, Math.min(8, tempDeltaPerDay));
                }
                // Project temperature with decay (less certain further out)
                const projectedTemp = currentTemp + tempDeltaPerDay * dayOffset * (dayOffset === 1 ? 1.0 : dayOffset === 2 ? 0.7 : 0.5);
                const dayTempMin = Math.round(projectedTemp - (dayOffset * 1.5));
                const dayTempMax = Math.round(projectedTemp + (dayOffset * 1.5));

                // ── Day-based decay: further days = more uncertainty ──
                // Day 1 ≈ full sensor accuracy, Day 2 ≈ 80%, Day 3 ≈ 60%
                const decayFactor = dayOffset === 1 ? 1.0 : dayOffset === 2 ? 0.8 : 0.6;
                const confidenceDecay = dayOffset === 1 ? 1.0 : dayOffset === 2 ? 0.75 : 0.5;

                // Adjusted values per day
                const dayHumidity = Math.round(
                  trendAnalysis.predictedHumidity * decayFactor + 50 * (1 - decayFactor)
                );
                const dayRainProb = Math.round(trendAnalysis.rainProbability * decayFactor);
                const dayFogProb = Math.round(
                  trendAnalysis.fogProbability * (dayOffset === 1 ? 1.0 : dayOffset === 2 ? 0.5 : 0.2)
                );
                const dayStormProb = Math.round(
                  trendAnalysis.stormProbability * (dayOffset === 1 ? 1.0 : dayOffset === 2 ? 0.6 : 0.3)
                );
                const dayConfidence = Math.round(trendAnalysis.confidence * confidenceDecay);

                // Rain intensity may decrease for further days
                let dayRainIntensity = trendAnalysis.rainIntensity;
                if (dayOffset >= 2 && dayRainIntensity === "heavy") dayRainIntensity = "moderate";
                if (dayOffset >= 3 && dayRainIntensity === "moderate") dayRainIntensity = "light";
                if (dayRainProb < 15) dayRainIntensity = "none";

                // Condition may shift for further days (less certainty)
                let dayCondition = trendAnalysis.predictedCondition;
                if (dayOffset >= 3 && (dayCondition === "stormy" || dayCondition === "rainy")) {
                  dayCondition = "cloudy";
                }
                const dayIcon = getConditionIcon(dayCondition);

                // Rain intensity label
                const rainIntensityLabel = dayRainIntensity === "light"
                  ? (lang === "ar" ? "خفيفة" : lang === "fr" ? "légère" : "light")
                  : dayRainIntensity === "moderate"
                  ? (lang === "ar" ? "متوسطة" : lang === "fr" ? "modérée" : "moderate")
                  : dayRainIntensity === "heavy"
                  ? (lang === "ar" ? "غزيرة" : lang === "fr" ? "forte" : "heavy")
                  : null;

                return (
                  <div key={dayOffset} className={styles.forecastCard} style={{ "--delay": `${index * 100}ms` } as CSSProperties}>
                    <div className={styles.forecastCardHeader}>
                      <span className={styles.forecastDayName}>{dayName}</span>
                      <span className={styles.forecastDate}>{futureDate.toLocaleDateString(locale, { day: "numeric", month: "short" })}</span>
                    </div>
                    <div className={styles.forecastIcon}>
                      <span style={{ fontSize: "3rem" }}>{dayIcon}</span>
                    </div>
                    <div className={styles.forecastDescription}>{desc}</div>

                    {/* Predicted temperature range from sensor data */}
                    <div className={styles.forecastTempRow}>
                      <span className={styles.forecastTempHigh}>↑ {dayTempMax}°C</span>
                      <span className={styles.forecastTempLow}>↓ {dayTempMin}°C</span>
                    </div>

                    {/* Sensor-driven forecast events - only non-zero phenomena */}
                    <div className={styles.forecastEventsList}>
                      {/* Predicted humidity - always shown */}
                      <div className={styles.forecastEventItem}>
                        <span className={styles.forecastEventIcon}>💧</span>
                        <span className={styles.forecastEventLabel}>
                          {lang === "ar" ? "الرطوبة المتوقعة" : lang === "fr" ? "Humidité prévue" : "Expected humidity"}:
                        </span>
                        <span className={styles.forecastEventValue}>{dayHumidity}%</span>
                      </div>

                      {/* Rain - only if expected with intensity */}
                      {dayRainProb > 0 && rainIntensityLabel && (
                        <div className={styles.forecastEventItem}>
                          <span className={styles.forecastEventIcon}>🌧️</span>
                          <span className={styles.forecastEventLabel}>
                            {lang === "ar"
                              ? `احتمال أمطار ${rainIntensityLabel}`
                              : lang === "fr"
                              ? `Pluie ${rainIntensityLabel}`
                              : `${rainIntensityLabel} rain`}:
                          </span>
                          <span className={styles.forecastEventValue}>{dayRainProb}%</span>
                        </div>
                      )}

                      {/* Fog - only if expected (decreases fast for further days) */}
                      {dayFogProb > 0 && (
                        <div className={styles.forecastEventItem}>
                          <span className={styles.forecastEventIcon}>🌫️</span>
                          <span className={styles.forecastEventLabel}>
                            {lang === "ar" ? "احتمال تشكل الضباب" : lang === "fr" ? "Brouillard probable" : "Fog likely"}:
                          </span>
                          <span className={styles.forecastEventValue}>{dayFogProb}%</span>
                        </div>
                      )}

                      {/* Storm - only if expected */}
                      {dayStormProb > 0 && (
                        <div className={styles.forecastEventItem}>
                          <span className={styles.forecastEventIcon}>⛈️</span>
                          <span className={styles.forecastEventLabel}>
                            {lang === "ar" ? "احتمال عواصف أو تقلبات" : lang === "fr" ? "Orages ou instabilité" : "Storms or instability"}:
                          </span>
                          <span className={styles.forecastEventValue}>{dayStormProb}%</span>
                        </div>
                      )}

                      {/* Trend indicators */}
                      <div className={styles.forecastEventItem}>
                        <span className={styles.forecastEventIcon}>🌡️</span>
                        <span className={styles.forecastEventLabel}>
                          {lang === "ar" ? "اتجاه الحرارة" : lang === "fr" ? "Tendance temp." : "Temp trend"}:
                        </span>
                        <span className={styles.forecastEventValue}>
                          {dayOffset === 1
                            ? (trendAnalysis.temperatureTrend === "rising"
                              ? (lang === "ar" ? "↑ ارتفاع" : "↑ rising")
                              : trendAnalysis.temperatureTrend === "falling"
                              ? (lang === "ar" ? "↓ انخفاض" : "↓ falling")
                              : (lang === "ar" ? "→ مستقرة" : "→ stable"))
                            : (lang === "ar" ? "~ متوقعة" : "~ variable")}
                        </span>
                      </div>
                    </div>

                    <div className={styles.forecastConfidence}>
                      {lang === "ar" ? "ثقة التحليل" : lang === "fr" ? "Confiance" : "Confidence"}: {dayConfidence}%
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.forecastEmpty}>
              <span style={{ fontSize: "2rem" }}>🌤️</span>
              <p>{lang === "ar" ? "لا توجد بيانات كافية للتنبؤ" : lang === "fr" ? "Pas assez de donnees" : "Not enough data"}</p>
            </div>
          )}
        </article>
        )}

        <article className={styles.defaultsCard}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.9rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.2rem" }}>📊</span>
              <EditableText id={`station-placeholders-title-${lang}`} defaultText={t.placeholdersTitle} as="h3" editable={canEditText} />
            </div>
            <span className={`${styles.statusBadge} ${connected ? styles.good : styles.bad}`} style={{ fontSize: "0.7rem" }}>
              {connected
                ? (lang === "ar" ? "● بيانات حقيقية" : lang === "fr" ? "● Données réelles" : "● Real data")
                : (lang === "ar" ? "● آخر قيم" : lang === "fr" ? "● Dernières valeurs" : "● Last values")}
            </span>
          </div>
          <div className={styles.defaultsGrid}>
            <div className={styles.defaultsItem}>
              <span className={styles.defaultsIcon}>🌡️</span>
              <span>{t.sensors.temperature}</span>
              <strong className={values.temperature !== null ? styles.metricGood : ""}>{formatSensorValue(values.temperature, 1)} {units.temperature}</strong>
            </div>
            <div className={styles.defaultsItem}>
              <span className={styles.defaultsIcon}>💧</span>
              <span>{t.sensors.humidity}</span>
              <strong className={values.humidity !== null ? styles.metricGood : ""}>{formatSensorValue(values.humidity, 1)} {units.humidity}</strong>
            </div>
            <div className={styles.defaultsItem}>
              <span className={styles.defaultsIcon}>🔵</span>
              <span>{t.sensors.pressure}</span>
              <strong className={values.pressure !== null ? styles.metricGood : ""}>{formatSensorValue(values.pressure, 1)} {units.pressure}</strong>
            </div>
            <div className={styles.defaultsItem}>
              <span className={styles.defaultsIcon}>🌧️</span>
              <span>{t.sensors.rain}</span>
              <strong className={values.rain !== null ? styles.metricGood : ""}>{formatSensorValue(values.rain, 1)} {units.rain}</strong>
            </div>
            <div className={styles.defaultsItem}>
              <span className={styles.defaultsIcon}>💡</span>
              <span>{t.sensors.light}</span>
              <strong className={values.light !== null ? styles.metricGood : ""}>{formatSensorValue(values.light, 1)} {units.light}</strong>
            </div>
          </div>
        </article>

        <article className={styles.sensorStatusCard}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "1rem" }}>
            <span style={{ fontSize: "1.3rem" }}>⚙️</span>
            <EditableText
              id={`station-etat-title-${lang}`}
              defaultText="ETAT DES CAPTEURS"
              as="h3"
              className={styles.sensorStatusTitle}
              editable={canEditText}
            />
            {canEditText && (
              <button
                onClick={() => {
                  if (showSoundEditor) {
                    resetSoundSettings();
                  } else {
                    setEditingSoundNames(soundNames);
                    setEditingSoundFreqs(soundFrequencies);
                    setEditingSoundVolumes(soundVolumes);
                    setEditingSoundWaves(soundWaves);
                    setShowSoundEditor(true);
                  }
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "16px",
                  opacity: 0.7,
                  transition: "opacity 0.2s"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
                title="\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0623\u0635\u0648\u0627\u062A"
              >
                \uD83C\uDFB5
              </button>
            )}
            {canEditText && (
              <button
                onClick={() => setShowEmailSettings(!showEmailSettings)}
                className={styles.emailSettingsBtn}
                title={lang === "ar" ? "\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0628\u0631\u064A\u062F" : "Email Settings"}
              >
                <span className={styles.emailIcon}>{"\u2709\uFE0F"}</span>
                <span className={styles.emailBtnLabel}>
                  {showEmailSettings
                    ? (lang === "ar" ? "\u0625\u063A\u0644\u0627\u0642" : "Close")
                    : (lang === "ar" ? "\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0628\u0631\u064A\u062F" : "Email Settings")}
                </span>
              </button>
            )}
          </div>

          {showEmailSettings && canEditText && (
            <div className={styles.emailSettingsPanel}>
              <h4 style={{ margin: "0 0 0.8rem", fontSize: "0.85rem", color: "#60a5fa" }}>
                {lang === "ar" ? "\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0625\u0634\u0639\u0627\u0631\u0627\u062A \u0627\u0644\u0628\u0631\u064A\u062F" : lang === "fr" ? "Parametres de notifications email" : "Email Notification Settings"}
              </h4>

              <div className={styles.emailSettingRow}>
                <label className={styles.emailToggle}>
                  <input
                    type="checkbox"
                    checked={emailSettings.sensorAlerts}
                    onChange={(e) => {
                      const next = { ...emailSettings, sensorAlerts: e.target.checked };
                      setEmailSettings(next);
                      localStorage.setItem("station-email-settings", JSON.stringify(next));
                    }}
                  />
                  <span>{lang === "ar" ? "\u062A\u0646\u0628\u064A\u0647\u0627\u062A \u0627\u0644\u062D\u0633\u0627\u0633\u0627\u062A" : "Sensor Alerts"}</span>
                </label>
                <label className={styles.emailToggle}>
                  <input
                    type="checkbox"
                    checked={emailSettings.dailyReport}
                    onChange={(e) => {
                      const next = { ...emailSettings, dailyReport: e.target.checked };
                      setEmailSettings(next);
                      localStorage.setItem("station-email-settings", JSON.stringify(next));
                    }}
                  />
                  <span>{lang === "ar" ? "\u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u064A\u0648\u0645\u064A" : "Daily Report"}</span>
                </label>
                <label className={styles.emailToggle}>
                  <input
                    type="checkbox"
                    checked={emailSettings.deviceOffline}
                    onChange={(e) => {
                      const next = { ...emailSettings, deviceOffline: e.target.checked };
                      setEmailSettings(next);
                      localStorage.setItem("station-email-settings", JSON.stringify(next));
                    }}
                  />
                  <span>{lang === "ar" ? "\u062A\u0646\u0628\u064A\u0647 \u0627\u0646\u0642\u0637\u0627\u0639 \u0627\u0644\u062C\u0647\u0627\u0632" : "Device Offline"}</span>
                </label>
              </div>

              <div className={styles.emailFieldGroup}>
                <label style={{ fontSize: "0.75rem", color: "#90a8c7" }}>
                  {lang === "ar" ? "\u0628\u0631\u064A\u062F \u0627\u0644\u0645\u0633\u062A\u0644\u0645:" : "Recipient Email:"}
                </label>
                <input
                  type="email"
                  value={emailSettings.recipientEmail}
                  onChange={(e) => setEmailSettings((prev) => ({ ...prev, recipientEmail: e.target.value }))}
                  onBlur={() => localStorage.setItem("station-email-settings", JSON.stringify(emailSettings))}
                  className={styles.emailInput}
                />
              </div>

              <div className={styles.emailFieldGroup}>
                <label style={{ fontSize: "0.75rem", color: "#90a8c7" }}>
                  {lang === "ar" ? "\u0633\u0627\u0639\u0629 \u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u064A\u0648\u0645\u064A:" : "Daily Report Hour:"}
                </label>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={emailSettings.reportHour}
                  onChange={(e) => {
                    const next = { ...emailSettings, reportHour: Number(e.target.value) };
                    setEmailSettings(next);
                    localStorage.setItem("station-email-settings", JSON.stringify(next));
                  }}
                  className={styles.emailInput}
                  style={{ width: "60px" }}
                />
                <span style={{ fontSize: "0.7rem", color: "#7a95b8" }}>:00</span>
              </div>

              <div className={styles.emailFieldGroup}>
                <label style={{ fontSize: "0.75rem", color: "#90a8c7" }}>
                  {lang === "ar" ? "\u0641\u062A\u0631\u0629 \u0627\u0646\u062A\u0638\u0627\u0631 \u062A\u0646\u0628\u064A\u0647 \u0627\u0644\u062D\u0633\u0627\u0633 (\u062F\u0642\u0627\u0626\u0642):" : "Sensor Cooldown (min):"}
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={emailSettings.sensorCooldownMin}
                  onChange={(e) => {
                    const next = { ...emailSettings, sensorCooldownMin: Number(e.target.value) };
                    setEmailSettings(next);
                    localStorage.setItem("station-email-settings", JSON.stringify(next));
                  }}
                  className={styles.emailInput}
                  style={{ width: "60px" }}
                />
              </div>

              <div className={styles.emailFieldGroup}>
                <label style={{ fontSize: "0.75rem", color: "#90a8c7" }}>
                  {lang === "ar" ? "\u0641\u062A\u0631\u0629 \u0627\u0646\u062A\u0638\u0627\u0631 \u062A\u0646\u0628\u064A\u0647 \u0627\u0644\u0627\u0646\u0642\u0637\u0627\u0639 (\u062F\u0642\u0627\u0626\u0642):" : "Offline Cooldown (min):"}
                </label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={emailSettings.offlineCooldownMin}
                  onChange={(e) => {
                    const next = { ...emailSettings, offlineCooldownMin: Number(e.target.value) };
                    setEmailSettings(next);
                    localStorage.setItem("station-email-settings", JSON.stringify(next));
                  }}
                  className={styles.emailInput}
                  style={{ width: "60px" }}
                />
              </div>

              <div style={{ marginTop: "0.5rem", fontSize: "0.65rem", color: "#7a95b8", lineHeight: 1.6 }}>
                {lang === "ar"
                  ? "\u064A\u062A\u0637\u0644\u0628 \u0625\u0646\u0634\u0627\u0621 \u062D\u0633\u0627\u0628 EmailJS \u0648\u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0645\u0641\u0627\u062A\u064A\u062D \u0641\u064A .env.local"
                  : "Requires EmailJS account and env vars in .env.local"}
              </div>
            </div>
          )}

          {showSoundEditor && canEditText && (
            <div className={styles.soundEditorPanel}>
              <div className={styles.soundEditorHeader}>
                <span style={{ fontSize: "1.2rem" }}>🎵</span>
                <h4>{lang === "ar" ? "إعدادات صوت الإنذار" : lang === "fr" ? "Paramètres son d'alerte" : "Alert Sound Settings"}</h4>
              </div>
              {sensorKeys.map((sensor) => {
                const icon = sensor === "temperature" ? "🌡️" : sensor === "humidity" ? "💧" : sensor === "pressure" ? "🔵" : sensor === "rain" ? "🌧️" : "💡";
                return (
                  <div key={sensor} className={styles.soundEditorItem}>
                    <div className={styles.soundEditorItemHeader}>
                      <span className={styles.soundEditorIcon}>{icon}</span>
                      <label className={styles.soundEditorLabel}>
                        {t.sensors[sensor]}
                      </label>
                      <button
                        type="button"
                        className={styles.soundTestBtn}
                        onClick={() => {
                          const freq = editingSoundFreqs[sensor];
                          const vol = editingSoundVolumes[sensor] / 100;
                          const wave = editingSoundWaves[sensor] as OscillatorType;
                          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                          const osc = ctx.createOscillator();
                          const gain = ctx.createGain();
                          osc.type = wave;
                          osc.frequency.value = freq;
                          gain.gain.value = vol * 0.3;
                          osc.connect(gain);
                          gain.connect(ctx.destination);
                          osc.start();
                          setTimeout(() => { osc.stop(); ctx.close(); }, 800);
                        }}
                        title={lang === "ar" ? "تجربة الصوت" : "Test sound"}
                      >
                        ▶
                      </button>
                    </div>
                    <div className={styles.soundEditorGrid}>
                      {/* Sound name input */}
                      <div className={styles.soundField}>
                        <span className={styles.soundFieldLabel}>📝 {lang === "ar" ? "اسم الصوت" : "Name"}</span>
                        <input
                          type="text"
                          value={editingSoundNames[sensor]}
                          onChange={(e) =>
                            setEditingSoundNames((prev) => ({ ...prev, [sensor]: e.target.value }))
                          }
                          placeholder={lang === "ar" ? "اسم الصوت" : "Sound name"}
                          className={styles.soundInput}
                        />
                      </div>

                      {/* File upload */}
                      <div className={styles.soundField}>
                        <span className={styles.soundFieldLabel}>📂 {lang === "ar" ? "ملف الصوت" : "Audio file"}</span>
                        <label className={styles.soundUploadLabel}>
                          <span>{soundFileNames[sensor] ? `✓ ${soundFileNames[sensor]}` : (lang === "ar" ? "رفع ملف صوت" : "Upload audio")}</span>
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const url = URL.createObjectURL(file);
                              setSoundFileURLs((prev) => {
                                if (prev[sensor]) {
                                  URL.revokeObjectURL(prev[sensor]!);
                                }
                                return { ...prev, [sensor]: url };
                              });
                              setSoundFileNames((prev) => ({ ...prev, [sensor]: file.name }));
                              const audio = new Audio(url);
                              audio.addEventListener("loadedmetadata", () => {
                                soundFileDurations.current[sensor] = audio.duration;
                              });
                            }}
                          />
                        </label>
                      </div>

                      {/* Waveform + Frequency */}
                      <div className={styles.soundField}>
                        <span className={styles.soundFieldLabel}>🎼 {lang === "ar" ? "نوع الموجة" : "Waveform"}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <select
                            value={editingSoundWaves[sensor]}
                            onChange={(e) =>
                              setEditingSoundWaves((prev) => ({ ...prev, [sensor]: e.target.value as SensorWave }))
                            }
                            className={styles.soundSelect}
                          >
                            <option value="sine">〰️ Sine</option>
                            <option value="triangle">△ Triangle</option>
                            <option value="square">⊓ Square</option>
                            <option value="sawtooth">⩘ Sawtooth</option>
                          </select>
                          <input
                            type="range"
                            min="200"
                            max="1200"
                            value={editingSoundFreqs[sensor]}
                            onChange={(e) =>
                              setEditingSoundFreqs((prev) => ({ ...prev, [sensor]: Number(e.target.value) }))
                            }
                            style={{ flex: 1 }}
                          />
                          <span className={styles.soundValueLabel}>{editingSoundFreqs[sensor]} Hz</span>
                        </div>
                      </div>

                      {/* Volume */}
                      <div className={styles.soundField}>
                        <span className={styles.soundFieldLabel}>🔊 {lang === "ar" ? "مستوى الصوت" : "Volume"}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <div className={styles.volumeBarWrap}>
                            <div
                              className={styles.volumeBarFill}
                              style={{ width: `${editingSoundVolumes[sensor]}%` }}
                            />
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={editingSoundVolumes[sensor]}
                            onChange={(e) =>
                              setEditingSoundVolumes((prev) => ({ ...prev, [sensor]: Number(e.target.value) }))
                            }
                            style={{ flex: 1 }}
                          />
                          <span className={styles.soundValueLabel}>{editingSoundVolumes[sensor]}%</span>
                        </div>
                      </div>

                      {/* Repeat checkbox */}
                      <label className={styles.soundRepeatLabel}>
                        <input
                          type="checkbox"
                          checked={repeatShortSounds[sensor]}
                          onChange={(e) =>
                            setRepeatShortSounds((prev) => ({ ...prev, [sensor]: e.target.checked }))
                          }
                        />
                        <span>{lang === "ar" ? "تكرار إذا كان الصوت قصيراً" : "Repeat if short"}</span>
                      </label>
                    </div>
                  </div>
                );
              })}
              <div className={styles.soundEditorActions}>
                <button onClick={saveSoundSettings} className={styles.soundSaveBtn}>
                  💾 {lang === "ar" ? "حفظ" : "Save"}
                </button>
                <button onClick={resetSoundSettings} className={styles.soundCancelBtn}>
                  ✕ {lang === "ar" ? "إلغاء" : "Cancel"}
                </button>
              </div>
            </div>
          )}

          {(() => {
            const normalCount = sensorKeys.filter((s) => !alerts[s]).length;
            const totalAlerts = Object.values(alertCounts).reduce((a, b) => a + b, 0);
            const dotClass = normalCount === 5 ? styles.summaryDotGreen : normalCount >= 3 ? styles.summaryDotYellow : styles.summaryDotRed;
            return (
              <div className={styles.statusSummaryBar}>
                <div className={styles.summaryLeft}>
                  <i className={`${styles.summaryDot} ${dotClass}`} />
                  <span>{normalCount}/5 sensors normal</span>
                </div>
                <div className={styles.summaryRight}>
                  {totalAlerts > 0 ? `${totalAlerts} alerts today` : "No alerts today"}
                </div>
              </div>
            );
          })()}

          <div className={styles.sensorBulbGrid}>
            {sensorKeys.map((sensor) => {
              const stats = computeStats(history[sensor]);
              const color = chartColors[sensor];
              return (
                <div key={sensor} className={styles.sensorBulbItem}>
                  <div className={styles.sensorBulbLabel}>
                    {soundNames[sensor] || t.sensors[sensor]}
                    {alertCounts[sensor] > 0 && (
                      <span className={styles.alertBadge}>{alertCounts[sensor]}</span>
                    )}
                  </div>

                  <Sparkline data={history[sensor]} color={color} />

                  <div className={styles.sensorStats}>
                    <span>Min: {stats.min}</span>
                    <span>|</span>
                    <span>Max: {stats.max}</span>
                    <span>|</span>
                    <span>Avg: {stats.avg}</span>
                  </div>

                  <div className={styles.soundMetaText}>
                    {sensorAlertRules[sensor]}
                    <button
                      className={styles.thresholdEditBtn}
                      onClick={() => startEditThreshold(sensor)}
                      title={lang === "ar" ? "\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u062D\u062F\u0648\u062F" : "Edit thresholds"}
                    >
                      {"\u270F\uFE0F"}
                    </button>
                  </div>

                  {editingThreshold === sensor ? (
                    <div className={styles.thresholdEditorInline}>
                      <input
                        type="number"
                        placeholder="Min"
                        value={editingMin}
                        onChange={(e) => setEditingMin(e.target.value)}
                      />
                      <input
                        type="number"
                        placeholder="Max"
                        value={editingMax}
                        onChange={(e) => setEditingMax(e.target.value)}
                      />
                      <button onClick={() => saveThreshold(sensor)}>Save</button>
                    </div>
                  ) : null}

                  <div className={`${styles.bulb} ${alerts[sensor] ? styles.alertBulb : ""}`} />
                  <button className={`${styles.soundBtn} ${!soundEnabled[sensor] ? styles.soundMuted : ""}`} onClick={() => toggleSound(sensor)}>
                    {!soundEnabled[sensor] ? "\uD83D\uDD07 SON: OFF" : "\uD83D\uDD0A SON: ON"}
                  </button>
                </div>
              );
            })}
          </div>

          <div className={styles.alertHistorySection}>
            <button className={styles.alertHistoryToggle} onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? "\u25B2 \u0625\u062E\u0641\u0627\u0621 \u0633\u062C\u0644 \u0627\u0644\u062A\u0646\u0628\u064A\u0647\u0627\u062A" : "\u25BC \u0639\u0631\u0636 \u0633\u062C\u0644 \u0627\u0644\u062A\u0646\u0628\u064A\u0647\u0627\u062A (" + alertHistory.length + ")"}
            </button>
            {showHistory && (
              <div className={styles.alertHistoryList}>
                {alertHistory.map((entry, idx) => (
                  <div key={idx} className={styles.alertHistoryItem}>
                    <span className={styles.alertSensorName}>{t.sensors[entry.sensor]}</span>
                    <span className={styles.alertTime}>{entry.time}</span>
                    <span className={styles.alertValue}>{entry.value}</span>
                    <span className={`${styles.alertType} ${entry.type === "high" ? styles.alertTypeHigh : styles.alertTypeLow}`}>
                      {entry.type === "high" ? "\u25B2 HIGH" : "\u25BC LOW"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className={styles.legendBar}>
            <span className={styles.legendItem}><i className={`${styles.legendDot} ${styles.greenDot}`} /> Vert: Normal</span>
            <span className={styles.legendItem}>
              <i className={`${styles.legendDot} ${styles.redDot}`} />
              <i className={`${styles.legendDot} ${styles.greenDot}`} />
              Vert + Rouge: Alerte
            </span>
          </div>
        </article>

      </div>

      <div className={`${styles.toast} ${toast ? styles.show : ""}`}>{t.toast}</div>
    </section>
  );
}
