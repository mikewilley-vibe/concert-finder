import type { Metadata } from "next";
import { AccountScreen } from "../components/account-screen";
import { SiteHeader } from "../components/site-header";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AccountPage() {
  return (
    <div className="relative flex flex-1 flex-col overflow-x-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[20rem] bg-[radial-gradient(ellipse_at_top,_rgba(216,255,62,0.16),_transparent_58%)] sm:h-[28rem]"
      />
      <SiteHeader />
      <AccountScreen />
      <footer className="relative z-10 border-t border-line pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <p className="mx-auto max-w-6xl px-4 py-6 text-sm text-mute sm:px-8">
          My Shows · Listings include example cards. Alerts and calendar sync
          can come later. This app does not sell tickets.
        </p>
      </footer>
    </div>
  );
}
