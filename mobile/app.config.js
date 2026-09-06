const appJson = require("./app.json");

const { expo } = appJson;

function buildConfig() {
  return {
    ...expo,
    extra: {
      ...expo.extra,
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
      webBaseUrl:
        process.env.EXPO_PUBLIC_WEB_BASE_URL ??
        process.env.EXPO_PUBLIC_API_BASE_URL ??
        "",
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
      supabasePublishableKey:
        process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    },
  };
}

module.exports = buildConfig;
