import type {
  TicketmasterAttraction,
  TicketmasterShow,
  TicketmasterVenue,
} from "./ticketmaster";

export function legacyAttraction(attraction: TicketmasterAttraction) {
  return {
    id: attraction.id,
    name: attraction.name,
    ...(attraction.imageUrl ? { image: attraction.imageUrl } : {}),
  };
}

export function legacyVenue(venue: TicketmasterVenue) {
  return {
    id: venue.id,
    name: venue.name,
    ...(venue.city ? { city: venue.city } : {}),
    ...(venue.state ? { state: venue.state } : {}),
  };
}

export function legacyShow(show: TicketmasterShow) {
  return {
    id: show.id,
    name: show.name,
    dateLabel: show.dateLabel,
    ...(show.timeLabel ? { timeLabel: show.timeLabel } : {}),
    venueName: show.venue.name,
    city: show.venue.city ?? "",
    state: show.venue.stateCode ?? show.venue.state ?? "",
    ...(show.ticketUrl ? { url: show.ticketUrl } : {}),
    ...(show.imageUrl ? { image: show.imageUrl } : {}),
    matchedLabels: show.matchedLabels,
  };
}
