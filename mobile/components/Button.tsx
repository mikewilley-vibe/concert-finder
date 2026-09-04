import { Pressable, StyleSheet, Text } from "react-native";

import { colors, fonts } from "@/constants/theme";

type Variant = "primary" | "secondary" | "action" | "danger";

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !disabled ? pressedStyle[variant] : null,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.label,
          variant === "primary" ? styles.primaryLabel : styles.mutedLabel,
          variant === "action" && styles.actionLabel,
          variant === "danger" && styles.dangerLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
    borderRadius: 999,
    flexShrink: 0,
  },
  primary: {
    backgroundColor: colors.accent,
  },
  primaryPressed: {
    backgroundColor: colors.accentDeep,
  },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.line,
  },
  secondaryPressed: {
    backgroundColor: colors.panelHover,
  },
  action: {
    minHeight: 44,
    paddingHorizontal: 14,
    backgroundColor: "#252b1e",
    borderWidth: 1,
    borderColor: "#667637",
  },
  actionPressed: {
    backgroundColor: "#303923",
    borderColor: "#829647",
  },
  danger: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.danger,
  },
  dangerPressed: {
    backgroundColor: colors.panelHover,
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  primaryLabel: {
    color: colors.onAccent,
  },
  mutedLabel: {
    color: colors.foreground,
  },
  actionLabel: {
    color: colors.foreground,
    fontSize: 14,
  },
  dangerLabel: {
    color: colors.danger,
  },
});

const pressedStyle = {
  primary: styles.primaryPressed,
  secondary: styles.secondaryPressed,
  action: styles.actionPressed,
  danger: styles.dangerPressed,
} as const;
