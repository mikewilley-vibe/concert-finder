import { useState } from "react";
import {
  Keyboard,
  Linking,
  StyleSheet,
  TextInput,
  type TextInputProps,
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
  resetAfterAccountDeletion,
  setAccountPassword,
  signInWithEmailPassword,
  signOutToGuest,
} from "@/lib/auth";
import { ApiError, deleteAccount } from "@/lib/api";
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
} & Pick<
  TextInputProps,
  | "placeholder"
  | "autoComplete"
  | "keyboardType"
  | "secureTextEntry"
  | "autoCapitalize"
  | "textContentType"
  | "returnKeyType"
  | "onSubmitEditing"
>) {
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
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signInPending, setSignInPending] = useState(false);
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpError, setSignUpError] = useState<string | null>(null);
  const [signUpPending, setSignUpPending] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordPending, setPasswordPending] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetPending, setResetPending] = useState(false);
  const [signOutPending, setSignOutPending] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  function openWebsite(path: string) {
    void Linking.openURL(websiteUrl(path));
  }

  async function onSignIn() {
    const nextEmail = signInEmail.trim().toLowerCase();
    if (!emailLooksValid(nextEmail) || !signInPassword) {
      setSignInError("Enter the email and password for your account.");
      setNotice(null);
      return;
    }

    Keyboard.dismiss();
    setSignInPending(true);
    setSignInError(null);
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
    } catch (authSignInError) {
      setSignInError(signInMessage(authSignInError));
    } finally {
      setSignInPending(false);
    }
  }

  async function onCreateAccount() {
    const nextEmail = signUpEmail.trim().toLowerCase();
    if (!emailLooksValid(nextEmail)) {
      setSignUpError("Enter a valid email address.");
      setNotice(null);
      return;
    }

    Keyboard.dismiss();
    setSignUpPending(true);
    setSignUpError(null);
    setNotice(null);

    try {
      const supabase = getSupabaseClient();
      await createAccountFromGuest(supabase, nextEmail);
      setSignUpEmail("");
      setNotice(
        "Verification email sent. Open it, verify your address, then return here to create your password.",
      );
    } catch (createError) {
      setSignUpError(upgradeEmailMessage(createError));
    } finally {
      setSignUpPending(false);
    }
  }

  async function onSavePassword() {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(
        `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`,
      );
      setNotice(null);
      return;
    }

    Keyboard.dismiss();
    setPasswordPending(true);
    setPasswordError(null);
    setNotice(null);

    try {
      const supabase = getSupabaseClient();
      await setAccountPassword(supabase, newPassword);
      setNewPassword("");
      setNotice("Password saved.");
    } catch (updateError) {
      setPasswordError(passwordMessage(updateError));
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

  function deleteAccountMessage(error: unknown) {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        return "Your sign-in expired. Sign in again, then retry.";
      }
      if (error.status === 403) {
        return "Only a finished email-and-password account can be deleted.";
      }
      if (error.code === "not_configured") {
        return "The website is missing its Supabase admin key, so deletion cannot finish.";
      }
      return (
        error.message ||
        "Could not delete the account. Try signing in again, then retry."
      );
    }

    return "Could not delete the account. Try signing in again, then retry.";
  }

  async function onDeleteAccount() {
    if (!permanent) {
      setDeleteNotice("Sign in to a permanent account before deleting it.");
      return;
    }

    setDeletePending(true);
    setDeleteNotice(null);
    setFormError(null);
    setNotice(null);

    try {
      const supabase = getSupabaseClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user || userData.user.is_anonymous !== false) {
        setDeleteNotice("Sign in to a permanent account before deleting it.");
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setDeleteNotice("Your sign-in expired. Sign in again, then retry.");
        return;
      }

      await deleteAccount(accessToken);
      try {
        await resetAfterAccountDeletion(supabase);
      } catch {
        // The remote account is already gone. A later launch can start a guest session.
      }
      setDeleteConfirming(false);
      setNotice(
        "Your account and its saved data were deleted. A new guest session is ready.",
      );
    } catch (deleteError) {
      setDeleteNotice(deleteAccountMessage(deleteError));
    } finally {
      setDeletePending(false);
    }
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
            onChangeText={(value) => {
              setNewPassword(value);
              setPasswordError(null);
            }}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={() => {
              if (!passwordPending) void onSavePassword();
            }}
          />
          {passwordError ? <Body>{passwordError}</Body> : null}
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
            First verify your email. Your follows and saved shows stay with
            this guest session while you finish setup.
          </Body>
          <Field
            label="Email"
            value={signUpEmail}
            onChangeText={(value) => {
              setSignUpEmail(value);
              setSignUpError(null);
            }}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            autoCapitalize="none"
            placeholder="you@email.com"
            returnKeyType="done"
            onSubmitEditing={() => {
              if (!signUpPending) void onCreateAccount();
            }}
          />
          {signUpError ? <Body>{signUpError}</Body> : null}
          <Button
            label={signUpPending ? "Sending…" : "Send verification email"}
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
            onChangeText={(value) => {
              setSignInEmail(value);
              setSignInError(null);
            }}
            keyboardType="email-address"
            autoComplete="username"
            textContentType="username"
            autoCapitalize="none"
          />
          <Field
            label="Password"
            value={signInPassword}
            onChangeText={(value) => {
              setSignInPassword(value);
              setSignInError(null);
            }}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={() => {
              if (!signInPending) void onSignIn();
            }}
          />
          {signInError ? <Body>{signInError}</Body> : null}
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
          Permanently removes your account, follows, saved concerts, watch
          history, and draft ownership. This cannot be undone.
        </Body>
        {deleteConfirming ? (
          <>
            <Body>Are you sure? Your Local Shows account cannot be recovered.</Body>
            <Button
              label={deletePending ? "Deleting…" : "Permanently delete account"}
              variant="danger"
              disabled={deletePending}
              accessibilityLabel="Permanently delete account"
              onPress={() => {
                void onDeleteAccount();
              }}
            />
            <Button
              label="Cancel"
              variant="secondary"
              disabled={deletePending}
              onPress={() => {
                setDeleteConfirming(false);
                setDeleteNotice(null);
              }}
            />
          </>
        ) : (
          <Button
            label="Delete account"
            variant="danger"
            disabled={!permanent}
            accessibilityLabel="Delete account"
            onPress={() => {
              setDeleteConfirming(true);
              setDeleteNotice(null);
            }}
          />
        )}
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
