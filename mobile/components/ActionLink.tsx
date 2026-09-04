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
    backgroundColor: colors.accent,
  },
  pressed: {
    backgroundColor: colors.accentDeep,
  },
  label: {
    color: colors.background,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
});
