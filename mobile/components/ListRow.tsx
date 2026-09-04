import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { colors } from "@/constants/theme";
import { Body, Strong } from "./Typography";

export function ListRow({
  title,
  subtitle,
  onPress,
  accessibilityLabel,
  trailing,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  trailing?: ReactNode;
}) {
  const copy = (
    <View style={styles.copy}>
      <Strong>{title}</Strong>
      {subtitle ? <Body style={styles.subtitle}>{subtitle}</Body> : null}
    </View>
  );

  return (
    <View style={styles.row}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? title}
          onPress={onPress}
          style={({ pressed }) => [styles.main, pressed && styles.pressed]}
        >
          {copy}
        </Pressable>
      ) : (
        <View style={styles.main}>{copy}</View>
      )}
      {trailing}
    </View>
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
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  main: {
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
  },
  pressed: {
    backgroundColor: colors.panelHover,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
});
