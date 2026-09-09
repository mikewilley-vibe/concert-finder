export function newShowPushCopy({
  itemType,
  itemLabel,
  count,
}: {
  itemType: "ticketmaster_attraction" | "ticketmaster_venue";
  itemLabel: string;
  count: number;
}) {
  const n = Math.max(1, Math.trunc(count));
  const name = itemLabel.trim() || "a follow";
  const body = "Open Local Shows to see them on Home.";

  if (itemType === "ticketmaster_venue") {
    return {
      title: n === 1 ? `New date at ${name}` : `${n} new dates at ${name}`,
      body,
    };
  }

  return {
    title: n === 1 ? `New ${name} date` : `${n} new ${name} dates`,
    body,
  };
}
