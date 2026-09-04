export const DEFAULT_API_BASE_URL = "https://concert-finder-eta.vercel.app";

export function getApiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  return configured && configured.length > 0
    ? configured.replace(/\/$/, "")
    : DEFAULT_API_BASE_URL;
}

export function getSupabasePublicConfig() {
  return {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "",
    publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "",
  };
}

export function isSupabaseConfigured() {
  const { url, publishableKey } = getSupabasePublicConfig();
  return url.length > 0 && publishableKey.length > 0;
}

export function websiteUrl(path = "/") {
  return new URL(path, `${getApiBaseUrl()}/`).toString();
}
