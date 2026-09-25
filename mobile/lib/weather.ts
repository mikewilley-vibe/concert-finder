import { getApiBaseUrl } from "./config";

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

export function getShowWeather(show: {
  venueLatitude?: number;
  venueLongitude?: number;
  localDate?: string;
  localTime?: string;
}) {
  if (
    typeof show.venueLatitude !== "number" ||
    typeof show.venueLongitude !== "number" ||
    !show.localDate ||
    !show.localTime
  ) {
    return Promise.resolve<WeatherSnapshot | null>(null);
  }

  const params = new URLSearchParams({
    latitude: String(show.venueLatitude),
    longitude: String(show.venueLongitude),
    date: show.localDate,
    time: show.localTime.slice(0, 5),
  });
  return fetch(`${getApiBaseUrl()}/api/v1/weather?${params.toString()}`, {
    headers: { Accept: "application/json" },
  }).then(async (response) => {
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") return null;
    const data = (payload as { data?: unknown }).data;
    if (!data || typeof data !== "object") return null;
    const snapshot = (data as { snapshot?: unknown }).snapshot;
    return snapshot && typeof snapshot === "object"
      ? (snapshot as WeatherSnapshot)
      : null;
  });
}
