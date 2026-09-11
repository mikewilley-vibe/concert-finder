import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { colors, spacing } from "@/constants/theme";

export function Screen({
  children,
  padded = true,
  avoidKeyboard = true,
}: {
  children: ReactNode;
  padded?: boolean;
  avoidKeyboard?: boolean;
}) {
  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoider}
      enabled={avoidKeyboard}
      behavior={
        avoidKeyboard && Platform.OS === "ios" ? "padding" : undefined
      }
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, padded && styles.padded]}
        automaticallyAdjustKeyboardInsets={avoidKeyboard}
        keyboardDismissMode="none"
        keyboardShouldPersistTaps="always"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function ScreenBlock({ children }: { children: ReactNode }) {
  return <View style={styles.block}>{children}</View>;
}

const styles = StyleSheet.create({
  keyboardAvoider: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 40,
    gap: spacing.section,
  },
  padded: {
    paddingHorizontal: spacing.screen,
    paddingTop: 12,
  },
  block: {
    gap: 12,
  },
});
