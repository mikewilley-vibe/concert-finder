export type ItemKind = "concert" | "album" | "past" | "venue";

export type SampleItem = {
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
};

export const sampleItems: SampleItem[] = [
  {
    id: "big-thief-album",
    kind: "album",
    title: "Big Thief — Double Infinity",
    place: "Album release · streaming everywhere",
    dateLabel: "Fri, Oct 16 · midnight",
    month: "Oct",
    day: "16",
    weekday: "Fri",
    genre: "Folk rock",
    note: "Keep this on your radar even if they are not touring through town yet. First singles have been quiet and guitar-forward.",
    details:
      "Drops at midnight. Built for headphones first. Watch for a tour announcement after the first weekend.",
  },
  {
    id: "national-merriweather",
    kind: "past",
    title: "The National",
    place: "Merriweather Post Pavilion · Columbia, MD",
    dateLabel: "Sat, Aug 15",
    month: "Aug",
    day: "15",
    weekday: "Sat",
    genre: "Indie rock",
    note: "Already in the books — a night to keep in your concert history.",
    details:
      "Played “Fake Empire,” “Bloodbuzz Ohio,” and a long encore with “Vanderlyle Crybaby Geeks.” Saved here as a past show.",
  },
  {
    id: "venue-atlantis",
    kind: "venue",
    title: "The Atlantis",
    place: "1124 U St NW · Washington, DC",
    dateLabel: "This month nearby",
    month: "Sep",
    day: "–",
    weekday: "Now",
    genre: "Indie, punk, experimental",
    note: "A 450-capacity U Street room. Mixed bills, late doors, easy Metro.",
    details:
      "This month’s sample board includes a midweek indie opener and a Saturday punk bill. Doors usually 7:00 PM. U Street Metro.",
  },
];

export const kindLabels: Record<ItemKind, string> = {
  concert: "Upcoming concert",
  album: "Album release",
  past: "Past show",
  venue: "Venue nearby",
};

export const starterFavoriteBands = [
  "Japanese Breakfast",
  "Clairo",
  "Turnstile",
  "Mitski",
  "Smino",
];
