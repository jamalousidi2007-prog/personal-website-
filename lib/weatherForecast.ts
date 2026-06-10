/**
 * Weather Forecast Service
 * Uses OpenWeatherMap API for 5-day/3-hour forecast data
 * Combines with local sensor analysis for enhanced predictions
 */

export interface ForecastDay {
  date: string;
  dayName: string;
  tempMin: number;
  tempMax: number;
  humidity: number;
  humidityMin: number;
  humidityMax: number;
  rainProbability: number;
  rainIntensity: "none" | "light" | "moderate" | "heavy";
  rainAmount: number; // mm
  stormProbability: number;
  fogProbability: number;
  cloudCover: number; // percentage
  description: string;
  iconCode: string;
  iconUrl: string;
  windSpeed: number;
  windGust: number;
  uvIndex: number;
}

export interface ForecastResult {
  days: ForecastDay[];
  source: "api" | "analysis" | "combined";
  lastUpdated: Date;
  error?: string;
}

// Cache storage
let forecastCache: {
  data: ForecastResult | null;
  timestamp: number;
  lat: number;
  lng: number;
} | null = null;

const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get 3-day weather forecast from OpenWeatherMap API
 */
export async function getWeatherForecast(
  lat: number,
  lng: number,
  lang: "ar" | "fr" | "en" = "ar"
): Promise<ForecastResult> {
  const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;

  // Check cache first
  if (
    forecastCache &&
    forecastCache.data &&
    Date.now() - forecastCache.timestamp < CACHE_DURATION_MS &&
    Math.abs(forecastCache.lat - lat) < 0.01 &&
    Math.abs(forecastCache.lng - lng) < 0.01
  ) {
    return forecastCache.data;
  }

  // If no API key, return error (will use trend analysis as fallback)
  if (!apiKey) {
    return {
      days: [],
      source: "analysis",
      lastUpdated: new Date(),
      error: "API key not configured"
    };
  }

  try {
    const langCode = lang === "ar" ? "ar" : lang === "fr" ? "fr" : "en";
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric&lang=${langCode}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const days = parseForecastData(data.list, lang);

    const result: ForecastResult = {
      days,
      source: "api",
      lastUpdated: new Date()
    };

    // Update cache
    forecastCache = {
      data: result,
      timestamp: Date.now(),
      lat,
      lng
    };

    return result;
  } catch (error) {
    console.error("Weather forecast API error:", error);
    return {
      days: [],
      source: "api",
      lastUpdated: new Date(),
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Parse OpenWeatherMap forecast data into daily summaries
 */
function parseForecastData(
  list: Array<{
    dt: number;
    main: { temp: number; humidity: number; pressure: number };
    weather: Array<{ description: string; icon: string; id: number; main: string }>;
    pop: number;
    rain?: { "3h": number };
    snow?: { "3h": number };
    clouds?: { all: number };
    wind: { speed: number; gust?: number };
    visibility?: number;
  }>,
  lang: string
): ForecastDay[] {
  // Group by date
  const byDate = new Map<string, typeof list>();
  
  for (const item of list) {
    const date = new Date(item.dt * 1000).toISOString().split("T")[0];
    if (!byDate.has(date)) {
      byDate.set(date, []);
    }
    byDate.get(date)!.push(item);
  }

  // Get next 3 days
  const days: ForecastDay[] = [];
  const today = new Date().toISOString().split("T")[0];
  
  for (const [date, items] of byDate) {
    if (date <= today) continue;
    if (days.length >= 3) break;

    const temps = items.map((i) => i.main.temp);
    const humidities = items.map((i) => i.main.humidity);
    const rainProbs = items.map((i) => i.pop || 0);
    const rainAmounts = items.map((i) => (i.rain?.["3h"] || 0) + (i.snow?.["3h"] || 0));
    const cloudCovers = items.map((i) => i.clouds?.all || 0);
    const windSpeeds = items.map((i) => i.wind?.speed || 0);
    const windGusts = items.map((i) => i.wind?.gust || i.wind?.speed || 0);
    
    // Calculate total rain amount for the day
    const totalRainAmount = rainAmounts.reduce((a, b) => a + b, 0);
    
    // Determine rain intensity based on amount and probability
    const maxRainProb = Math.max(...rainProbs);
    let rainIntensity: "none" | "light" | "moderate" | "heavy";
    if (maxRainProb < 0.2 || totalRainAmount < 0.5) {
      rainIntensity = "none";
    } else if (totalRainAmount < 2.5) {
      rainIntensity = "light";
    } else if (totalRainAmount < 7.5) {
      rainIntensity = "moderate";
    } else {
      rainIntensity = "heavy";
    }
    
    // Calculate storm probability based on weather conditions
    // Thunderstorm weather IDs are 200-232
    const hasThunderstorm = items.some((i) => 
      i.weather.some((w) => w.id >= 200 && w.id <= 232)
    );
    const maxWindGust = Math.max(...windGusts);
    // Storm if: thunderstorm detected OR wind gust > 15 m/s (54 km/h) OR very low pressure
    let stormProbability = 0;
    if (hasThunderstorm) stormProbability += 60;
    if (maxWindGust > 15) stormProbability += 30;
    else if (maxWindGust > 10) stormProbability += 15;
    const avgPressure = items.reduce((a, i) => a + i.main.pressure, 0) / items.length;
    if (avgPressure < 1000) stormProbability += 20;
    stormProbability = Math.min(stormProbability, 95);
    
    // Calculate fog probability based on humidity, temperature range, and visibility
    const minHumidity = Math.min(...humidities);
    const maxHumidity = Math.max(...humidities);
    const tempRange = Math.max(...temps) - Math.min(...temps);
    const avgVisibility = items.reduce((a, i) => a + (i.visibility || 10000), 0) / items.length;
    let fogProbability = 0;
    if (maxHumidity > 95) fogProbability += 40;
    else if (maxHumidity > 90) fogProbability += 25;
    if (tempRange < 5) fogProbability += 20; // Small temp range = stable air
    if (avgVisibility < 1000) fogProbability += 30;
    else if (avgVisibility < 5000) fogProbability += 15;
    fogProbability = Math.min(fogProbability, 90);
    
    // Find most common weather description (midday preferred)
    const middayItem = items.find((i) => {
      const hour = new Date(i.dt * 1000).getHours();
      return hour >= 11 && hour <= 14;
    }) || items[Math.floor(items.length / 2)];

    const dayNames: Record<string, string[]> = {
      ar: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
      fr: ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"],
      en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    };

    const dateObj = new Date(date);
    const dayName = dayNames[lang]?.[dateObj.getDay()] || dayNames.en[dateObj.getDay()];

    days.push({
      date,
      dayName,
      tempMin: Math.round(Math.min(...temps)),
      tempMax: Math.round(Math.max(...temps)),
      humidity: Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length),
      humidityMin: Math.round(minHumidity),
      humidityMax: Math.round(maxHumidity),
      rainProbability: Math.round(maxRainProb * 100),
      rainIntensity,
      rainAmount: Math.round(totalRainAmount * 10) / 10,
      stormProbability: Math.round(stormProbability),
      fogProbability: Math.round(fogProbability),
      cloudCover: Math.round(cloudCovers.reduce((a, b) => a + b, 0) / cloudCovers.length),
      description: middayItem.weather[0]?.description || "",
      iconCode: middayItem.weather[0]?.icon || "01d",
      iconUrl: `https://openweathermap.org/img/wn/${middayItem.weather[0]?.icon || "01d"}@2x.png`,
      windSpeed: Math.round(Math.max(...windSpeeds)),
      windGust: Math.round(maxWindGust),
      uvIndex: 0 // OpenWeatherMap free tier doesn't include UV in forecast
    });
  }

  return days;
}

/**
 * Get weather icon URL
 */
export function getWeatherIconUrl(iconCode: string, size: "small" | "large" = "large"): string {
  const suffix = size === "large" ? "@2x" : "";
  return `https://openweathermap.org/img/wn/${iconCode}${suffix}.png`;
}
