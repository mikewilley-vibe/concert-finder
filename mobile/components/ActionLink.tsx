import { Link, type Href } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

import { colors, fonts } from "@/constants/theme";

export function ActionLink({
  href,
  label,
}: {
  href: Href;
  label: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.label}>{label}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.panelHover,
    borderWidth: 1,
    borderColor: colors.mute,
  },
  pressed: {
    backgroundColor: colors.panel,
  },
  label: {
    color: colors.foreground,
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
});
