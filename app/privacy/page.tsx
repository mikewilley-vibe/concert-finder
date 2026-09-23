import type { Metadata } from "next";
import { LegalPage, LegalSection } from "../components/legal-page";
import { SupportEmail } from "../components/support-email";

const title = "Privacy";
const description =
  "How ShowSignal uses Supabase accounts, saved concerts, location, calendar access, and Ticketmaster event data.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title: `${title} · ShowSignal`,
    description,
    type: "website",
    url: "/privacy",
    siteName: "ShowSignal",
  },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="ShowSignal"
      title="Privacy"
      lede="ShowSignal is a concert tracker. This page describes the account and device data the app uses so you can follow artists, save shows, and get to tickets."
    >
      <LegalSection title="Accounts">
        <p>
          Sign-in is handled by Supabase Authentication. A permanent account
          stores the email address you provide and a Supabase user ID. Passwords
          are managed by Supabase and are not stored in ShowSignal’s own
          tables. You can also use the app as a guest. Guest activity is tied
          to an anonymous Supabase user ID until you create or sign in to a
          permanent account, at which point that activity can be moved onto
          the permanent account.
        </p>
        <p>
          Email confirmation and password-reset messages are sent through
          Supabase. Those messages include a link back to ShowSignal so you
          can finish verifying the address or setting a password.
        </p>
      </LegalSection>

      <LegalSection title="What we store with your account">
        <p>
          <span className="text-foreground">Email address and user ID.</span>{" "}
          The email identifies a permanent account. The user ID is the key that
          ties your follows, saved concerts, and notification settings to that
          account.
        </p>
        <p>
          <span className="text-foreground">Follows.</span> When you follow an
          artist or venue, ShowSignal stores that choice with your user ID,
          including the Ticketmaster artist or venue identifier and the name
          shown in the app.
        </p>
        <p>
          <span className="text-foreground">Saved concerts.</span> Saved shows
          keep a snapshot of the concert: name, date and time, venue, city,
          artwork URL, ticket link, and related event details, along with your
          user ID.
        </p>
        <p>
          <span className="text-foreground">“I’m Going” data.</span> Each saved
          concert has an attendance status. “I’m Going” (shown in the app as
          Locked) means you plan to attend. Interested is the other status.
          That choice is stored with the saved concert.
        </p>
        <p>
          <span className="text-foreground">Location.</span> If you allow
          location access, ShowSignal reads your device location to find nearby
          concerts and can keep a home area (postal code, place label, and
          approximate coordinates) on the device. A postal code or coordinates
          may be sent with a show search so results can be limited to your
          area. You can enter a postal code instead of granting location
          permission.
        </p>
        <p>
          <span className="text-foreground">Calendar access.</span> If you add
          a show to your calendar, ShowSignal asks the device for calendar
          permission and creates an event in the calendar you choose. The app
          stores that you added it, which calendar provider was used, and the
          calendar event identifier so it does not create a duplicate. ShowSignal
          does not read the rest of your calendar.
        </p>
        <p>
          <span className="text-foreground">Push notification tokens.</span> If
          you turn on alerts for a permanent account, ShowSignal stores an Expo
          push token, the platform (iOS or Android), and whether alerts are
          enabled, tied to your user ID. That token is used to send a
          notification when a followed artist or venue has a new date. Turning
          alerts off stops those messages.
        </p>
      </LegalSection>

      <LegalSection title="Ticketmaster">
        <p>
          Ticketmaster supplies event information, artwork, venue details, and
          ticket links. ShowSignal requests that information to show concerts
          and to open a Ticketmaster page when you want tickets. ShowSignal
          does not sell tickets and does not receive your Ticketmaster account
          or payment details.
        </p>
      </LegalSection>

      <LegalSection title="Selling and advertising">
        <p>
          ShowSignal does not sell personal information. ShowSignal does not
          use advertising tracking.
        </p>
      </LegalSection>

      <LegalSection title="Account deletion">
        <p>
          You can request permanent account deletion from inside the app. On
          the Profile screen, choose Delete account and confirm. That removes
          the Supabase account and the data stored with it, including follows,
          saved concerts, “I’m Going” status, and push notification tokens.
          Deletion is permanent and cannot be undone. Guest mode is not a
          permanent account; sign in first if you need to delete one.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <SupportEmail />
        <p>Effective date: September 22, 2026.</p>
      </LegalSection>
    </LegalPage>
  );
}
