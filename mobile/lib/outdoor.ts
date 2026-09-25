import type { TicketmasterShow } from "./api";

export type VenueSetting = "outdoor" | "indoor" | "unknown";

const OUTDOOR_TERMS = [
  "amphitheater",
  "amphitheatre",
  "ballpark",
  "bowl",
  "fairgrounds",
  "festival grounds",
  "lawn",
  "park",
  "pavilion",
  "raceway",
  "stadium",
  "waterfront",
  "outdoor",
];

const INDOOR_TERMS = [
  "arena",
  "club",
  "hall",
  "theater",
  "theatre",
  "center",
  "centre",
  "church",
  "warehouse",
  "annex",
  "bar",
  "restaurant",
];

export function classifyVenue(venueName: string | undefined): VenueSetting {
  const normalized = venueName?.trim().toLowerCase() ?? "";
  if (!normalized) return "unknown";
  if (OUTDOOR_TERMS.some((term) => normalized.includes(term))) return "outdoor";
  if (INDOOR_TERMS.some((term) => normalized.includes(term))) return "indoor";
  return "unknown";
}

export function classifyShowVenue(show: TicketmasterShow): VenueSetting {
  return classifyVenue(show.venueName);
}

