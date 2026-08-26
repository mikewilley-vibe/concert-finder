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
    id: "jb-930",
    kind: "concert",
    title: "Japanese Breakfast",
    place: "9:30 Club · Washington, DC",
    dateLabel: "Fri, Sep 11 · 8:00 PM",
    month: "Sep",
    day: "11",
    weekday: "Fri",
    genre: "Indie rock",
    note: "Standing-room night on U Street. Recent setlists open with “Be Sweet,” then “Slide Tackle” and “Paprika.”",
    details:
      "Doors 7:00 PM · Show 8:00 PM · All ages. On this tour, setlist.fm has “Be Sweet” in the first three songs most nights. 815 V St NW, a short walk from the U Street Metro.",
  },
  {
    id: "clairo-anthem",
    kind: "concert",
    title: "Clairo",
    place: "The Anthem · Washington, DC",
    dateLabel: "Wed, Sep 16 · 8:00 PM",
    month: "Sep",
    day: "16",
    weekday: "Wed",
    genre: "Bedroom pop",
    note: "A bigger waterfront room for Charm-era songs. Lately she has closed on “Bags” after a quiet piano run.",
    details:
      "Doors 7:00 PM · Show 8:00 PM · All ages. The Wharf, Washington, DC. Recent sets include “Sexy to Someone,” “Juna,” and “Softly.”",
  },
  {
    id: "turnstile-anthem",
    kind: "concert",
    title: "Turnstile",
    place: "The Anthem · Washington, DC",
    dateLabel: "Sat, Sep 26 · 7:30 PM",
    month: "Sep",
    day: "26",
    weekday: "Sat",
    genre: "Hardcore",
    note: "Weekend waterfront bill. Expect “Holiday,” “Mystery,” and a packed floor for “Blackout.”",
    details:
      "Doors 6:30 PM · Show 7:30 PM · All ages. Recent setlist.fm charts put “Never Enough” early and “Blackout” as a closer.",
  },
  {
    id: "smino-fillmore",
    kind: "concert",
    title: "Smino",
    place: "The Fillmore Silver Spring · Silver Spring, MD",
    dateLabel: "Fri, Oct 2 · 8:00 PM",
    month: "Oct",
    day: "2",
    weekday: "Fri",
    genre: "Hip-hop",
    note: "Standing-room Fillmore night a block from the Metro. Recent sets bounce between “Klink,” “Anita,” and newer singles.",
    details:
      "Doors 7:00 PM · Show 8:00 PM · 18+. 8656 Colesville Rd. Easy Red Line access at Silver Spring station.",
  },
  {
    id: "lucy-dacus-black-cat",
    kind: "concert",
    title: "Lucy Dacus",
    place: "Black Cat · Washington, DC",
    dateLabel: "Thu, Oct 8 · 8:00 PM",
    month: "Oct",
    day: "8",
    weekday: "Thu",
    genre: "Indie folk",
    note: "A quieter 14th Street room. “Night Shift” and “Hot & Heavy” have been mid-set anchors, with a short piano encore.",
    details:
      "Doors 7:00 PM · Show 8:00 PM · 18+. 1811 14th St NW. Recent sets lean on Home Video, with “Triple Dog Dare” late.",
  },
  {
    id: "mitski-wolf-trap",
    kind: "concert",
    title: "Mitski",
    place: "Filene Center at Wolf Trap · Vienna, VA",
    dateLabel: "Sat, Oct 17 · 7:30 PM",
    month: "Oct",
    day: "17",
    weekday: "Sat",
    genre: "Art pop",
    note: "Outdoor amphitheater. Recent shows open with “Everyone” and close on “A Pearl,” with “My Love Mine All Mine” mid-set.",
    details:
      "Gates 6:00 PM · Show 7:30 PM · All ages. Lawn and pavilion seating. Plan extra time for parking or the metro shuttle.",
  },
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
