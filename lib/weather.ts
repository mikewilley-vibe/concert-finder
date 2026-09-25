export type WeatherSnapshot = {
  date: string;
  time: string;
  temperatureF: number | null;
  feelsLikeF: number | null;
  precipitationProbability: number | null;
  precipitationInches: number | null;
  windMph: number | null;
  weatherCode: number | null;
  label: string;
  forecastAvailable: boolean;
};

const WEATHER_LABELS: Record<number, string> = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Icy fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Rain showers",
  82: "Heavy showers",
  95: "Thunderstorms",
  96: "Thunderstorms with hail",
  99: "Thunderstorms with hail",
};

export function weatherLabel(code: number | null) {
  return code == null ? "Forecast unavailable" : WEATHER_LABELS[code] ?? "Mixed conditions";
}

export function parseWeatherNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function weatherSnapshotFromHourly(
  payload: unknown,
  targetDate: string,
  targetHour: string,
): WeatherSnapshot | null {
  if (!payload || typeof payload !== "object") return null;
  const hourly = (payload as { hourly?: unknown }).hourly;
  if (!hourly || typeof hourly !== "object") return null;
  const record = hourly as Record<string, unknown>;
  const times = Array.isArray(record.time) ? record.time : [];
  const index = times.findIndex(
    (value) => typeof value === "string" && value.startsWith(`${targetDate}T${targetHour}`),
  );
  if (index < 0) return null;

  const at = (key: string) => {
    const values = record[key];
    return Array.isArray(values) ? parseWeatherNumber(values[index]) : null;
  };
  const weatherCode = at("weather_code");
  return {
    date: targetDate,
    time: targetHour,
    temperatureF: at("temperature_2m"),
    feelsLikeF: at("apparent_temperature"),
    precipitationProbability: at("precipitation_probability"),
    precipitationInches: at("precipitation"),
    windMph: at("wind_speed_10m"),
    weatherCode,
    label: weatherLabel(weatherCode),
    forecastAvailable: true,
  };
}

