import { useRouter } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/Button";
import { useAuth } from "@/components/AuthProvider";
import { Body, Strong, Title } from "@/components/Typography";
import { colors } from "@/constants/theme";

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { ready, user, authLinkNotice, authLinkError } = useAuth();

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (authLinkNotice && user && user.is_anonymous === false) {
      router.replace("/(tabs)/profile");
    }
  }, [authLinkNotice, ready, router, user]);

  return (
    <View style={styles.screen}>
      <Title>ShowSignal</Title>
      <Strong>
        {authLinkError
          ? "Could not finish that link"
          : authLinkNotice
            ? "You are signed in"
            : "Opening your account…"}
      </Strong>
      <Body>
        {authLinkError ||
          authLinkNotice ||
          "Finishing the email confirmation in the app."}
      </Body>
      <Button
        label="Go to Profile"
        onPress={() => {
          router.replace("/(tabs)/profile");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    gap: 16,
    justifyContent: "center",
  },
});
