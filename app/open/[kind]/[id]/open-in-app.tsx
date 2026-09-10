"use client";

import { useEffect } from "react";

export function OpenInAppButton({
  appLink,
  label,
}: {
  appLink: string;
  label: string;
}) {
  useEffect(() => {
    window.location.assign(appLink);
  }, [appLink]);

  return (
    <a
      href={appLink}
      className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-7 text-base font-semibold text-background"
    >
      Open {label} in ShowSignal
    </a>
  );
}
