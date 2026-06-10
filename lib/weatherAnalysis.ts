/**
 * Weather Trend Analysis Service
 * Analyzes historical sensor data to predict weather patterns
 * Used as fallback when API is unavailable and to enhance API predictions
 * Only reports weather phenomena that are actually expected based on sensor data
 */

export interface WeatherEvent {
  type: "rain" | "fog" | "storm" | "high_wind";
  label: { ar: string; fr: string; en: string };
  probability: number; // 0-100, always > 0 for included events
  intensity?: "light" | "moderate" | "heavy";
  icon: string;
}

export interface TrendAnalysis {
  temperatureTrend: "rising" | "falling" | "stable";
  pressureTrend: "rising" | "falling" | "stable";
  humidityTrend: "rising" | "falling" | "stable";
  rainLikelihood: "low" | "medium" | "high";
  predictedCondition: "sunny" | "cloudy" | "rainy" | "stormy" | "clear";
  confidence: number; // 0-100%

  // Sensor-based forecast values
  predictedHumidity: number;        // predicted humidity %
  rainProbability: number;         // 0-100%
  rainIntensity: "none" | "light" | "moderate" | "heavy";
  fogProbability: number;          // 0-100%, 0 = not expected
  stormProbability: number;        // 0-100%, 0 = not expected

  // Only phenomena expected to happen (probability > 0)
  expectedEvents: WeatherEvent[];

  description: {
    ar: string;
    fr: string;
    en: string;
  };
}

export interface SensorReading {
  timestamp: number;
  temperature: number | null;
  humidity: number | null;
  pressure: number | null;
  rain: number | null;
  light: number | null;
}

/**
 * Calculate trend from a series of values
 */
function calculateTrend(values: number[]): "rising" | "falling" | "stable" {
  if (values.length < 2) return "stable";
  
  const recent = values.slice(-Math.floor(values.length / 3));
  const older = values.slice(0, Math.floor(values.length / 3));
  
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  
  const diff = recentAvg - olderAvg;
  const threshold = olderAvg * 0.02; // 2% change threshold
  
  if (diff > threshold) return "rising";
  if (diff < -threshold) return "falling";
  return "stable";
}

/**
 * Analyze sensor data and predict weather
 * Only reports weather phenomena that are actually expected based on sensor readings
 */
export function analyzeSensorTrends(readings: SensorReading[]): TrendAnalysis {
  // Extract valid values
  const temps = readings
    .map((r) => r.temperature)
    .filter((v): v is number => v !== null && !isNaN(v));
  const pressures = readings
    .map((r) => r.pressure)
    .filter((v): v is number => v !== null && !isNaN(v));
  const humidities = readings
    .map((r) => r.humidity)
    .filter((v): v is number => v !== null && !isNaN(v));
  const rains = readings
    .map((r) => r.rain)
    .filter((v): v is number => v !== null && !isNaN(v));

  // Calculate trends
  const temperatureTrend = calculateTrend(temps);
  const pressureTrend = calculateTrend(pressures);
  const humidityTrend = calculateTrend(humidities);

  // ── Predicted humidity ──────────────────────────────────────────────────
  // Use recent humidity trend to project near-future value
  const currentHumidity = humidities[humidities.length - 1] || 50;
  const recentHumidities = humidities.slice(-Math.max(1, Math.floor(humidities.length / 3)));
  const avgRecentHumidity = recentHumidities.length
    ? recentHumidities.reduce((a, b) => a + b, 0) / recentHumidities.length
    : currentHumidity;
  // Project: if rising, add up to 5%; if falling, subtract up to 5%
  let predictedHumidity = avgRecentHumidity;
  if (humidityTrend === "rising") predictedHumidity = Math.min(100, avgRecentHumidity + 5);
  else if (humidityTrend === "falling") predictedHumidity = Math.max(0, avgRecentHumidity - 5);
  predictedHumidity = Math.round(predictedHumidity);

  // ── Rain probability & intensity ────────────────────────────────────────
  let rainScore = 0;

  // Falling pressure indicates approaching weather system
  if (pressureTrend === "falling") rainScore += 30;
  if (pressureTrend === "rising") rainScore -= 20;

  // Rising humidity indicates moisture accumulation
  if (humidityTrend === "rising") rainScore += 25;

  // High current humidity increases rain chance
  if (currentHumidity > 80) rainScore += 20;
  else if (currentHumidity > 60) rainScore += 10;

  // Recent rain activity from sensor
  const recentRain = rains.slice(-5);
  const hasRecentRain = recentRain.some((r) => r > 0);
  if (hasRecentRain) rainScore += 25;

  // Temperature drop can indicate front passage
  if (temperatureTrend === "falling") rainScore += 10;

  const rainProbability = Math.max(0, Math.min(100, rainScore));

  // Rain intensity based on score and actual rain sensor amounts
  const totalRecentRain = recentRain.reduce((a, b) => a + b, 0);
  let rainIntensity: "none" | "light" | "moderate" | "heavy";
  if (rainProbability < 20 || totalRecentRain < 0.5) {
    rainIntensity = "none";
  } else if (totalRecentRain < 2.5 && rainProbability < 50) {
    rainIntensity = "light";
  } else if (totalRecentRain < 7.5 && rainProbability < 75) {
    rainIntensity = "moderate";
  } else if (rainProbability >= 50) {
    rainIntensity = totalRecentRain > 5 ? "heavy" : "moderate";
  } else {
    rainIntensity = "light";
  }

  // Determine rain likelihood label
  const rainLikelihood: "low" | "medium" | "high" =
    rainProbability > 60 ? "high" : rainProbability > 30 ? "medium" : "low";

  // ── Fog probability ─────────────────────────────────────────────────────
  // Fog forms when humidity is very high and temperature drops (dew point proximity)
  let fogProbability = 0;
  if (currentHumidity > 95) fogProbability += 40;
  else if (currentHumidity > 90) fogProbability += 25;
  else if (currentHumidity > 85) fogProbability += 10;

  // Small temperature range = stable air, good for fog
  if (temps.length > 2) {
    const recentTemps = temps.slice(-Math.floor(temps.length / 3));
    const tempRange = Math.max(...recentTemps) - Math.min(...recentTemps);
    if (tempRange < 3) fogProbability += 20;
    else if (tempRange < 5) fogProbability += 10;
  }

  // Falling temperature near dew point promotes fog
  if (temperatureTrend === "falling" && currentHumidity > 80) fogProbability += 15;

  // Low light levels (night/early morning) increase fog chance
  const recentLights = readings
    .map((r) => r.light)
    .filter((v): v is number => v !== null && !isNaN(v))
    .slice(-5);
  if (recentLights.length > 0) {
    const avgLight = recentLights.reduce((a, b) => a + b, 0) / recentLights.length;
    if (avgLight < 50) fogProbability += 10; // dark = night time
  }

  fogProbability = Math.min(fogProbability, 90);
  // Only report fog if there is a meaningful chance
  if (fogProbability < 15) fogProbability = 0;

  // ── Storm probability ───────────────────────────────────────────────────
  let stormProbability = 0;

  // Rapid pressure drop is a key storm indicator
  if (pressures.length > 3) {
    const recentPressures = pressures.slice(-Math.floor(pressures.length / 3));
    const olderPressures = pressures.slice(0, Math.floor(pressures.length / 3));
    if (recentPressures.length > 0 && olderPressures.length > 0) {
      const recentAvg = recentPressures.reduce((a, b) => a + b, 0) / recentPressures.length;
      const olderAvg = olderPressures.reduce((a, b) => a + b, 0) / olderPressures.length;
      const pressureDrop = olderAvg - recentAvg;
      if (pressureDrop > 5) stormProbability += 40;
      else if (pressureDrop > 3) stormProbability += 25;
      else if (pressureDrop > 1) stormProbability += 10;
    }
  }

  // Low absolute pressure
  const currentPressure = pressures[pressures.length - 1] || 1013;
  if (currentPressure < 1000) stormProbability += 25;
  else if (currentPressure < 1005) stormProbability += 15;
  else if (currentPressure < 1010) stormProbability += 5;

  // High humidity + falling temperature = instability
  if (currentHumidity > 80 && temperatureTrend === "falling") stormProbability += 15;

  // Recent heavy rain indicates active weather
  if (hasRecentRain && totalRecentRain > 5) stormProbability += 20;

  stormProbability = Math.min(stormProbability, 95);
  // Only report storms if there is a meaningful chance
  if (stormProbability < 15) stormProbability = 0;

  // ── Predict overall condition ───────────────────────────────────────────
  let predictedCondition: "sunny" | "cloudy" | "rainy" | "stormy" | "clear";

  if (stormProbability > 40) {
    predictedCondition = "stormy";
  } else if (rainLikelihood === "high") {
    predictedCondition = "rainy";
  } else if (rainLikelihood === "medium" || humidityTrend === "rising") {
    predictedCondition = "cloudy";
  } else if (temperatureTrend === "rising" && humidityTrend === "falling") {
    predictedCondition = "sunny";
  } else {
    predictedCondition = "clear";
  }

  // ── Build expected events list (only non-zero phenomena) ────────────────
  const expectedEvents: WeatherEvent[] = [];

  // Rain event
  if (rainProbability > 0 && rainIntensity !== "none") {
    const intensityLabels: Record<string, { ar: string; fr: string; en: string }> = {
      light:  { ar: "أمطار خفيفة",  fr: "Pluie légère",   en: "Light rain" },
      moderate: { ar: "أمطار متوسطة", fr: "Pluie modérée", en: "Moderate rain" },
      heavy:  { ar: "أمطار غزيرة",   fr: "Pluie forte",    en: "Heavy rain" },
    };
    const intensityKey = rainIntensity as "light" | "moderate" | "heavy";
    expectedEvents.push({
      type: "rain",
      label: intensityLabels[intensityKey],
      probability: rainProbability,
      intensity: rainIntensity as "light" | "moderate" | "heavy",
      icon: "🌧️",
    });
  }

  // Fog event
  if (fogProbability > 0) {
    expectedEvents.push({
      type: "fog",
      label: { ar: "تشكل الضباب", fr: "Formation de brouillard", en: "Fog formation" },
      probability: fogProbability,
      icon: "🌫️",
    });
  }

  // Storm event
  if (stormProbability > 0) {
    expectedEvents.push({
      type: "storm",
      label: { ar: "عواصف أو تقلبات جوية", fr: "Orages ou instabilité", en: "Storms or instability" },
      probability: stormProbability,
      icon: "⛈️",
    });
  }

  // ── Confidence ──────────────────────────────────────────────────────────
  let confidence = 30;
  if (temps.length > 10) confidence += 15;
  if (pressures.length > 10) confidence += 20;
  if (humidities.length > 10) confidence += 15;
  if (readings.length > 20) confidence += 20;
  confidence = Math.min(confidence, 85);

  // Generate descriptions
  const descriptions = generateDescriptions(
    temperatureTrend,
    pressureTrend,
    humidityTrend,
    predictedCondition,
    rainLikelihood
  );

  return {
    temperatureTrend,
    pressureTrend,
    humidityTrend,
    rainLikelihood,
    predictedCondition,
    confidence,
    predictedHumidity,
    rainProbability,
    rainIntensity,
    fogProbability,
    stormProbability,
    expectedEvents,
    description: descriptions
  };
}

/**
 * Generate human-readable descriptions in multiple languages
 */
function generateDescriptions(
  tempTrend: string,
  pressTrend: string,
  humTrend: string,
  condition: string,
  rain: string
): { ar: string; fr: string; en: string } {
  const conditions = {
    sunny: {
      ar: "مشمس وصافٍ",
      fr: "Ensoleillé et clair",
      en: "Sunny and clear"
    },
    clear: {
      ar: "صافٍ",
      fr: "Dégagé",
      en: "Clear"
    },
    cloudy: {
      ar: "غائم جزئياً",
      fr: "Partiellement nuageux",
      en: "Partly cloudy"
    },
    rainy: {
      ar: "أمطار متوقعة",
      fr: "Pluie prévue",
      en: "Rain expected"
    },
    stormy: {
      ar: "عاصف مع أمطار",
      fr: "Orageux avec pluie",
      en: "Stormy with rain"
    }
  };

  const trendNotes = {
    rising: {
      ar: "ارتفاع",
      fr: "en hausse",
      en: "rising"
    },
    falling: {
      ar: "انخفاض",
      fr: "en baisse",
      en: "falling"
    },
    stable: {
      ar: "مستقر",
      fr: "stable",
      en: "stable"
    }
  };

  const cond = conditions[condition as keyof typeof conditions] || conditions.clear;
  const tempNote = trendNotes[tempTrend as keyof typeof trendNotes] || trendNotes.stable;

  return {
    ar: `${cond.ar} - الحرارة في ${tempNote.ar}`,
    fr: `${cond.fr} - Température ${tempNote.fr}`,
    en: `${cond.en} - Temperature ${tempNote.en}`
  };
}

/**
 * Get icon for predicted condition
 */
export function getConditionIcon(condition: string): string {
  const icons: Record<string, string> = {
    sunny: "☀️",
    clear: "🌤️",
    cloudy: "⛅",
    rainy: "🌧️",
    stormy: "⛈️"
  };
  return icons[condition] || "🌤️";
}

/**
 * Get condition emoji for forecast cards
 */
export function getConditionEmoji(condition: string): string {
  const icons: Record<string, string> = {
    sunny: "01d",
    clear: "02d",
    cloudy: "03d",
    rainy: "10d",
    stormy: "11d"
  };
  return icons[condition] || "02d";
}
