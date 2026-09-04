import { ActivityIndicator, StyleSheet, View } from "react-native";

import { colors } from "@/constants/theme";
import { Body } from "./Typography";

export function LoadingBlock({ label }: { label: string }) {
  return (
    <View style={styles.row} accessibilityLabel={label} accessibilityRole="progressbar">
      <ActivityIndicator color={colors.accent} />
      <Body>{label}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
  },
});
