import { Link, Stack } from "expo-router";
import { StyleSheet, Text } from "react-native";

import { Screen, ScreenBlock } from "@/components/Screen";
import { Body, Title } from "@/components/Typography";
import { colors, fonts } from "@/constants/theme";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <Screen>
        <ScreenBlock>
          <Title>This screen doesn’t exist.</Title>
          <Body>The Local Shows tab you want is probably still on Home.</Body>
          <Link href="/" style={styles.link}>
            <Text style={styles.linkLabel}>Back to Home</Text>
          </Link>
        </ScreenBlock>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  link: {
    marginTop: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  linkLabel: {
    color: colors.accent,
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
});
