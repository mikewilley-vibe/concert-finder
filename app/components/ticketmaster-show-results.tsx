"use client";

export type ShowResult = {
  id: string;
  name: string;
  dateLabel: string;
  timeLabel?: string;
  venueName: string;
  city: string;
  state: string;
  url?: string;
  image?: string;
  matchedLabels: string[];
};

export type UpcomingShowsRequest = {
  attractions?: { id: string; label: string }[];
  venues?: { id: string; label: string }[];
  postalCode?: string;
};

export function showsMessage(status: number, fallback: string) {
  if (status === 400) {
    return fallback || "Follow an artist or venue first.";
  }
  if (status === 429) {
    return "Ticketmaster is receiving too many requests right now. Try again shortly.";
  }
  if (status === 401) {
    return fallback || "Ticketmaster search is not set up correctly.";
  }
  if (status === 500 || status === 502) {
    return fallback || "There was a problem reaching Ticketmaster.";
  }
  return fallback || "There was a problem reaching Ticketmaster.";
}

export async function fetchUpcomingShows(
  body: UpcomingShowsRequest,
  signal?: AbortSignal,
) {
  const payload: UpcomingShowsRequest = {
    attractions: body.attractions ?? [],
    venues: body.venues ?? [],
  };
  const postalCode = body.postalCode?.trim();
  if (postalCode) {
    payload.postalCode = postalCode;
  }

  const response = await fetch("/api/ticketmaster/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as {
    shows?: ShowResult[];
    error?: string;
  };

  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      error: showsMessage(response.status, data.error ?? ""),
    };
  }

  return { ok: true as const, shows: data.shows ?? [] };
}

export async function fetchEventDetails(ids: string[], signal?: AbortSignal) {
  const params = new URLSearchParams({ ids: ids.join(",") });
  const response = await fetch(`/api/ticketmaster/event-details?${params}`, {
    method: "GET",
    signal,
  });
  const data = (await response.json()) as {
    shows?: ShowResult[];
    error?: string;
  };

  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      error: showsMessage(response.status, data.error ?? ""),
    };
  }

  return { ok: true as const, shows: data.shows ?? [] };
}

function placeLabel(show: ShowResult) {
  return [show.city, show.state].filter(Boolean).join(", ");
}

export function TicketmasterShowCard({ show }: { show: ShowResult }) {
  const place = placeLabel(show);

  return (
    <li className="flex flex-col rounded-3xl border border-line bg-panel p-4 shadow-[0_12px_32px_rgba(0,0,0,0.32)] sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
        {show.matchedLabels.join(" · ")}
      </p>
      <h3 className="mt-2 font-display text-xl leading-tight tracking-tight">
        {show.matchedLabels[0] || show.name}
      </h3>
      {show.name && show.name !== show.matchedLabels[0] ? (
        <p className="mt-1 text-sm text-mute">{show.name}</p>
      ) : null}
      <p className="mt-2 text-sm text-accent">
        {show.dateLabel}
        {show.timeLabel ? ` · ${show.timeLabel}` : ""}
      </p>
      {show.venueName ? (
        <p className="mt-1 text-sm text-foreground">{show.venueName}</p>
      ) : null}
      {place ? <p className="mt-0.5 text-sm text-mute">{place}</p> : null}
      {show.url ? (
        <a
          href={show.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex min-h-11 w-fit items-center rounded-full border border-line px-4 text-sm font-semibold text-foreground transition-colors hover:bg-panel-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          View on Ticketmaster
        </a>
      ) : null}
    </li>
  );
}

export function TicketmasterShowResults({
  pending,
  error,
  shows,
  heading,
  emptyMessage,
  emptyHint,
  onSearchWithoutZip,
}: {
  pending: boolean;
  error: string | null;
  shows: ShowResult[] | null;
  heading?: string;
  emptyMessage: string;
  emptyHint?: string;
  onSearchWithoutZip?: () => void;
}) {
  if (error) {
    return (
      <p
        className="mt-5 max-w-xl rounded-2xl border border-line bg-panel px-4 py-3 text-sm leading-6 text-mute"
        role="alert"
      >
        {error}
      </p>
    );
  }

  if (pending) {
    return <p className="mt-5 text-sm text-mute">Loading shows...</p>;
  }

  if (!shows) {
    return null;
  }

  if (shows.length === 0) {
    return (
      <div className="mt-5 max-w-xl">
        <p className="text-sm leading-6 text-mute">{emptyMessage}</p>
        {emptyHint ? (
          <p className="mt-2 text-sm leading-6 text-mute">{emptyHint}</p>
        ) : null}
        {onSearchWithoutZip ? (
          <button
            type="button"
            onClick={onSearchWithoutZip}
            className="mt-3 inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-semibold text-foreground transition-colors hover:bg-panel-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            Search without ZIP
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-6">
      {heading ? (
        <p className="mb-4 max-w-xl text-sm font-medium leading-6 text-foreground sm:text-base">
          {heading}
        </p>
      ) : null}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shows.map((show) => (
          <TicketmasterShowCard key={show.id} show={show} />
        ))}
      </ul>
    </div>
  );
}
