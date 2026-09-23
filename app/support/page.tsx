import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "../components/legal-page";
import { SupportEmail } from "../components/support-email";

const title = "Support";
const description =
  "Contact ShowSignal support, fix sign-in and location issues, and delete your account.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title: `${title} · ShowSignal`,
    description,
    type: "website",
    url: "/support",
    siteName: "ShowSignal",
  },
};

export default function SupportPage() {
  return (
    <LegalPage
      eyebrow="ShowSignal"
      title="Support"
      lede="Help for sign-in, saved shows, location, and Ticketmaster links. These pages are public. You do not need an account to read them."
    >
      <LegalSection title="Contact support">
        <SupportEmail />
        <p>
          Include the email on your ShowSignal account, what you were trying to
          do, and whether you are on iOS or Android. Do not send your password.
        </p>
      </LegalSection>

      <LegalSection title="Sign-in">
        <p>
          Permanent accounts use the email and password you created in
          ShowSignal. On Profile, enter that email and password, then sign in.
          If you have only been browsing as a guest, create an account from
          Profile first. Guest activity can move onto the permanent account
          after you sign in.
        </p>
        <p>
          If the password is rejected, use the password reset on Profile and
          open the reset email on the phone where ShowSignal is installed.
          Check the spelling of the email, including the domain.
        </p>
      </LegalSection>

      <LegalSection title="Email verification">
        <p>
          After you create an account or change the email, Supabase sends a
          confirmation message. Open it on the same phone and tap the confirm
          link so it can return to ShowSignal. Look in spam or junk if it does
          not arrive within a few minutes.
        </p>
        <p>
          If the link opens a browser and does not finish, install or update
          ShowSignal, then tap the link again from the phone’s mail app. You
          can request another message from Profile if the first one expired.
        </p>
      </LegalSection>

      <LegalSection title="Location permission">
        <p>
          Nearby shows use your current location or a home area you save on
          Profile. If the system prompt was dismissed, open the phone’s
          Settings, find ShowSignal, and allow location while using the app.
          Then return to Profile and save the home area again.
        </p>
        <p>
          You can skip device location and type a postal code on Profile. That
          still limits discovery to the radius you choose.
        </p>
      </LegalSection>

      <LegalSection title="Saved shows">
        <p>
          Interested and “I’m Going” (Locked) are saved to your account. If a
          show disappears, confirm you are signed in to the same permanent
          account that saved it. Guest saves stay on that device until you
          create or sign in to a permanent account and the guest data is
          merged.
        </p>
        <p>
          Open the show and set the status again if a save did not finish
          because you were offline. Followed artists and venues are separate
          from individual saved concerts.
        </p>
      </LegalSection>

      <LegalSection title="Ticketmaster links">
        <p>
          Ticket links leave ShowSignal and open Ticketmaster, which supplies
          the event information, artwork, venue details, and ticket page.
          ShowSignal does not sell tickets. If a link fails, check your
          connection and try the button again, or search the artist, venue,
          and date on Ticketmaster.
        </p>
      </LegalSection>

      <LegalSection title="Delete your account">
        <p>
          Permanent account deletion is available inside the app. Open Profile,
          choose Delete account, then confirm. This permanently removes the
          account, follows, saved concerts, and “I’m Going” data. It cannot be
          undone. The control stays unavailable until you are signed in to a
          permanent account.
        </p>
        <p>
          If you cannot open the app, email the support address above from the
          inbox on the account and ask for deletion.
        </p>
      </LegalSection>

      <LegalSection title="Privacy">
        <p>
          How ShowSignal handles accounts, location, calendar access, and
          Ticketmaster data is described in the{" "}
          <Link
            href="/privacy"
            className="text-foreground underline decoration-line underline-offset-4 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            privacy policy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
