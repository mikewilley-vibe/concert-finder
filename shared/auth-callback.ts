export const APP_SCHEME = "showsignal";
export const AUTH_CALLBACK_PATH = "/auth/callback";

const AUTH_CALLBACK_PATHS = ["/auth/callback", "auth/callback"];

export type AuthCallbackPayload = {
  code: string | null;
  tokenHash: string | null;
  type: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  error: string | null;
  errorDescription: string | null;
};

export function firstParam(
  value: string | string[] | null | undefined,
): string | null {
  if (Array.isArray(value)) {
    return firstParam(value[0]);
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readParams(source: URLSearchParams): AuthCallbackPayload {
  return {
    code: firstParam(source.get("code")),
    tokenHash: firstParam(source.get("token_hash")),
    type: firstParam(source.get("type")),
    accessToken: firstParam(source.get("access_token")),
    refreshToken: firstParam(source.get("refresh_token")),
    error: firstParam(source.get("error")),
    errorDescription: firstParam(source.get("error_description")),
  };
}

function mergePayload(
  query: AuthCallbackPayload,
  hash: AuthCallbackPayload,
): AuthCallbackPayload {
  return {
    code: query.code ?? hash.code,
    tokenHash: query.tokenHash ?? hash.tokenHash,
    type: query.type ?? hash.type,
    accessToken: query.accessToken ?? hash.accessToken,
    refreshToken: query.refreshToken ?? hash.refreshToken,
    error: query.error ?? hash.error,
    errorDescription: query.errorDescription ?? hash.errorDescription,
  };
}

export function parseAuthCallback(url: string): AuthCallbackPayload {
  try {
    const parsed = new URL(url);
    const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
    return mergePayload(readParams(parsed.searchParams), readParams(hash));
  } catch {
    const [withoutHash, hashPart = ""] = url.split("#");
    const queryIndex = withoutHash.indexOf("?");
    const query =
      queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : "";
    return mergePayload(
      readParams(new URLSearchParams(query)),
      readParams(new URLSearchParams(hashPart)),
    );
  }
}

function pathFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/\/+$/, "") || "/";
  } catch {
    const withoutHash = url.split("#")[0] ?? "";
    const withoutQuery = withoutHash.split("?")[0] ?? "";
    const schemeIndex = withoutQuery.indexOf("://");
    const afterScheme =
      schemeIndex >= 0 ? withoutQuery.slice(schemeIndex + 3) : withoutQuery;
    const path = afterScheme.replace(/^[^/]*/, "");
    return path.replace(/\/+$/, "") || afterScheme;
  }
}

export function isAuthCallbackUrl(url: string | null | undefined): boolean {
  if (!url) {
    return false;
  }

  const path = pathFromUrl(url).toLowerCase();
  if (AUTH_CALLBACK_PATHS.some((candidate) => path.endsWith(candidate))) {
    return true;
  }

  const lowered = url.toLowerCase();
  return (
    lowered.startsWith(`${APP_SCHEME}://auth/callback`) ||
    lowered.includes("/--/auth/callback")
  );
}

export function hasAuthPayload(payload: AuthCallbackPayload): boolean {
  return Boolean(
    payload.code ||
      payload.tokenHash ||
      payload.accessToken ||
      payload.refreshToken ||
      payload.error ||
      payload.errorDescription,
  );
}

export function isMobileUserAgent(userAgent: string): boolean {
  return /iPhone|iPad|iPod|Android/i.test(userAgent);
}

function appendParam(
  params: URLSearchParams,
  key: string,
  value: string | null,
) {
  if (value) {
    params.set(key, value);
  }
}

export function toAppAuthCallbackUrl(
  sourceUrl: string,
  extra?: { accessToken?: string | null; refreshToken?: string | null },
): string {
  const payload = parseAuthCallback(sourceUrl);
  const params = new URLSearchParams();
  appendParam(params, "code", payload.code);
  appendParam(params, "token_hash", payload.tokenHash);
  appendParam(params, "type", payload.type);
  appendParam(params, "access_token", extra?.accessToken ?? payload.accessToken);
  appendParam(
    params,
    "refresh_token",
    extra?.refreshToken ?? payload.refreshToken,
  );
  appendParam(params, "error", payload.error);
  appendParam(params, "error_description", payload.errorDescription);

  const query = params.toString();
  return query
    ? `${APP_SCHEME}://auth/callback?${query}`
    : `${APP_SCHEME}://auth/callback`;
}

export function authCallbackErrorMessage(detail: string) {
  if (/otp_expired|expired|invalid/i.test(detail)) {
    return "That confirmation link is expired or invalid. Request a new verification email.";
  }

  if (/access_denied/i.test(detail)) {
    return "The confirmation link was denied. Request a new verification email.";
  }

  if (/code verifier|pkce|code challenge/i.test(detail)) {
    return "Open the confirmation link on this phone so ShowSignal can finish signing you in.";
  }

  return "Could not finish email confirmation. Request a new verification email.";
}

export function authCallbackSuccessMessage(type: string | null) {
  if (type === "recovery") {
    return "Reset link accepted. Set a new password.";
  }

  if (type === "email_change" || type === "signup" || type === "email") {
    return "Email confirmed.";
  }

  return "Signed in.";
}

export const AUTH_ASSOCIATION = {
  appleTeamId: "896999WP34",
  bundleId: "com.mikewilley.localshows",
  productionHost: "concert-finder-eta.vercel.app",
  developmentHost: "concert-finder-dev.vercel.app",
  callbackPath: AUTH_CALLBACK_PATH,
};
