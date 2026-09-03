"use client";

import { useState } from "react";
import {
  kindLabels,
  type ItemKind,
  type ListingItem,
} from "../../lib/listing-item";

const kindStyles: Record<ItemKind, string> = {
  concert: "bg-accent/15 text-accent",
  album: "bg-violet-400/15 text-violet-300",
  past: "bg-rose-400/12 text-rose-300",
  venue: "bg-sky-400/12 text-sky-300",
};

type ShowCardProps = {
  item: ListingItem;
  saved?: boolean;
  favoriteBusy?: boolean;
  favoritesReady?: boolean;
  favoritesUnavailable?: boolean;
  onToggleFavorite?: () => void;
};

export function ShowCard({
  item,
  saved = false,
  favoriteBusy = false,
  favoritesReady = false,
  favoritesUnavailable = false,
  onToggleFavorite,
}: ShowCardProps) {
  const [open, setOpen] = useState(false);
  const isDraft = item.kind === "concert" && item.published === false;
  const canFavorite = item.kind === "concert" && Boolean(onToggleFavorite);
  const favoriteLabel =
    !favoritesReady && !favoritesUnavailable
      ? "Loading\u2026"
      : saved
        ? "Saved"
        : "Save show";

  return (
    <li className="flex flex-col rounded-3xl border border-line bg-panel p-4 shadow-[0_12px_32px_rgba(0,0,0,0.32)] transition-colors hover:bg-panel-hover sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <div className="flex shrink-0 flex-row items-center gap-3 rounded-2xl bg-accent/10 px-3 py-2.5 sm:w-16 sm:flex-col sm:justify-center sm:gap-0 sm:px-1 sm:py-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent sm:text-xs">
            {item.month}
          </span>
          <span className="font-display text-2xl leading-none tracking-tight sm:text-3xl">
            {item.day}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-mute sm:mt-1 sm:text-xs">
            {item.weekday}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          {isDraft ? (
            <span className="inline-flex w-fit rounded-full bg-mute/15 px-2.5 py-1 text-xs font-semibold tracking-wide text-mute">
              Draft
            </span>
          ) : (
            <span
              className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide ${kindStyles[item.kind]}`}
            >
              {kindLabels[item.kind]}
            </span>
          )}
          <h3 className="mt-2 font-display text-xl leading-tight tracking-tight sm:text-2xl">
            {item.title}
          </h3>
          <p className="mt-1 text-sm text-accent">{item.dateLabel}</p>
          <p className="mt-0.5 text-sm leading-5 text-mute">{item.place}</p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-foreground/90">{item.note}</p>
      {isDraft ? (
        <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-mute">
          Waiting to be published
        </p>
      ) : null}
      {item.genre ? (
        <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-mute">
          {item.genre}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          aria-expanded={open}
          aria-label={
            open ? `Hide details for ${item.title}` : `Show details for ${item.title}`
          }
          onClick={() => setOpen((value) => !value)}
          className="inline-flex min-h-12 w-full touch-manipulation items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-background transition-colors hover:bg-accent-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:min-h-11 sm:w-auto"
        >
          {open ? "Hide details" : "Show details"}
        </button>
        {canFavorite ? (
          <button
            type="button"
            aria-pressed={saved}
            aria-label={
              saved
                ? `Unsave ${item.title}`
                : `Save show ${item.title}`
            }
            aria-busy={favoriteBusy || (!favoritesReady && !favoritesUnavailable)}
            disabled={!favoritesReady || favoriteBusy}
            onClick={onToggleFavorite}
            className={
              saved
                ? "inline-flex min-h-12 w-full touch-manipulation items-center justify-center rounded-full border border-accent bg-accent/15 px-5 text-sm font-semibold text-accent transition-colors hover:bg-accent/25 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-70 sm:min-h-11 sm:w-auto"
                : "inline-flex min-h-12 w-full touch-manipulation items-center justify-center rounded-full border border-line px-5 text-sm font-semibold text-foreground transition-colors hover:bg-panel-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-70 sm:min-h-11 sm:w-auto"
            }
          >
            {favoriteBusy ? "Loading\u2026" : favoriteLabel}
          </button>
        ) : null}
      </div>

      {open ? (
        <p className="mt-3 rounded-2xl border border-line bg-background/70 px-3 py-3 text-sm leading-6 text-mute">
          {item.details}
        </p>
      ) : null}
    </li>
  );
}
