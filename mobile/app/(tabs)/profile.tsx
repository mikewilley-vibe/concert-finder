import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/components/AuthProvider";
import { EmptyState } from "@/components/EmptyState";
import { Screen, ScreenBlock } from "@/components/Screen";
import { Body, Eyebrow, Strong, Title } from "@/components/Typography";
import { colors, fonts } from "@/constants/theme";
import { isAnonymousUser, isPermanentUser } from "@/lib/auth";
import { websiteUrl } from "@/lib/config";

function accountCopy(options: {
  configured: boolean;
  ready: boolean;
  error: string | null;
  userId?: string;
  anonymous: boolean;
  permanent: boolean;
}) {
  if (!options.configured) {
    return "Supabase public values are not set yet. Copy mobile/.env.example to mobile/.env and add the publishable URL and key.";
  }

  if (options.error) {
    return options.error;
  }

  if (!options.ready) {
    return "Starting a guest session…";
  }

  if (options.permanent) {
    return "Signed in to a permanent account. Email sign-in and recovery will land here in a later pass.";
  }

  if (options.anonymous) {
    return `Browsing as a guest. A temporary account is ready so follows and saves can attach later.${
      options.userId ? ` Session started.` : ""
    }`;
  }

  return "No session yet.";
}

export default function ProfileScreen() {
  const { user, ready, configured, error } = useAuth();
  const anonymous = isAnonymousUser(user);
  const permanent = isPermanentUser(user);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);

  function openWebsite(path: string) {
    void Linking.openURL(websiteUrl(path));
  }

  function onDeleteAccount() {
    setDeleteNotice(
      "Account deletion is not implemented in this scaffold. It will ask for confirmation and remove the signed-in account once email sign-in ships.",
    );
  }

  return (
    <Screen>
      <ScreenBlock>
        <Eyebrow>Profile</Eyebrow>
        <Title>Account and preferences.</Title>
        <Body>
          Local Shows uses the same Supabase project as the website. Secrets
          stay on the server. Community submissions stay on the website.
        </Body>
      </ScreenBlock>

      <View style={styles.card}>
        <Strong>Account</Strong>
        <Body>
          {accountCopy({
            configured,
            ready,
            error,
            userId: user?.id,
            anonymous,
            permanent,
          })}
        </Body>
        {user?.id ? (
          <Body style={styles.meta}>
            {anonymous ? "Guest session" : "Signed-in session"}
          </Body>
        ) : null}
      </View>

      <EmptyState
        title="Home location"
        body="A home city and search radius will live here. Location permission and nearby search are not part of this scaffold."
      />

      <EmptyState
        title="Notification preferences"
        body="Push notifications are deferred. This is the placeholder for new-show alerts once that work starts."
      />

      <View style={styles.card}>
        <Strong>Support and privacy</Strong>
        <Body>
          Policies and help stay on the Concert Finder website for now. There
          is no dedicated privacy page in this repository yet.
        </Body>
        <Pressable
          accessibilityRole="link"
          onPress={() => openWebsite("/")}
          style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
        >
          <Text style={styles.linkLabel}>Open the website</Text>
        </Pressable>
        <Pressable
          accessibilityRole="link"
          onPress={() => openWebsite("/account")}
          style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
        >
          <Text style={styles.linkLabel}>Website account</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Strong>Delete account</Strong>
        <Body>
          This control is a stub. It will permanently delete the signed-in
          account after a confirmation step.
        </Body>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete account"
          onPress={onDeleteAccount}
          style={({ pressed }) => [styles.dangerButton, pressed && styles.dangerPressed]}
        >
          <Text style={styles.dangerLabel}>Delete account</Text>
        </Pressable>
        {deleteNotice ? <Body>{deleteNotice}</Body> : null}
      </View>
    </Screen>
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
  meta: {
    fontSize: 13,
  },
  linkButton: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.accent,
    marginTop: 4,
  },
  pressed: {
    backgroundColor: colors.accentDeep,
  },
  linkLabel: {
    color: colors.background,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  dangerButton: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.danger,
    marginTop: 4,
  },
  dangerPressed: {
    backgroundColor: colors.panelHover,
  },
  dangerLabel: {
    color: colors.danger,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
});
