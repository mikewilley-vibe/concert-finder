import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "@/constants/theme";
import { Body, Eyebrow, Strong } from "./Typography";

export function ListRow({
  title,
  subtitle,
  kicker,
  badge,
  onPress,
  accessibilityLabel,
  trailing,
}: {
  title: string;
  subtitle?: string;
  kicker?: string;
  badge?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  trailing?: ReactNode;
}) {
  const copy = (
    <View style={styles.copy}>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>{badge}</Text>
        </View>
      ) : null}
      {kicker ? <Eyebrow>{kicker}</Eyebrow> : null}
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
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#252b1e",
    borderWidth: 1,
    borderColor: "#667637",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeLabel: {
    color: colors.accent,
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
});
