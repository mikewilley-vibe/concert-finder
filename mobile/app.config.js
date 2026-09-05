import appJson from "./app.json";

const { expo } = appJson;

const buildConfig = () => ({
  ...expo,
  extra: {
    ...expo.extra,
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
    supabasePublishableKey:
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  },
});

export default buildConfig;
