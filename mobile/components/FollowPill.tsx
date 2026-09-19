import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "@/constants/theme";

export function FollowPill({
  label,
  meta,
  selected,
  pending,
  disabled,
  onPress,
}: {
  label: string;
  meta?: string;
  selected: boolean;
  pending: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const blocked = Boolean(disabled || pending);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={selected ? `Unfollow ${label}` : `Follow ${label}`}
      accessibilityState={{ selected, disabled: blocked, busy: pending }}
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        selected && styles.selected,
        pressed && !blocked && styles.pressed,
        blocked && styles.disabled,
      ]}
    >
      <View style={styles.copy}>
        <Text style={[styles.label, selected && styles.selectedLabel]}>
          {selected ? `✓ ${label}` : label}
        </Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    maxWidth: "100%",
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    justifyContent: "center",
  },
  selected: {
    borderColor: colors.accent,
    backgroundColor: "#252b1e",
  },
  pressed: {
    backgroundColor: colors.panelHover,
  },
  disabled: {
    opacity: 0.55,
  },
  copy: {
    gap: 1,
  },
  label: {
    color: colors.foreground,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  selectedLabel: {
    color: colors.accent,
  },
  meta: {
    color: colors.mute,
    fontFamily: fonts.body,
    fontSize: 12,
  },
});
