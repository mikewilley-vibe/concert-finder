import { StyleSheet, View } from "react-native";

import { Body, Eyebrow, Strong } from "@/components/Typography";
import { colors } from "@/constants/theme";
import type { WeatherSnapshot } from "@/lib/weather";

export function WeatherCard({ weather }: { weather: WeatherSnapshot | null }) {
  if (!weather) {
    return (
      <View style={styles.card}>
        <Eyebrow>Outdoor show</Eyebrow>
        <Strong>Weather forecast coming soon</Strong>
        <Body>Forecast details become available closer to the show date.</Body>
      </View>
    );
  }

  const temperature = weather.temperatureF == null ? "—" : `${Math.round(weather.temperatureF)}°F`;
  const rain = weather.precipitationProbability == null
    ? "Rain chance unavailable"
    : `${Math.round(weather.precipitationProbability)}% chance of rain`;

  return (
    <View style={styles.card}>
      <Eyebrow>Outdoor show weather</Eyebrow>
      <Strong>{temperature} · {weather.label}</Strong>
      <Body>{rain}{weather.windMph == null ? "" : ` · Wind ${Math.round(weather.windMph)} mph`}</Body>
      {weather.feelsLikeF != null ? (
        <Body>Feels like {Math.round(weather.feelsLikeF)}°F at showtime.</Body>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panelHover,
    borderColor: colors.accentDeep,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
});
