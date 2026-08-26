"use client";

import { FormEvent, useEffect, useState } from "react";
import { starterFavoriteBands } from "../../data/sample-items";

const storageKey = "my-shows-favorite-bands";

export function FavoriteBands() {
  const [bands, setBands] = useState<string[]>(starterFavoriteBands);
  const [name, setName] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as unknown;
        if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
          setBands(parsed);
        }
      } catch {
        // Keep the starter list if saved data is unreadable.
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(bands));
  }, [bands, ready]);

  function addBand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = name.trim();
    if (!next) {
      return;
    }
    const alreadySaved = bands.some(
      (band) => band.toLowerCase() === next.toLowerCase(),
    );
    if (alreadySaved) {
      setName("");
      return;
    }
    setBands((current) => [...current, next]);
    setName("");
  }

  return (
    <section id="favorite-bands" className="scroll-mt-24">
      <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
        Your favorite bands
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-mute sm:text-base">
        Add the artists you care about. They stay on this device so you can
        come back to them.
      </p>

      <form
        onSubmit={addBand}
        className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-stretch"
      >
        <label className="sr-only" htmlFor="favorite-band-name">
          Band name
        </label>
        <input
          id="favorite-band-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Add a band, like Big Thief"
          autoComplete="off"
          enterKeyHint="done"
          className="min-h-12 w-full rounded-full border border-line bg-panel px-4 text-base text-foreground outline-none placeholder:text-mute/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        <button
          type="submit"
          className="inline-flex min-h-12 w-full shrink-0 touch-manipulation items-center justify-center rounded-full bg-accent px-6 text-base font-semibold text-background transition-colors hover:bg-accent-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:w-auto"
        >
          Add band
        </button>
      </form>

      {bands.length > 0 ? (
        <ul className="mt-5 flex flex-wrap gap-2">
          {bands.map((band) => (
            <li
              key={band}
              className="rounded-full border border-line bg-panel px-3.5 py-2 text-sm"
            >
              {band}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-sm text-mute">No favorite bands yet. Add one above.</p>
      )}
    </section>
  );
}
