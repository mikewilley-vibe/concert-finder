"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";

import {
  APP_SCHEME,
  hasAuthPayload,
  isMobileUserAgent,
  parseAuthCallback,
  toAppAuthCallbackUrl,
} from "../../shared/auth-callback.ts";

const DEFAULT_APP_LINK = `${APP_SCHEME}://auth/callback`;

const primaryButtonClass =
  "inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-7 text-base font-semibold text-background";

function readHandoff(sourceUrl?: string | null) {
  if (typeof window === "undefined") {
    return {
      appLink: sourceUrl ? toAppAuthCallbackUrl(sourceUrl) : DEFAULT_APP_LINK,
      hasPayload: Boolean(sourceUrl && hasAuthPayload(parseAuthCallback(sourceUrl))),
      continueHref: "/account",
      href: sourceUrl ?? "",
    };
  }

  const href = sourceUrl || window.location.href;
  const payload = parseAuthCallback(href);
  const parsed = new URL(href, window.location.origin);
  return {
    appLink: toAppAuthCallbackUrl(href),
    hasPayload: hasAuthPayload(payload),
    continueHref: `/account${parsed.search}${parsed.hash}`,
    href,
  };
}

export function AuthAppHandoff({
  mode,
  sourceUrl,
}: {
  mode: "handoff-first" | "web-first";
  sourceUrl?: string | null;
}) {
  const handoff = useMemo(() => readHandoff(sourceUrl), [sourceUrl]);

  useEffect(() => {
    if (
      mode === "handoff-first" &&
      handoff.appLink &&
      handoff.hasPayload &&
      isMobileUserAgent(window.navigator.userAgent)
    ) {
      window.location.assign(handoff.appLink);
    }
  }, [handoff.appLink, handoff.hasPayload, mode]);

  if (!handoff.hasPayload && mode === "web-first") {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {handoff.appLink ? (
        <a href={handoff.appLink} className={primaryButtonClass}>
          Open ShowSignal
        </a>
      ) : null}
      {mode === "handoff-first" ? (
        <Link href={handoff.continueHref} className="text-sm text-mute underline">
          Continue on the website
        </Link>
      ) : (
        <p className="text-sm text-mute">
          If this phone has ShowSignal installed, open the app to finish there.
        </p>
      )}
    </div>
  );
}
