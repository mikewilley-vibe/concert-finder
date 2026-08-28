"use client";

import { FormEvent, useState } from "react";
import { submitConcert } from "../../lib/concerts";
import { ensureAnonymousUser } from "../../lib/saved-concerts";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser-client";

const fieldClass =
  "min-h-12 w-full rounded-full border border-line bg-background px-4 text-base text-foreground outline-none placeholder:text-mute/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const MAX = {
  artist: 120,
  venue: 120,
  city: 80,
  description: 600,
};

function submitMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";

  if (message.includes("NEXT_PUBLIC_SUPABASE")) {
    return "Couldn't save that. Try again.";
  }

  if (
    code === "anonymous_provider_disabled" ||
    /anonymous sign-ins are disabled/i.test(message)
  ) {
    return "Couldn't start a session. Try refreshing the page.";
  }

  if (code === "42501" || /row-level security/i.test(message)) {
    return "Could not submit this concert. Try refreshing the page and sending it again.";
  }

  return "Could not submit this concert right now. Try again.";
}

type AddConcertFormProps = {
  onSubmitted: () => Promise<void> | void;
};

export function AddConcertForm({ onSubmitted }: AddConcertFormProps) {
  const [artist, setArtist] = useState("");
  const [venue, setVenue] = useState("");
  const [city, setCity] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextArtist = artist.trim();
    if (!nextArtist) {
      setSuccess(null);
      setError("Artist is required.");
      return;
    }

    setPending(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const user = await ensureAnonymousUser(supabase);
      await submitConcert(supabase, user.id, {
        artist: nextArtist,
        venue: venue.trim(),
        city: city.trim(),
        event_date: eventDate.trim() || null,
        description: description.trim() || null,
      });

      setArtist("");
      setVenue("");
      setCity("");
      setEventDate("");
      setDescription("");
      setSuccess("Thanks — your concert was submitted as a draft.");
      await onSubmitted();
    } catch (submitError) {
      setSuccess(null);
      setError(submitMessage(submitError));
    } finally {
      setPending(false);
    }
  }

  return (
    <section id="add-concert" className="mt-10 scroll-mt-24 sm:mt-12">
      <h3 className="font-display text-xl tracking-tight sm:text-2xl">
        Add a Concert
      </h3>
      <p className="mt-2 max-w-xl text-sm leading-6 text-mute sm:text-base">
        Suggest a show. It stays as a draft until it is published for everyone.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-5 rounded-3xl border border-line bg-panel p-4 shadow-[0_12px_32px_rgba(0,0,0,0.32)] sm:p-5"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label
              htmlFor="concert-artist"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Artist
            </label>
            <input
              id="concert-artist"
              name="artist"
              type="text"
              required
              maxLength={MAX.artist}
              value={artist}
              onChange={(event) => setArtist(event.target.value)}
              placeholder="Like Big Thief"
              autoComplete="off"
              className={fieldClass}
            />
          </div>

          <div>
            <label
              htmlFor="concert-venue"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Venue
            </label>
            <input
              id="concert-venue"
              name="venue"
              type="text"
              maxLength={MAX.venue}
              value={venue}
              onChange={(event) => setVenue(event.target.value)}
              placeholder="The Anthem"
              autoComplete="off"
              className={fieldClass}
            />
          </div>

          <div>
            <label
              htmlFor="concert-city"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              City
            </label>
            <input
              id="concert-city"
              name="city"
              type="text"
              maxLength={MAX.city}
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Washington, DC"
              autoComplete="off"
              className={fieldClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="concert-date"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Event date
            </label>
            <input
              id="concert-date"
              name="event_date"
              type="date"
              value={eventDate}
              onChange={(event) => setEventDate(event.target.value)}
              className={fieldClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor="concert-description"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Description
            </label>
            <textarea
              id="concert-description"
              name="description"
              maxLength={MAX.description}
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Doors, openers, or anything fans should know"
              className="min-h-24 w-full rounded-2xl border border-line bg-background px-4 py-3 text-base text-foreground outline-none placeholder:text-mute/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </div>
        </div>

        {error ? (
          <p
            className="mt-4 rounded-2xl border border-line bg-background/70 px-4 py-3 text-sm leading-6 text-foreground"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {success ? (
          <p
            className="mt-4 rounded-2xl border border-line bg-background/70 px-4 py-3 text-sm leading-6 text-foreground"
            role="status"
          >
            {success}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-5 inline-flex min-h-12 w-full touch-manipulation items-center justify-center rounded-full bg-accent px-6 text-base font-semibold text-background transition-colors hover:bg-accent-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
        >
          {pending ? "Submitting…" : "Submit concert"}
        </button>
      </form>
    </section>
  );
}
