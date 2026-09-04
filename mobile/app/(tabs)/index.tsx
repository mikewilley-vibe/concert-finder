import { Screen, ScreenBlock } from "@/components/Screen";
import { ActionLink } from "@/components/ActionLink";
import { EmptyState } from "@/components/EmptyState";
import { Body, Eyebrow, Title } from "@/components/Typography";

export default function HomeScreen() {
  return (
    <Screen>
      <ScreenBlock>
        <Eyebrow>Local Shows</Eyebrow>
        <Title>New announcements and nights you follow.</Title>
        <Body>
          Home will list new-show alerts and upcoming Ticketmaster concerts
          from artists and venues you follow. Follows and saves are not wired
          into this first scaffold yet.
        </Body>
      </ScreenBlock>

      <EmptyState
        title="No new announcements yet"
        body="When automatic tracking is connected, newly found shows will land here so you can mark them as seen."
        action={<ActionLink href="/discover" label="Find artists and venues" />}
      />

      <EmptyState
        title="No upcoming shows yet"
        body="Upcoming dates for followed artists and venues will appear in this list. Open a concert from here — it will not expand inside the feed."
        action={
          <ActionLink
            href={{ pathname: "/concert/[id]", params: { id: "preview" } }}
            label="Preview a concert screen"
          />
        }
      />
    </Screen>
  );
}
