import { SUPPORT_EMAIL_PLACEHOLDER } from "@/lib/support-contact";

export function SupportEmail() {
  return (
    <p>
      Email{" "}
      <a
        href={`mailto:${SUPPORT_EMAIL_PLACEHOLDER}`}
        className="inline-flex min-h-11 items-center break-all rounded-md border border-dashed border-accent/70 bg-panel px-2 font-medium text-accent underline decoration-accent/40 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        {SUPPORT_EMAIL_PLACEHOLDER}
      </a>
      . This address is a placeholder for the owner’s support email.
    </p>
  );
}
