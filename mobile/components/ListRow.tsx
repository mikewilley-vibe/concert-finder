import { Pressable, StyleSheet, View } from "react-native";

import { colors } from "@/constants/theme";
import { Body, Strong } from "./Typography";

export function ListRow({
  title,
  subtitle,
  onPress,
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.copy}>
        <Strong>{title}</Strong>
        {subtitle ? <Body style={styles.subtitle}>{subtitle}</Body> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
  },
  pressed: {
    backgroundColor: colors.panelHover,
  },
  copy: {
    gap: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
});
