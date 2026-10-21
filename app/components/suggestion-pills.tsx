"use client";

import { useEffect, useState } from "react";
import type { SuggestionPill } from "../../shared/api/v1";

const UNDO_MS = 5000;

export function SuggestionPills({
  label,
  pills,
  followedIds,
  onFollow,
  onUnfollow,
  onDismiss,
}: {
  label: string;
  pills: SuggestionPill[];
  followedIds: Set<string>;
  onFollow: (pill: SuggestionPill) => Promise<boolean>;
  onUnfollow: (pill: SuggestionPill) => Promise<boolean>;
  onDismiss: (pill: SuggestionPill) => Promise<boolean>;
}) {
  const [hidden, setHidden] = useState<Record<string, true>>({});
  const [undo, setUndo] = useState<SuggestionPill | null>(null);

  useEffect(() => {
    if (!undo) {
      return;
    }
    const timer = window.setTimeout(() => setUndo(null), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [undo]);

  const visible = pills.filter((pill) => !hidden[pill.id] && !followedIds.has(pill.id));
  if (visible.length === 0 && !undo) {
    return null;
  }

  async function follow(pill: SuggestionPill) {
    const ok = await onFollow(pill);
    if (!ok) {
      return;
    }
    setHidden((current) => ({ ...current, [pill.id]: true }));
    setUndo(pill);
  }

  async function undoFollow() {
    if (!undo) {
      return;
    }
    const pill = undo;
    setUndo(null);
    const ok = await onUnfollow(pill);
    if (!ok) {
      return;
    }
    setHidden((current) => {
      const next = { ...current };
      delete next[pill.id];
      return next;
    });
  }

  async function dismiss(pill: SuggestionPill) {
    setHidden((current) => ({ ...current, [pill.id]: true }));
    const ok = await onDismiss(pill);
    if (!ok) {
      setHidden((current) => {
        const next = { ...current };
        delete next[pill.id];
        return next;
      });
    }
  }

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-foreground">{label}</h4>
      <ul className="mt-3 flex flex-wrap gap-2">
        {visible.map((pill) => (
          <li
            key={pill.id}
            className="flex min-w-[46%] flex-1 items-stretch overflow-hidden rounded-2xl border border-[#667637] bg-panel"
          >
            <button
              type="button"
              className="min-w-0 flex-1 px-3 py-2.5 text-left hover:bg-[#252b1e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              aria-label={`Follow ${pill.name}. ${pill.reason}`}
              onClick={() => {
                void follow(pill);
              }}
            >
              <span className="block text-sm font-semibold leading-5 text-foreground">
                {pill.name}
              </span>
              <span className="mt-0.5 block text-xs font-medium leading-4 text-accent">
                {pill.reason}
              </span>
            </button>
            <button
              type="button"
              className="w-9 text-lg text-mute hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              aria-label={`Dismiss ${pill.name}`}
              onClick={() => {
                void dismiss(pill);
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {undo ? (
        <p className="mt-3 flex items-center justify-between gap-3 text-sm text-foreground">
          <span>Following {undo.name}</span>
          <button
            type="button"
            className="font-semibold text-accent"
            aria-label={`Undo following ${undo.name}`}
            onClick={() => {
              void undoFollow();
            }}
          >
            Undo
          </button>
        </p>
      ) : null}
    </div>
  );
}

export function readStoredSuggestionLocation() {
  try {
    const raw = window.localStorage.getItem("local-shows:home-location");
    if (!raw) {
      return { radiusMiles: 100 };
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { radiusMiles: 100 };
    }
    const record = parsed as {
      postalCode?: unknown;
      latitude?: unknown;
      longitude?: unknown;
      radiusMiles?: unknown;
    };
    const location: {
      postalCode?: string;
      latitude?: number;
      longitude?: number;
      radiusMiles: number;
    } = {
      radiusMiles:
        typeof record.radiusMiles === "number" &&
        Number.isInteger(record.radiusMiles) &&
        record.radiusMiles >= 1 &&
        record.radiusMiles <= 500
          ? record.radiusMiles
          : 100,
    };
    if (typeof record.postalCode === "string" && record.postalCode.trim()) {
      location.postalCode = record.postalCode.trim();
    }
    if (
      typeof record.latitude === "number" &&
      Number.isFinite(record.latitude) &&
      typeof record.longitude === "number" &&
      Number.isFinite(record.longitude)
    ) {
      location.latitude = record.latitude;
      location.longitude = record.longitude;
    }
    return location;
  } catch {
    return { radiusMiles: 100 };
  }
}
