import { useState } from "react";
import {
  Linking,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { LoadingBlock } from "@/components/LoadingBlock";
import { Screen, ScreenBlock } from "@/components/Screen";
import { Body, Eyebrow, Strong, Title } from "@/components/Typography";
import { colors, fonts } from "@/constants/theme";
import {
  MIN_PASSWORD_LENGTH,
  emailLooksValid,
  hasPasswordSet,
  passwordMessage,
  pendingEmail,
  recoveryMessage,
  signInMessage,
  upgradeEmailMessage,
  verifiedEmail,
} from "@/lib/account";
import {
  createAccountFromGuest,
  isAnonymousUser,
  isPermanentUser,
  requestPasswordReset,
  setAccountPassword,
  signInWithEmailPassword,
  signOutToGuest,
} from "@/lib/auth";
import { websiteUrl } from "@/lib/config";
import { getSupabaseClient } from "@/lib/supabase";

function Field({
  label,
  value,
  onChangeText,
  ...rest
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  autoComplete?: "email" | "password" | "new-password" | "username";
  keyboardType?: "email-address";
  secureTextEntry?: boolean;
  autoCapitalize?: "none";
}) {
  const id = label.replace(/\s+/g, "-").toLowerCase();
  return (
    <View style={styles.field}>
      <Body>{label}</Body>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.mute}
        accessibilityLabel={label}
        nativeID={id}
        autoCorrect={false}
        style={styles.input}
        {...rest}
      />
    </View>
  );
}

export default function ProfileScreen() {
  const { user, ready, configured, error, transferNotice } = useAuth();
  const anonymous = isAnonymousUser(user);
  const permanent = isPermanentUser(user);
  const email = verifiedEmail(user);
  const waitingEmail = pendingEmail(user);
  const complete = Boolean(email && hasPasswordSet(user));
  const needsPassword = Boolean(email && !hasPasswordSet(user));

  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signInPending, setSignInPending] = useState(false);
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirm, setSignUpConfirm] = useState("");
  const [signUpPending, setSignUpPending] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordPending, setPasswordPending] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetPending, setResetPending] = useState(false);
  const [signOutPending, setSignOutPending] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);

  function openWebsite(path: string) {
    void Linking.openURL(websiteUrl(path));
  }

  async function onSignIn() {
    const nextEmail = signInEmail.trim().toLowerCase();
    if (!emailLooksValid(nextEmail) || !signInPassword) {
      setFormError("Enter the email and password for your account.");
      setNotice(null);
      return;
    }

    setSignInPending(true);
    setFormError(null);
    setNotice(null);

    try {
      const supabase = getSupabaseClient();
      const result = await signInWithEmailPassword(
        supabase,
        nextEmail,
        signInPassword,
      );
      setSignInEmail("");
      setSignInPassword("");
      if (result.mergeFailed) {
        setNotice(
          "You are signed in, but guest data could not be moved yet. Sign out and back in to retry.",
        );
      } else if (result.merged) {
        setNotice(
          "Signed in. Your guest follows and saved shows were moved to this account.",
        );
      } else {
        setNotice("Signed in.");
      }
    } catch (signInError) {
      setFormError(signInMessage(signInError));
    } finally {
      setSignInPending(false);
    }
  }

  async function onCreateAccount() {
    const nextEmail = signUpEmail.trim().toLowerCase();
    if (!emailLooksValid(nextEmail)) {
      setFormError("Enter a valid email address.");
      setNotice(null);
      return;
    }
    if (signUpPassword.length < MIN_PASSWORD_LENGTH) {
      setFormError(
        `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`,
      );
      setNotice(null);
      return;
    }
    if (signUpPassword !== signUpConfirm) {
      setFormError("Those passwords do not match.");
      setNotice(null);
      return;
    }

    setSignUpPending(true);
    setFormError(null);
    setNotice(null);

    try {
      const supabase = getSupabaseClient();
      await createAccountFromGuest(supabase, nextEmail, signUpPassword);
      setSignUpEmail("");
      setSignUpPassword("");
      setSignUpConfirm("");
      setNotice(
        "Check that inbox if we sent a verification email. Finish it on the website account page if asked, then return here.",
      );
    } catch (createError) {
      setFormError(upgradeEmailMessage(createError));
    } finally {
      setSignUpPending(false);
    }
  }

  async function onSavePassword() {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setFormError(
        `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`,
      );
      setNotice(null);
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError("Those passwords do not match.");
      setNotice(null);
      return;
    }

    setPasswordPending(true);
    setFormError(null);
    setNotice(null);

    try {
      const supabase = getSupabaseClient();
      await setAccountPassword(supabase, newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setNotice("Password saved.");
    } catch (updateError) {
      setFormError(passwordMessage(updateError));
    } finally {
      setPasswordPending(false);
    }
  }

  async function onResetPassword() {
    const nextEmail = resetEmail.trim().toLowerCase() || signInEmail.trim().toLowerCase();
    if (!emailLooksValid(nextEmail)) {
      setFormError("Enter the email for the account you want to recover.");
      setNotice(null);
      return;
    }

    setResetPending(true);
    setFormError(null);
    setNotice(null);

    try {
      const supabase = getSupabaseClient();
      await requestPasswordReset(supabase, nextEmail);
      setResetEmail("");
      setNotice(
        "If that email has an account, we sent a reset link. Finish the new password on the website account page, then sign in here.",
      );
    } catch (resetError) {
      setFormError(recoveryMessage(resetError));
    } finally {
      setResetPending(false);
    }
  }

  async function onSignOut() {
    setSignOutPending(true);
    setFormError(null);
    setNotice(null);
    setDeleteNotice(null);

    try {
      const supabase = getSupabaseClient();
      await signOutToGuest(supabase);
      setNotice("Signed out. A new guest session is ready on this device.");
    } catch {
      setFormError("Could not sign out. Try again.");
    } finally {
      setSignOutPending(false);
    }
  }

  function onDeleteAccount() {
    setDeleteNotice(
      "Account deletion is not available from the app. Removing an auth user needs a server-side step, not the publishable key. You can unfollow and unsave from Saved, or sign out of this device.",
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

      {!configured ? (
        <EmptyState
          title="Supabase is not configured"
          body="Copy mobile/.env.example to mobile/.env and add the publishable URL and key."
        />
      ) : !ready ? (
        <LoadingBlock label="Starting a guest session…" />
      ) : (
        <View style={styles.card}>
          <Strong>Account</Strong>
          {error ? <Body>{error}</Body> : null}
          {transferNotice ? <Body>{transferNotice}</Body> : null}
          {formError ? <Body>{formError}</Body> : null}
          {notice ? <Body>{notice}</Body> : null}
          {waitingEmail ? (
            <Body>
              Verification is still pending for {waitingEmail}. Open the latest
              email, then come back.
            </Body>
          ) : null}
          {complete && email ? (
            <>
              <Body>Signed in as {email}</Body>
              <Button
                label={signOutPending ? "Signing out…" : "Sign out"}
                variant="secondary"
                disabled={signOutPending}
                onPress={() => {
                  void onSignOut();
                }}
              />
            </>
          ) : null}
          {anonymous ? (
            <Body>
              Browsing as a guest. Follows and saves attach to this temporary
              session until you create an account or sign in.
            </Body>
          ) : null}
        </View>
      )}

      {configured && ready && needsPassword && email ? (
        <View style={styles.card}>
          <Strong>Create password</Strong>
          <Body>
            Your email is verified. Add a password so you can sign in later.
          </Body>
          <Field
            label="Password"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoComplete="new-password"
            autoCapitalize="none"
          />
          <Field
            label="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="new-password"
            autoCapitalize="none"
          />
          <Button
            label={passwordPending ? "Saving…" : "Save password"}
            disabled={passwordPending}
            onPress={() => {
              void onSavePassword();
            }}
          />
        </View>
      ) : null}

      {configured && ready && anonymous ? (
        <View style={styles.card}>
          <Strong>Create account</Strong>
          <Body>
            Keep this guest session. Email and password convert it into an
            account you can reopen later.
          </Body>
          <Field
            label="Email"
            value={signUpEmail}
            onChangeText={setSignUpEmail}
            keyboardType="email-address"
            autoComplete="email"
            autoCapitalize="none"
            placeholder="you@email.com"
          />
          <Field
            label="Password"
            value={signUpPassword}
            onChangeText={setSignUpPassword}
            secureTextEntry
            autoComplete="new-password"
            autoCapitalize="none"
          />
          <Field
            label="Confirm password"
            value={signUpConfirm}
            onChangeText={setSignUpConfirm}
            secureTextEntry
            autoComplete="new-password"
            autoCapitalize="none"
          />
          <Button
            label={signUpPending ? "Creating…" : "Create account"}
            disabled={signUpPending}
            onPress={() => {
              void onCreateAccount();
            }}
          />
        </View>
      ) : null}

      {configured && ready && !complete ? (
        <View style={styles.card}>
          <Strong>I already have an account</Strong>
          <Body>
            Sign in with email and password. Guest follows and saved shows from
            this device can move with you.
          </Body>
          <Field
            label="Email"
            value={signInEmail}
            onChangeText={setSignInEmail}
            keyboardType="email-address"
            autoComplete="username"
            autoCapitalize="none"
          />
          <Field
            label="Password"
            value={signInPassword}
            onChangeText={setSignInPassword}
            secureTextEntry
            autoComplete="password"
            autoCapitalize="none"
          />
          <Button
            label={signInPending ? "Signing in…" : "Sign in"}
            disabled={signInPending}
            onPress={() => {
              void onSignIn();
            }}
          />
        </View>
      ) : null}

      {configured && ready ? (
        <View style={styles.card}>
          <Strong>Forgot password</Strong>
          <Body>
            We send a reset link to the website account page. After you choose
            a new password there, sign in here.
          </Body>
          <Field
            label="Account email"
            value={resetEmail}
            onChangeText={setResetEmail}
            keyboardType="email-address"
            autoComplete="email"
            autoCapitalize="none"
            placeholder={signInEmail || "you@email.com"}
          />
          <Button
            label={resetPending ? "Sending…" : "Send reset email"}
            variant="secondary"
            disabled={resetPending}
            onPress={() => {
              void onResetPassword();
            }}
          />
        </View>
      ) : null}

      <EmptyState
        title="Home location"
        body="A home city and search radius will live here. Location permission and nearby search are later work."
      />

      <EmptyState
        title="Notification preferences"
        body="Push notifications are deferred. This is the placeholder for new-show alerts once that work starts."
      />

      <View style={styles.card}>
        <Strong>Support and privacy</Strong>
        <Body>
          Policies and help stay on the Concert Finder website for now.
        </Body>
        <Button
          label="Open the website"
          onPress={() => openWebsite("/")}
        />
        <Button
          label="Website account"
          variant="secondary"
          onPress={() => openWebsite("/account")}
        />
      </View>

      <View style={styles.card}>
        <Strong>Delete account</Strong>
        <Body>
          This control is honest about a missing server delete path. It will
          not pretend to remove your auth user from the publishable client.
        </Body>
        <Button
          label="Delete account"
          variant="danger"
          disabled={!permanent}
          accessibilityLabel="Delete account"
          onPress={onDeleteAccount}
        />
        {!permanent ? (
          <Body>Sign in to a permanent account before this can apply.</Body>
        ) : null}
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
    gap: 10,
  },
  field: {
    gap: 6,
  },
  input: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background,
    color: colors.foreground,
    fontFamily: fonts.body,
    fontSize: 16,
    paddingHorizontal: 16,
  },
});
