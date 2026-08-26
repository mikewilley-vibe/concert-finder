"use client";

import { useState } from "react";
import { sampleItems } from "../../data/sample-items";
import { ShowCard } from "./show-card";

export function ShowList() {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? sampleItems.filter((item) => {
        const band = item.title.toLowerCase();
        const venue = item.place.toLowerCase();
        return band.includes(needle) || venue.includes(needle);
      })
    : sampleItems;

  const trimmedQuery = query.trim();
  const resultLabel = needle
    ? `${matches.length} matching ${matches.length === 1 ? "show" : "shows"} for “${trimmedQuery}”`
    : `${sampleItems.length} sample shows`;

  return (
    <section id="whats-coming" className="scroll-mt-24">
      <div className="mb-6 flex flex-col gap-2 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
            A peek at your music week
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-mute sm:text-base">
            Sample listings for the D.C. area — upcoming concerts, an album
            drop, a past night out, and a venue nearby.
          </p>
        </div>
        <p className="text-sm text-mute">{resultLabel}</p>
      </div>

      <label
        htmlFor="search-concerts"
        className="mb-2 block text-sm font-medium text-foreground"
      >
        Search concerts
      </label>
      <input
        id="search-concerts"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Type a band or venue, like The Anthem"
        autoComplete="off"
        className="mb-5 min-h-12 w-full rounded-full border border-line bg-panel px-4 text-base text-foreground outline-none placeholder:text-mute/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />

      {matches.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {matches.map((item) => (
            <ShowCard key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-line bg-panel px-4 py-6 text-sm leading-6 text-mute sm:text-base">
          No shows match “{trimmedQuery}”. Try another band or venue name.
        </p>
      )}
    </section>
  );
}
