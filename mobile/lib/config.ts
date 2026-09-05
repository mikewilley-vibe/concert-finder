import Constants from "expo-constants";

export const DEFAULT_API_BASE_URL = "https://concert-finder-eta.vercel.app";

type PublicExtra = {
  apiBaseUrl?: string;
  supabaseUrl?: string;
  supabasePublishableKey?: string;
};

function publicExtra() {
  return (Constants.expoConfig?.extra ?? {}) as PublicExtra;
}

function configuredValue(direct: string | undefined, fallback?: string) {
  return direct?.trim() || fallback?.trim() || "";
}

export function getApiBaseUrl() {
  const configured = configuredValue(
    process.env.EXPO_PUBLIC_API_BASE_URL,
    publicExtra().apiBaseUrl,
  );
  return configured && configured.length > 0
    ? configured.replace(/\/$/, "")
    : DEFAULT_API_BASE_URL;
}

export function getSupabasePublicConfig() {
  const extra = publicExtra();
  return {
    url: configuredValue(
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      extra.supabaseUrl,
    ),
    publishableKey: configuredValue(
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      extra.supabasePublishableKey,
    ),
  };
}

export function isSupabaseConfigured() {
  const { url, publishableKey } = getSupabasePublicConfig();
  return url.length > 0 && publishableKey.length > 0;
}

export function websiteUrl(path = "/") {
  return new URL(path, `${getApiBaseUrl()}/`).toString();
}
