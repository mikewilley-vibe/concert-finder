import { useFocusEffect } from "expo-router";
import { useCallback, type ReactNode } from "react";
import { Keyboard, Platform, StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { colors, spacing } from "@/constants/theme";

/** Keep a little air between the caret and the top of the keyboard. */
const FOCUSED_INPUT_GAP = 24;

export function Screen({
  children,
  padded = true,
  avoidKeyboard = true,
}: {
  children: ReactNode;
  padded?: boolean;
  avoidKeyboard?: boolean;
}) {
  useFocusEffect(
    useCallback(() => {
      return () => {
        Keyboard.dismiss();
      };
    }, []),
  );

  return (
    <View style={styles.frame}>
      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, padded && styles.padded]}
        enabled={avoidKeyboard}
        bottomOffset={FOCUSED_INPUT_GAP}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      >
        {children}
      </KeyboardAwareScrollView>
    </View>
  );
}

export function ScreenBlock({ children }: { children: ReactNode }) {
  return <View style={styles.block}>{children}</View>;
}

const styles = StyleSheet.create({
  frame: {
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
