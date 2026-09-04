import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { colors } from "@/constants/theme";
import { Body, Strong } from "./Typography";

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Strong>{title}</Strong>
      <Body>{body}</Body>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 8,
  },
});
