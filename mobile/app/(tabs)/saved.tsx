import { ActionLink } from "@/components/ActionLink";
import { EmptyState } from "@/components/EmptyState";
import { Screen, ScreenBlock } from "@/components/Screen";
import { Body, Eyebrow, Title } from "@/components/Typography";

export default function SavedScreen() {
  return (
    <Screen>
      <ScreenBlock>
        <Eyebrow>Saved</Eyebrow>
        <Title>Shows you kept and people you follow.</Title>
        <Body>
          This tab will hold saved Ticketmaster events plus followed artists
          and venues. Nothing is persisted from the app in this scaffold.
        </Body>
      </ScreenBlock>

      <EmptyState
        title="No saved events"
        body="Save a concert from a detail screen to keep the date, venue, and Ticketmaster link. Saved events will show up here."
        action={
          <ActionLink
            href={{ pathname: "/concert/[id]", params: { id: "preview" } }}
            label="Open concert placeholder"
          />
        }
      />

      <EmptyState
        title="No followed artists or venues"
        body="Follows stay owner-only in Supabase once this tab is connected. Search is the next step."
        action={<ActionLink href="/discover" label="Search to follow later" />}
      />
    </Screen>
  );
}
