"use client";

import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  accountRedirectUrl,
  confirmationMessage,
  consumeAuthRedirect,
  hasPasswordSet,
  isAnonymousUser,
  markPasswordSet,
  PASSWORD_SET_KEY,
  MIN_PASSWORD_LENGTH,
  passwordMessage,
  pendingEmail,
  signInMessage,
  upgradeEmailMessage,
  verifiedEmail,
} from "../../lib/account";
import {
  mergeRememberedAnonymousData,
  rememberAnonymousSession,
} from "../../lib/account-transfer";
import { ensureAnonymousUser } from "../../lib/saved-concerts";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser-client";

const fieldClass =
  "min-h-12 w-full rounded-full border border-line bg-background px-4 text-base text-foreground outline-none placeholder:text-mute/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const panelClass =
  "rounded-3xl border border-line bg-panel p-4 shadow-[0_12px_32px_rgba(0,0,0,0.32)] sm:p-5";

const primaryButtonClass =
  "inline-flex min-h-12 w-full touch-manipulation items-center justify-center rounded-full bg-accent px-6 text-base font-semibold text-background transition-colors hover:bg-accent-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto";

const secondaryButtonClass =
  "inline-flex min-h-12 w-full touch-manipulation items-center justify-center rounded-full border border-line px-6 text-base font-semibold text-foreground transition-colors hover:bg-panel-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto";

function emailLooksValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function AccountScreen() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgradeEmail, setUpgradeEmail] = useState("");
  const [upgradePending, setUpgradePending] = useState(false);
  const [resendWait, setResendWait] = useState(0);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordPending, setPasswordPending] = useState(false);
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signInPending, setSignInPending] = useState(false);
  const [signOutPending, setSignOutPending] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let cancelled = false;

    async function boot() {
      try {
        const redirectNotice = await consumeAuthRedirect(supabase);
        await ensureAnonymousUser(supabase);
        const [userResult, sessionResult] = await Promise.all([
          supabase.auth.getUser(),
          supabase.auth.getSession(),
        ]);

        if (cancelled) {
          return;
        }

        if (userResult.error) {
          setError(
            confirmationMessage(userResult.error.message) ||
              "Could not load your account. Refresh the page.",
          );
        }

        setUser(userResult.data.user);
        if (userResult.data.user?.is_anonymous === false) {
          try {
            const merged = await mergeRememberedAnonymousData(
              sessionResult.data.session,
              userResult.data.user,
            );
            if (merged) {
              setNotice("Your temporary follows, saved shows, and drafts were moved to this account.");
            }
          } catch {
            setError(
              "You are signed in, but temporary data could not be moved yet. Refresh this page to retry.",
            );
          }
        }
        if (redirectNotice) {
          setError(redirectNotice);
        }
      } catch (bootError) {
        if (!cancelled) {
          setError(upgradeEmailMessage(bootError));
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    }

    void boot();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") {
        return;
      }

      setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (resendWait <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setResendWait((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [resendWait]);

  const anonymous = isAnonymousUser(user);
  const waitingEmail = pendingEmail(user);
  const email = verifiedEmail(user);
  const complete = Boolean(email && hasPasswordSet(user));
  const needsPassword = Boolean(email && !hasPasswordSet(user));

  async function sendVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = upgradeEmail.trim().toLowerCase();

    if (!emailLooksValid(nextEmail)) {
      setNotice(null);
      setError("Enter a valid email address.");
      return;
    }

    setUpgradePending(true);
    setError(null);
    setNotice(null);

    try {
      const supabase = getSupabaseBrowserClient();
      await ensureAnonymousUser(supabase);
      const { error: updateError } = await supabase.auth.updateUser(
        { email: nextEmail },
        { emailRedirectTo: accountRedirectUrl() },
      );

      if (updateError) {
        throw updateError;
      }

      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      setUpgradeEmail("");
      setResendWait(30);
      setNotice(
        "Check that inbox for a verification email. Look in spam or junk if you do not see it.",
      );
    } catch (sendError) {
      setError(upgradeEmailMessage(sendError));
    } finally {
      setUpgradePending(false);
    }
  }

  async function resendVerification() {
    const target = waitingEmail || upgradeEmail.trim().toLowerCase();
    if (!target || resendWait > 0) {
      return;
    }

    setUpgradePending(true);
    setError(null);
    setNotice(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "email_change",
        email: target,
        options: { emailRedirectTo: accountRedirectUrl() },
      });

      if (resendError) {
        throw resendError;
      }

      setResendWait(30);
      setNotice(
        "If an email does not arrive, check the address, look in spam or junk, and wait before sending again.",
      );
    } catch (resendError) {
      setError(upgradeEmailMessage(resendError));
    } finally {
      setUpgradePending(false);
    }
  }

  async function createPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
      setNotice(null);
      return;
    }

    if (password !== confirmPassword) {
      setError("Those passwords do not match.");
      setNotice(null);
      return;
    }

    setPasswordPending(true);
    setError(null);
    setNotice(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { [PASSWORD_SET_KEY]: true },
      });

      if (updateError) {
        throw updateError;
      }

      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      setPassword("");
      setConfirmPassword("");
      setNotice(null);
    } catch (updateError) {
      setError(passwordMessage(updateError));
    } finally {
      setPasswordPending(false);
    }
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = signInEmail.trim().toLowerCase();

    if (!emailLooksValid(nextEmail) || !signInPassword) {
      setError("Enter the email and password for your account.");
      setNotice(null);
      return;
    }

    setSignInPending(true);
    setError(null);
    setNotice(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const previousSession = await supabase.auth.getSession();
      rememberAnonymousSession(previousSession.data.session);
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: nextEmail,
          password: signInPassword,
        });

      if (signInError) {
        throw signInError;
      }

      let merged = false;
      try {
        merged = await mergeRememberedAnonymousData(data.session, data.user);
      } catch {
        setNotice(
          "You are signed in, but temporary data could not be moved yet. Refresh this page to retry.",
        );
      }

      if (data.user && !hasPasswordSet(data.user)) {
        try {
          await markPasswordSet(supabase);
          const refreshed = await supabase.auth.getUser();
          setUser(refreshed.data.user);
        } catch {
          setUser(data.user);
        }
      } else {
        setUser(data.user);
      }

      setSignInEmail("");
      setSignInPassword("");
      if (merged) {
        setNotice(
          "Signed in. Your temporary follows, saved shows, and drafts were moved to this account.",
        );
      }
    } catch (signInError) {
      setError(signInMessage(signInError));
    } finally {
      setSignInPending(false);
    }
  }

  async function signOut() {
    setSignOutPending(true);
    setError(null);
    setNotice(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        throw signOutError;
      }

      const next = await ensureAnonymousUser(supabase);
      setUser(next);
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("Could not sign out. Try refreshing the page.");
    } finally {
      setSignOutPending(false);
    }
  }

  return (
    <main
      id="main"
      tabIndex={-1}
      className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-20 outline-none sm:px-8 sm:pb-16"
    >
      <section className="flex max-w-xl flex-col gap-3 py-8 sm:py-16">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent sm:text-sm">
          Your account
        </p>
        <h1 className="font-display text-[1.75rem] leading-[1.12] font-medium tracking-tight sm:text-5xl">
          {complete ? "Account ready" : "Save your shows across devices"}
        </h1>
        <p className="text-base leading-7 text-mute sm:text-lg sm:leading-8">
          {complete
            ? "You can sign back in on another phone or computer with this email."
            : "Add an email so you can sign back in on another device."}
        </p>
      </section>

      {!ready ? (
        <p
          className={`${panelClass} max-w-xl text-sm leading-6 text-mute`}
          aria-live="polite"
        >
          Loading account\u2026
        </p>
      ) : (
        <div className="flex max-w-xl flex-col gap-8">
          {error ? (
            <p
              className="rounded-2xl border border-line bg-panel px-4 py-3 text-sm leading-6 text-foreground"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          {notice ? (
            <p
              className="rounded-2xl border border-line bg-panel px-4 py-3 text-sm leading-6 text-foreground"
              role="status"
            >
              {notice}
            </p>
          ) : null}

          {complete && email ? (
            <section className={panelClass}>
              <h2 className="font-display text-xl tracking-tight sm:text-2xl">
                Account ready
              </h2>
              <p className="mt-2 text-sm leading-6 text-mute sm:text-base">
                Signed in as {email}
              </p>
              <button
                type="button"
                onClick={() => {
                  void signOut();
                }}
                disabled={signOutPending}
                className={`${secondaryButtonClass} mt-5`}
              >
                {signOutPending ? "Signing out\u2026" : "Sign out"}
              </button>
            </section>
          ) : null}

          {needsPassword && email ? (
            <section className={panelClass}>
              <h2 className="font-display text-xl tracking-tight sm:text-2xl">
                Create password
              </h2>
              <p className="mt-2 text-sm leading-6 text-mute sm:text-base">
                Your email is verified. Add a password so you can sign in later.
              </p>
              <form onSubmit={createPassword} className="mt-5 flex flex-col gap-4">
                <div>
                  <label
                    htmlFor="new-password"
                    className="mb-2 block text-sm font-medium text-foreground"
                  >
                    Password
                  </label>
                  <input
                    id="new-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={MIN_PASSWORD_LENGTH}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label
                    htmlFor="confirm-password"
                    className="mb-2 block text-sm font-medium text-foreground"
                  >
                    Confirm password
                  </label>
                  <input
                    id="confirm-password"
                    name="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={MIN_PASSWORD_LENGTH}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className={fieldClass}
                  />
                </div>
                <button
                  type="submit"
                  disabled={passwordPending}
                  className={primaryButtonClass}
                >
                  {passwordPending ? "Saving\u2026" : "Save password"}
                </button>
              </form>
            </section>
          ) : null}

          {anonymous ? (
            <section className={panelClass}>
              <h2 className="font-display text-xl tracking-tight sm:text-2xl">
                Save your account
              </h2>
              <p className="mt-2 text-sm leading-6 text-mute sm:text-base">
                Add an email so you can sign back in on another device.
              </p>
              {waitingEmail ? (
                <p className="mt-4 text-sm leading-6 text-foreground">
                  Verification is still pending. Open the latest email we sent,
                  then come back here. Check spam or junk if it is missing.
                </p>
              ) : null}
              <form onSubmit={sendVerification} className="mt-5 flex flex-col gap-4">
                <div>
                  <label
                    htmlFor="upgrade-email"
                    className="mb-2 block text-sm font-medium text-foreground"
                  >
                    Email address
                  </label>
                  <input
                    id="upgrade-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={upgradeEmail}
                    onChange={(event) => setUpgradeEmail(event.target.value)}
                    placeholder="you@email.com"
                    className={fieldClass}
                  />
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="submit"
                    disabled={upgradePending}
                    className={primaryButtonClass}
                  >
                    {upgradePending ? "Sending\u2026" : "Send verification email"}
                  </button>
                  {waitingEmail ? (
                    <button
                      type="button"
                      onClick={() => {
                        void resendVerification();
                      }}
                      disabled={upgradePending || resendWait > 0}
                      className={secondaryButtonClass}
                    >
                      {resendWait > 0
                        ? `Resend in ${resendWait}s`
                        : "Resend email"}
                    </button>
                  ) : null}
                </div>
              </form>
            </section>
          ) : null}

          {!complete ? (
            <section className={panelClass}>
              <h2 className="font-display text-xl tracking-tight sm:text-2xl">
                I already have an account
              </h2>
              <p className="mt-2 text-sm leading-6 text-mute sm:text-base">
                Sign in with email and password. Temporary follows, saved
                shows, and drafts from this browser will move with you.
              </p>
              <form onSubmit={signIn} className="mt-5 flex flex-col gap-4">
                <div>
                  <label
                    htmlFor="signin-email"
                    className="mb-2 block text-sm font-medium text-foreground"
                  >
                    Email
                  </label>
                  <input
                    id="signin-email"
                    name="signin-email"
                    type="email"
                    autoComplete="username"
                    value={signInEmail}
                    onChange={(event) => setSignInEmail(event.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label
                    htmlFor="signin-password"
                    className="mb-2 block text-sm font-medium text-foreground"
                  >
                    Password
                  </label>
                  <input
                    id="signin-password"
                    name="signin-password"
                    type="password"
                    autoComplete="current-password"
                    value={signInPassword}
                    onChange={(event) => setSignInPassword(event.target.value)}
                    className={fieldClass}
                  />
                </div>
                <button
                  type="submit"
                  disabled={signInPending}
                  className={primaryButtonClass}
                >
                  {signInPending ? "Signing in\u2026" : "Sign in"}
                </button>
              </form>
            </section>
          ) : null}
        </div>
      )}
    </main>
  );
}
