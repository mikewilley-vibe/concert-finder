"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { isPermanentUser } from "../../lib/account";
import {
  deleteOwnDraft,
  loadOwnConcerts,
  updateOwnDraft,
  type ManagedConcert,
} from "../../lib/concerts";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser-client";

const fieldClass =
  "min-h-12 w-full rounded-full border border-line bg-background px-4 text-base text-foreground outline-none placeholder:text-mute/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const panelClass =
  "rounded-3xl border border-line bg-panel p-4 shadow-[0_12px_32px_rgba(0,0,0,0.32)] sm:p-5";

const primaryButtonClass =
  "inline-flex min-h-12 w-full touch-manipulation items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-background transition-colors hover:bg-accent-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto";

const secondaryButtonClass =
  "inline-flex min-h-12 w-full touch-manipulation items-center justify-center rounded-full border border-line px-6 text-sm font-semibold text-foreground transition-colors hover:bg-panel-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto";

const MAX = {
  artist: 120,
  venue: 120,
  city: 80,
  description: 600,
};

function managementMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";

  if (message.includes("NEXT_PUBLIC_SUPABASE")) {
    return "Submissions need NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.";
  }

  if (code === "42501" || /row-level security|could not change this concert/i.test(message)) {
    return "That draft could not be changed. Sign in with your account and try a draft that still belongs to you.";
  }

  return "Could not update your submissions right now. Try again.";
}

export function MySubmissionsScreen() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [rows, setRows] = useState<ManagedConcert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [artist, setArtist] = useState("");
  const [venue, setVenue] = useState("");
  const [city, setCity] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [description, setDescription] = useState("");

  async function refresh(userId: string) {
    const supabase = getSupabaseBrowserClient();
    const next = await loadOwnConcerts(supabase, userId);
    setRows(next);
  }

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let cancelled = false;

    async function boot() {
      try {
        const { data, error: userError } = await supabase.auth.getUser();
        if (cancelled) {
          return;
        }

        if (userError) {
          setUser(null);
          setReady(true);
          return;
        }

        setUser(data.user);
        if (isPermanentUser(data.user) && data.user) {
          await refresh(data.user.id);
        }
      } catch (bootError) {
        if (!cancelled) {
          setError(managementMessage(bootError));
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

      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (isPermanentUser(nextUser) && nextUser) {
        void refresh(nextUser.id).catch((loadError) => {
          setError(managementMessage(loadError));
        });
      } else {
        setRows([]);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const permanent = isPermanentUser(user);

  function startEdit(row: ManagedConcert) {
    setDeletingId(null);
    setEditingId(row.id);
    setArtist(row.artist);
    setVenue(row.venue);
    setCity(row.city);
    setEventDate(row.event_date);
    setDescription(row.description);
    setError(null);
    setNotice(null);
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId || !user) {
      return;
    }

    const nextArtist = artist.trim();
    if (!nextArtist) {
      setNotice(null);
      setError("Artist is required.");
      return;
    }

    setPending(true);
    setError(null);
    setNotice(null);

    try {
      const supabase = getSupabaseBrowserClient();
      await updateOwnDraft(supabase, editingId, {
        artist: nextArtist,
        venue: venue.trim(),
        city: city.trim(),
        event_date: eventDate.trim() || null,
        description: description.trim() || null,
      });
      await refresh(user.id);
      setEditingId(null);
      setNotice("Draft saved.");
    } catch (saveError) {
      setError(managementMessage(saveError));
    } finally {
      setPending(false);
    }
  }

  async function confirmDelete() {
    if (!deletingId || !user) {
      return;
    }

    setPending(true);
    setError(null);
    setNotice(null);

    try {
      const supabase = getSupabaseBrowserClient();
      await deleteOwnDraft(supabase, deletingId);
      await refresh(user.id);
      setDeletingId(null);
      setNotice("Draft deleted.");
    } catch (deleteError) {
      setError(managementMessage(deleteError));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-20 sm:px-8 sm:pb-16">
      <section className="flex max-w-xl flex-col gap-3 py-8 sm:py-16">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent sm:text-sm">
          Your submissions
        </p>
        <h1 className="font-display text-[1.75rem] leading-[1.12] font-medium tracking-tight sm:text-5xl">
          My Submissions
        </h1>
        <p className="text-base leading-7 text-mute sm:text-lg sm:leading-8">
          Edit or delete drafts you submitted. Published shows stay view-only.
        </p>
      </section>

      {!ready ? (
        <p className={`${panelClass} max-w-xl text-sm leading-6 text-mute`}>
          Loading submissions…
        </p>
      ) : !permanent ? (
        <section className={`${panelClass} max-w-xl`}>
          <p className="text-sm leading-6 text-foreground sm:text-base">
            Create or sign in to an account to manage your submissions.
          </p>
          <Link href="/account" className={`${primaryButtonClass} mt-5`}>
            Go to Account
          </Link>
        </section>
      ) : (
        <div className="flex max-w-xl flex-col gap-5">
          {error ? (
            <p
              className="rounded-2xl border border-line bg-panel px-4 py-3 text-sm leading-6 text-mute"
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

          {rows.length === 0 ? (
            <p className={`${panelClass} text-sm leading-6 text-mute`}>
              You have not submitted any concerts yet. Add one from the home
              page.
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {rows.map((row) => {
                const isDraft = !row.is_published;
                const isEditing = editingId === row.id;
                const isDeleting = deletingId === row.id;

                return (
                  <li key={row.id} className={panelClass}>
                    <span
                      className={
                        isDraft
                          ? "inline-flex w-fit rounded-full bg-mute/15 px-2.5 py-1 text-xs font-semibold tracking-wide text-mute"
                          : "inline-flex w-fit rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold tracking-wide text-accent"
                      }
                    >
                      {isDraft ? "DRAFT" : "PUBLISHED"}
                    </span>
                    <h2 className="mt-3 font-display text-xl tracking-tight">
                      {row.artist}
                    </h2>
                    <p className="mt-1 text-sm text-mute">
                      {[row.venue, row.city].filter(Boolean).join(" · ") ||
                        "Venue coming soon"}
                    </p>
                    {row.event_date ? (
                      <p className="mt-1 text-sm text-accent">{row.event_date}</p>
                    ) : null}

                    {isEditing ? (
                      <form onSubmit={saveEdit} className="mt-5 flex flex-col gap-4">
                        <div>
                          <label
                            htmlFor={`edit-artist-${row.id}`}
                            className="mb-2 block text-sm font-medium text-foreground"
                          >
                            Artist
                          </label>
                          <input
                            id={`edit-artist-${row.id}`}
                            type="text"
                            required
                            maxLength={MAX.artist}
                            value={artist}
                            onChange={(event) => setArtist(event.target.value)}
                            className={fieldClass}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`edit-venue-${row.id}`}
                            className="mb-2 block text-sm font-medium text-foreground"
                          >
                            Venue
                          </label>
                          <input
                            id={`edit-venue-${row.id}`}
                            type="text"
                            maxLength={MAX.venue}
                            value={venue}
                            onChange={(event) => setVenue(event.target.value)}
                            className={fieldClass}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`edit-city-${row.id}`}
                            className="mb-2 block text-sm font-medium text-foreground"
                          >
                            City
                          </label>
                          <input
                            id={`edit-city-${row.id}`}
                            type="text"
                            maxLength={MAX.city}
                            value={city}
                            onChange={(event) => setCity(event.target.value)}
                            className={fieldClass}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`edit-date-${row.id}`}
                            className="mb-2 block text-sm font-medium text-foreground"
                          >
                            Event date
                          </label>
                          <input
                            id={`edit-date-${row.id}`}
                            type="date"
                            value={eventDate}
                            onChange={(event) => setEventDate(event.target.value)}
                            className={fieldClass}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`edit-description-${row.id}`}
                            className="mb-2 block text-sm font-medium text-foreground"
                          >
                            Description
                          </label>
                          <textarea
                            id={`edit-description-${row.id}`}
                            maxLength={MAX.description}
                            rows={4}
                            value={description}
                            onChange={(event) =>
                              setDescription(event.target.value)
                            }
                            className="min-h-24 w-full rounded-2xl border border-line bg-background px-4 py-3 text-base text-foreground outline-none placeholder:text-mute/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                          />
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <button
                            type="submit"
                            disabled={pending}
                            className={primaryButtonClass}
                          >
                            {pending ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setEditingId(null)}
                            className={secondaryButtonClass}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : null}

                    {isDeleting ? (
                      <div className="mt-5 rounded-2xl border border-line bg-background/70 px-4 py-4">
                        <p className="text-sm font-medium text-foreground">
                          Delete this draft?
                        </p>
                        <p className="mt-2 text-sm leading-6 text-mute">
                          This cannot be undone.
                        </p>
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setDeletingId(null)}
                            className={secondaryButtonClass}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => {
                              void confirmDelete();
                            }}
                            className={primaryButtonClass}
                          >
                            {pending ? "Deleting…" : "Delete draft"}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {isDraft && !isEditing && !isDeleting ? (
                      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          className={primaryButtonClass}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setDeletingId(row.id);
                            setNotice(null);
                            setError(null);
                          }}
                          className={secondaryButtonClass}
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}
