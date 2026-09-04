import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
} from "@expo-google-fonts/outfit";
import {
  Syne_500Medium,
  Syne_600SemiBold,
  Syne_700Bold,
} from "@expo-google-fonts/syne";
import { useFonts } from "expo-font";
import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import { AuthProvider } from "@/components/AuthProvider";
import { colors } from "@/constants/theme";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

SplashScreen.preventAutoHideAsync();

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.background,
    text: colors.foreground,
    border: colors.line,
    notification: colors.accent,
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Syne_500Medium,
    Syne_600SemiBold,
    Syne_700Bold,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.foreground,
            headerShadowVisible: false,
            headerBackTitle: "Back",
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="concert/[id]" options={{ title: "Concert" }} />
          <Stack.Screen name="artist/[id]" options={{ title: "Artist" }} />
          <Stack.Screen name="venue/[id]" options={{ title: "Venue" }} />
        </Stack>
      </AuthProvider>
    </ThemeProvider>
  );
}
