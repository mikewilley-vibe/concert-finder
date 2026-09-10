import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteHeader } from "../../../components/site-header";
import { OpenInAppButton } from "./open-in-app";

const KINDS = ["artist", "venue", "concert"] as const;
type OpenKind = (typeof KINDS)[number];

function isOpenKind(value: string): value is OpenKind {
  return KINDS.includes(value as OpenKind);
}

function firstQuery(value: string | string[] | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function appLink(kind: OpenKind, id: string, name: string) {
  const path = `${kind}/${encodeURIComponent(id)}`;
  if (!name) {
    return `showsignal://${path}`;
  }
  return `showsignal://${path}?name=${encodeURIComponent(name)}`;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { kind, id } = await params;
  const query = await searchParams;
  const name = firstQuery(query.name);
  if (!isOpenKind(kind) || !id.trim()) {
    return { title: "Open in ShowSignal", robots: { index: false, follow: false } };
  }
  return {
    title: name || "Open in ShowSignal",
    robots: { index: false, follow: false },
  };
}

export default async function OpenInAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { kind, id } = await params;
  const query = await searchParams;
  const name = firstQuery(query.name);
  if (!isOpenKind(kind) || !id.trim()) {
    notFound();
  }

  const label = name || (kind === "artist" ? "Artist" : kind === "venue" ? "Venue" : "Concert");
  const link = appLink(kind, id.trim(), name);

  return (
    <div className="relative flex flex-1 flex-col overflow-x-hidden">
      <SiteHeader />
      <main className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-16">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
          ShowSignal
        </p>
        <h1 className="font-display text-3xl font-medium tracking-tight">
          {label}
        </h1>
        <p className="text-base leading-7 text-mute">
          This link opens in the ShowSignal app if it is installed.
        </p>
        <OpenInAppButton appLink={link} label={label} />
        <Link href="/" className="text-sm text-mute underline">
          Continue on the website
        </Link>
      </main>
    </div>
  );
}
