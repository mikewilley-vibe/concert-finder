import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";

import { ActionLink } from "@/components/ActionLink";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { LoadingBlock } from "@/components/LoadingBlock";
import { Screen, ScreenBlock } from "@/components/Screen";
import { ShowRow } from "@/components/ShowRow";
import { Body, Eyebrow, Strong, Title } from "@/components/Typography";
import { useFollows } from "@/hooks/useFollows";
import { useFavoritesOnboarding } from "@/hooks/useFavoritesOnboarding";
import { useHomeLocation } from "@/hooks/useHomeLocation";
import { useInteractionSignals } from "@/hooks/useInteractionSignals";
import { useSavedEvents } from "@/hooks/useSavedEvents";
import { apiErrorMessage, type TicketmasterShow } from "@/lib/api";
import { favoritesProgress } from "@/lib/favorites-progress";
import {
  HOME_NEAR_YOU_LIMIT,
  buildHomeFeed,
  favoriteIdsFromFollows,
  homeArtistKicker,
  homeShowMeta,
  previewYourArtists,
  type HomeCard,
} from "@/lib/home-feed";
import { rememberHomeFeed } from "@/lib/home-feed-cache";
import {
  clearHomeEventSetsCache,
  loadHomeEventSets,
  type HomeEventSets,
} from "@/lib/home-events";
import {
  activeOrigin,
  hasActiveSearchLocation,
  radiusLine,
  showingNearLine,
} from "@/lib/home-location";

type SetsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; sets: HomeEventSets };

function HomeShowCard({
  card,
  saved,
  pending,
  onToggle,
  onOpen,
  kicker,
}: {
  card: HomeCard;
  saved: boolean;
  pending: boolean;
  onToggle: (show: TicketmasterShow) => void;
  onOpen: (show: TicketmasterShow) => void;
  kicker?: string;
}) {
  return (
    <ShowRow
      show={card.show}
      kicker={kicker ?? card.scanDate}
      subtitle={homeShowMeta(card)}
      onOpen={() => onOpen(card.show)}
      trailing={
        <Button
          label={saved ? "Saved" : "Save"}
          variant={saved ? "secondary" : "action"}
          disabled={pending}
          accessibilityLabel={
            saved
              ? `Remove ${card.show.name} from saved`
              : `Save ${card.show.name}`
          }
          onPress={() => onToggle(card.show)}
        />
      }
    />
  );
}

export default function HomeScreen() {
  const follows = useFollows();
  const saved = useSavedEvents();
  const home = useHomeLocation();
  const onboarding = useFavoritesOnboarding();
  const interactions = useInteractionSignals();
  const [setsState, setSetsState] = useState<SetsState>({ status: "loading" });
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [locationReady, setLocationReady] = useState(false);
  const requestId = useRef(0);
  const progress = favoritesProgress(
    follows.artists.length,
    follows.venues.length,
  );

  const loadSets = useCallback(async () => {
    if (!follows.ready || !home.ready) {
      return;
    }

    const nextRequest = requestId.current + 1;
    requestId.current = nextRequest;
    setSetsState({ status: "loading" });
    try {
      const sets = await loadHomeEventSets({
        location: home.location,
        artists: follows.artists,
        venues: follows.venues,
      });
      if (requestId.current !== nextRequest) {
        return;
      }
      setSetsState({ status: "ready", sets });
    } catch (error) {
      if (requestId.current !== nextRequest) {
        return;
      }
      setSetsState({
        status: "error",
        message: apiErrorMessage(
          error,
          "Could not load nearby shows. Try again.",
        ),
      });
    }
  }, [follows.artists, follows.ready, follows.venues, home.location, home.ready]);

  useEffect(() => {
    if (!home.ready) {
      return;
    }
    let cancelled = false;
    void home.bootstrapCurrent().then((result) => {
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        setLocationNotice(result.message);
      }
      setLocationReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [home.bootstrapCurrent, home.ready]);

  useEffect(() => {
    if (!locationReady) {
      return;
    }
    const timer = setTimeout(() => {
      void loadSets();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadSets, locationReady]);

  const feed = useMemo(() => {
    if (setsState.status !== "ready") {
      return null;
    }
    const next = buildHomeFeed({
      nearbyShows: setsState.sets.nearby,
      followedShows: setsState.sets.followed,
      favorites: favoriteIdsFromFollows(follows.artists, follows.venues),
      origin: activeOrigin(home.location),
      radiusMiles: home.location.radiusMiles,
      signals: interactions.signals,
    });
    rememberHomeFeed(next);
    return next;
  }, [
    follows.artists,
    follows.venues,
    home.location,
    interactions.signals,
    setsState,
  ]);

  function retry() {
    clearHomeEventSetsCache();
    void loadSets();
  }

  function onOpenShow(show: TicketmasterShow) {
    void interactions.track({
      kind: "tap",
      eventId: show.id,
      artistIds: show.attractions.map((artist) => artist.id),
      venueId: show.venueId,
    });
  }

  function onToggleSaved(show: TicketmasterShow) {
    const wasSaved = saved.savedIds.has(show.id);
    void saved.toggleSaved(show);
    void interactions.track({
      kind: wasSaved ? "unsave" : "save",
      eventId: show.id,
      artistIds: show.attractions.map((artist) => artist.id),
      venueId: show.venueId,
    });
  }

  const nearYou = feed?.nearYou.slice(0, HOME_NEAR_YOU_LIMIT) ?? [];
  const yourArtists = feed ? previewYourArtists(feed.yourArtists) : [];
  const showOnboarding = onboarding.ready && !progress.complete;
  const showFullOnboarding = showOnboarding && !onboarding.dismissed;
  const loading =
    !follows.ready || !home.ready || !locationReady || setsState.status === "loading";

  return (
    <Screen>
      <ScreenBlock>
        <Eyebrow>ShowSignal</Eyebrow>
        <Title>{showingNearLine(home.location)}</Title>
        <Body>{radiusLine(home.location)}</Body>
        {locationNotice ? <Body>{locationNotice}</Body> : null}
        <ActionLink
          href="/profile"
          label="Change location"
          accessibilityLabel="Change location in Profile"
        />
      </ScreenBlock>

      {showFullOnboarding ? (
        <EmptyState
          title="Make ShowSignal yours"
          body={`ShowSignal gets better once it knows what you like. Spend a few minutes adding favorites — artists you love and rooms you already go to. ${progress.artistLabel}. ${progress.venueLabel}.`}
          action={
            <View style={{ gap: 8 }}>
              <ActionLink
                href="/discover"
                label="Add favorites"
                accessibilityLabel="Add favorite artists and venues"
              />
              <Button
                label="Not now"
                variant="secondary"
                onPress={() => {
                  void onboarding.dismiss();
                }}
              />
            </View>
          }
        />
      ) : showOnboarding ? (
        <EmptyState
          title="A few more favorites help"
          body={`${progress.artistLabel}. ${progress.venueLabel}. Home gets sharper as you add them.`}
          action={
            <ActionLink
              href="/discover"
              label="Add favorites"
              accessibilityLabel="Add favorite artists and venues"
            />
          }
        />
      ) : null}

      {follows.error ? (
        <EmptyState title="Follows didn’t load" body={follows.error} />
      ) : null}
      {saved.error ? <EmptyState title="Saved shows" body={saved.error} /> : null}

      {loading ? <LoadingBlock label="Loading shows near you…" /> : null}

      {setsState.status === "error" ? (
        <EmptyState
          title="Shows didn’t load"
          body={setsState.message}
          action={
            <Button
              label="Try again"
              onPress={() => {
                retry();
              }}
            />
          }
        />
      ) : null}

      {feed?.radar ? (
        <ScreenBlock>
          <Strong>On Your Radar</Strong>
          <Body>A favorite artist has a strong upcoming show nearby.</Body>
          <HomeShowCard
            card={feed.radar}
            saved={saved.savedIds.has(feed.radar.show.id)}
            pending={saved.isPending(feed.radar.show.id)}
            onToggle={onToggleSaved}
            onOpen={onOpenShow}
          />
        </ScreenBlock>
      ) : null}

      {setsState.status === "ready" && feed ? (
        <ScreenBlock>
          <Strong>Near You This Week</Strong>
          <Body>
            Live music within {home.location.radiusMiles} miles over the next 7
            days.
          </Body>
          {nearYou.map((card) => (
            <HomeShowCard
              key={card.show.id}
              card={card}
              saved={saved.savedIds.has(card.show.id)}
              pending={saved.isPending(card.show.id)}
              onToggle={onToggleSaved}
              onOpen={onOpenShow}
            />
          ))}
          {nearYou.length === 0 ? (
            <EmptyState
              title="Nothing nearby this week"
              body={
                hasActiveSearchLocation(home.location)
                  ? "No shows turned up in the next 7 days for this area. Try a wider radius in Profile, or add favorites so Home can watch your artists."
                  : "Turn on location or set a home area in Profile to see what’s playing nearby this week."
              }
              action={
                <ActionLink
                  href="/profile"
                  label="Set location"
                  accessibilityLabel="Set location in Profile"
                />
              }
            />
          ) : null}
          {feed.nearYouTotal > HOME_NEAR_YOU_LIMIT ? (
            <ActionLink
              href="/nearby"
              label="See all nearby this week"
              accessibilityLabel="See all nearby shows this week"
            />
          ) : null}
        </ScreenBlock>
      ) : null}

      {setsState.status === "ready" && feed ? (
        <ScreenBlock>
          <Strong>Your Artists Coming Up</Strong>
          <Body>
            The next two upcoming shows for each artist you follow, in any
            city.
          </Body>
          {yourArtists.map((card) => (
            <HomeShowCard
              key={`${card.artistId ?? "artist"}:${card.show.id}`}
              card={card}
              kicker={homeArtistKicker(card)}
              saved={saved.savedIds.has(card.show.id)}
              pending={saved.isPending(card.show.id)}
              onToggle={onToggleSaved}
              onOpen={onOpenShow}
            />
          ))}
          {follows.artists.length === 0 ? (
            <EmptyState
              title="Make ShowSignal yours"
              body={`Follow artists you already love and Home will surface their next dates, wherever they play. ${progress.artistLabel}. ${progress.venueLabel}.`}
              action={
                <ActionLink
                  href="/discover"
                  label="Add favorites"
                  accessibilityLabel="Add favorite artists and venues"
                />
              }
            />
          ) : yourArtists.length === 0 ? (
            <EmptyState
              title="No upcoming artist dates"
              body="Nothing on the calendar yet for the artists you follow. Follow another artist, or check back soon."
              action={
                <ActionLink
                  href="/discover"
                  label="Find artists"
                  accessibilityLabel="Find artists to follow"
                />
              }
            />
          ) : null}
          {feed.yourArtistsTotal > yourArtists.length ? (
            <ActionLink
              href="/your-artists"
              label="See all upcoming artists"
              accessibilityLabel="See all upcoming shows from your artists"
            />
          ) : null}
        </ScreenBlock>
      ) : null}
    </Screen>
  );
}
