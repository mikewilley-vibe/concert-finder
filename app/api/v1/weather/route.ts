import { NextRequest } from "next/server";
import { apiV1Error, apiV1Success } from "@/lib/api-v1-response";
import { weatherSnapshotFromHourly } from "@/lib/weather";

const MAX_DAYS_AHEAD = 16;

function numberParam(value: string | null) {
  const parsed = value == null ? NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validDate(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function validHour(value: string | null) {
  return Boolean(value && /^\d{2}:\d{2}$/.test(value));
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const latitude = numberParam(params.get("latitude"));
  const longitude = numberParam(params.get("longitude"));
  const date = params.get("date");
  const time = params.get("time");

  if (
    latitude == null ||
    longitude == null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180 ||
    !validDate(date) ||
    !validHour(time)
  ) {
    return apiV1Error(request, 400, "bad_request", "A valid location, date, and local time are required.");
  }

  const eventDate = new Date(`${date}T12:00:00Z`);
  const daysAhead = Math.ceil((eventDate.getTime() - Date.now()) / 86_400_000);
  if (daysAhead > MAX_DAYS_AHEAD) {
    return apiV1Success(request, { snapshot: null, reason: "too_early" });
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("hourly", [
    "temperature_2m",
    "apparent_temperature",
    "precipitation_probability",
    "precipitation",
    "weather_code",
    "wind_speed_10m",
  ].join(","));
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("precipitation_unit", "inch");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", String(MAX_DAYS_AHEAD));

  try {
    const response = await fetch(url, { next: { revalidate: 900 } });
    if (!response.ok) {
      return apiV1Error(request, 502, "upstream_error", "The weather service is unavailable right now.");
    }
    const payload: unknown = await response.json();
    const snapshot = weatherSnapshotFromHourly(payload, date!, time!);
    return apiV1Success(request, { snapshot, reason: snapshot ? null : "not_available" });
  } catch {
    return apiV1Error(request, 502, "upstream_error", "The weather service is unavailable right now.");
  }
}

