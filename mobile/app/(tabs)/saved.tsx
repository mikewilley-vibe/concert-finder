import { ActionLink } from "@/components/ActionLink";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { GoingButton } from "@/components/GoingButton";
import { LoadingBlock } from "@/components/LoadingBlock";
import { Screen, ScreenBlock } from "@/components/Screen";
import { ShowRow } from "@/components/ShowRow";
import { Body, Eyebrow, Strong, Title } from "@/components/Typography";
import { useSavedEvents } from "@/hooks/useSavedEvents";

export default function SavedScreen() {
  const saved = useSavedEvents();
  const loading = !saved.ready;
  const hasShows =
    saved.goingShows.length > 0 || saved.interestedShows.length > 0;

  return (
    <Screen>
      <ScreenBlock>
        <Eyebrow>Locked</Eyebrow>
        <Title>Your concert plans, all together.</Title>
        <Body>
          Shows you’ve locked in, plus the ones you’re still considering.
        </Body>
      </ScreenBlock>

      {loading ? <LoadingBlock label="Loading your shows…" /> : null}

      {saved.error ? (
        <EmptyState
          title="Shows didn’t load"
          body={saved.error}
          action={
            <Button
              label="Try again"
              onPress={() => {
                void saved.refresh();
              }}
            />
          }
        />
      ) : null}

      {!loading && !hasShows ? (
        <EmptyState
          title="Nothing locked yet"
          body="Tap Lock me in or Interested on a concert to keep it here."
          action={
            <ActionLink
              href="/discover"
              label="Find concerts"
              accessibilityLabel="Find concerts through artists and venues"
            />
          }
        />
      ) : null}

      {saved.goingShows.length > 0 ? (
        <ScreenBlock>
          <Strong>Locked</Strong>
          {saved.goingShows.map((show) => (
            <ShowRow
              key={show.id}
              show={show}
              kicker="✓ Locked"
              trailing={
                <GoingButton
                  going
                  pending={saved.isPending(show.id)}
                  name={show.name}
                  onPress={() => {
                    void saved.tapStatus(show, "going");
                  }}
                />
              }
            />
          ))}
        </ScreenBlock>
      ) : null}

      {saved.interestedShows.length > 0 ? (
        <ScreenBlock>
          <Strong>Interested</Strong>
          {saved.interestedShows.map((show) => (
            <ShowRow
              key={show.id}
              show={show}
              kicker="♡ Interested"
              trailing={
                <Button
                  label="♡ Interested"
                  variant="secondary"
                  disabled={saved.isPending(show.id)}
                  accessibilityLabel={`Clear interested for ${show.name}`}
                  onPress={() => {
                    void saved.tapStatus(show, "interested");
                  }}
                />
              }
            />
          ))}
        </ScreenBlock>
      ) : null}
    </Screen>
  );
}
