import type { Metadata } from "next";
import { Suspense } from "react";

import { SiteHeader } from "../../components/site-header";
import { AuthAppHandoff } from "../../components/auth-app-handoff";
import { firstParam } from "../../../shared/auth-callback.ts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Open ShowSignal",
  robots: {
    index: false,
    follow: false,
  },
};

function sourceUrlFromSearch(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    const first = firstParam(value);
    if (first) {
      params.set(key, first);
    }
  }
  const query = params.toString();
  return query ? `https://callback.local/auth/callback?${query}` : null;
}

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const sourceUrl = sourceUrlFromSearch(query);

  return (
    <div className="relative flex flex-1 flex-col overflow-x-hidden">
      <SiteHeader />
      <main className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-16">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
          ShowSignal
        </p>
        <h1 className="font-display text-3xl font-medium tracking-tight">
          Opening ShowSignal
        </h1>
        <p className="text-base leading-7 text-mute">
          This confirmation link opens the ShowSignal app when it is installed.
          If the app does not open, tap the button below. Continue on the
          website only if you started this from a browser, not the app.
        </p>
        <Suspense>
          <AuthAppHandoff mode="handoff-first" sourceUrl={sourceUrl} />
        </Suspense>
      </main>
    </div>
  );
}
