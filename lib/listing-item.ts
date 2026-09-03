export type ItemKind = "concert" | "album" | "past" | "venue";

export type ListingItem = {
  id: string;
  kind: ItemKind;
  title: string;
  place: string;
  dateLabel: string;
  month: string;
  day: string;
  weekday: string;
  genre: string;
  note: string;
  details: string;
  published?: boolean;
};

export const kindLabels: Record<ItemKind, string> = {
  concert: "Upcoming concert",
  album: "Album release",
  past: "Past show",
  venue: "Venue nearby",
};
