"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { FollowedItem } from "../../lib/saved-follows";

export const ALL_FOLLOWED_ARTISTS = "all";

const fieldClass =
  "min-h-12 w-full rounded-full border border-line bg-panel px-4 text-base text-foreground outline-none placeholder:text-mute/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type FollowedArtistSelectProps = {
  artists: FollowedItem[];
  value: string;
  onChange: (value: string) => void;
};

export function FollowedArtistSelect({
  artists,
  value,
  onChange,
}: FollowedArtistSelectProps) {
  const listId = useId();
  const inputId = "upcoming-artist-select";
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filtering, setFiltering] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const options = useMemo(
    () => [
      { value: ALL_FOLLOWED_ARTISTS, label: "All followed artists" },
      ...artists.map((artist) => ({
        value: artist.item_key,
        label: artist.item_label,
      })),
    ],
    [artists],
  );

  const selected =
    options.find((option) => option.value === value) ?? options[0];
  const needle = query.trim().toLowerCase();
  const filtered =
    open && filtering && needle
      ? options.filter((option) => option.label.toLowerCase().includes(needle))
      : options;
  const active = filtered[activeIndex];
  const emptyId = `${listId}-empty`;
  const activeId =
    filtered.length === 0
      ? emptyId
      : active
        ? `${listId}-${active.value}`
        : undefined;

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
        setFiltering(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open, filtering]);

  function close() {
    setOpen(false);
    setQuery("");
    setFiltering(false);
  }

  function selectOption(next: string) {
    onChange(next);
    close();
    inputRef.current?.focus();
  }

  return (
    <div ref={rootRef} className="relative min-w-0 w-full">
      <label
        htmlFor={inputId}
        className="mb-2 block text-sm font-medium text-foreground"
      >
        Followed artists
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-activedescendant={open ? activeId : undefined}
        autoComplete="off"
        spellCheck={false}
        value={open && filtering ? query : selected?.label ?? ""}
        placeholder="Search followed artists"
        onChange={(event) => {
          setQuery(event.target.value);
          setFiltering(true);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
        }}
        onClick={() => {
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (!open) {
              setOpen(true);
              setActiveIndex(0);
              return;
            }
            setActiveIndex((current) =>
              filtered.length === 0
                ? 0
                : Math.min(current + 1, filtered.length - 1),
            );
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) {
              setOpen(true);
              setActiveIndex(0);
              return;
            }
            setActiveIndex((current) => Math.max(current - 1, 0));
          } else if (event.key === "Enter" && open) {
            event.preventDefault();
            if (active) {
              selectOption(active.value);
            }
          } else if (event.key === "Escape") {
            event.preventDefault();
            close();
          }
        }}
        className={`${fieldClass} truncate`}
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Followed artists"
          className="mt-2 max-h-60 w-full overflow-x-hidden overflow-y-auto rounded-3xl border border-line bg-panel p-2"
        >
          {filtered.length === 0 ? (
            <li
              id={emptyId}
              role="option"
              aria-selected="false"
              aria-disabled="true"
              className="px-3 py-3 text-sm text-mute"
            >
              No followed artists match that name.
            </li>
          ) : (
            filtered.map((option, index) => {
              const isActive = index === activeIndex;
              return (
                <li key={option.value} className="min-w-0">
                  <button
                    type="button"
                    id={`${listId}-${option.value}`}
                    role="option"
                    aria-selected={option.value === value}
                    tabIndex={-1}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectOption(option.value);
                    }}
                    className={
                      isActive
                        ? "flex min-h-11 w-full cursor-pointer items-center rounded-full bg-accent/15 px-3 text-left text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        : "flex min-h-11 w-full cursor-pointer items-center rounded-full px-3 text-left text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    }
                  >
                    <span className="truncate">{option.label}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
