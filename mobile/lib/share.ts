import { Share } from "react-native";

import type { TicketmasterShow } from "./api";
import { websiteUrl } from "./config";
import { concertShareText, listingShareText } from "./share-copy";

function websiteOrigin() {
  return websiteUrl("/").replace(/\/$/, "");
}

export async function shareConcert(show: TicketmasterShow) {
  await Share.share({
    title: show.name,
    message: concertShareText(show, websiteOrigin()),
  });
}

export async function shareListing(
  kind: "artist" | "venue",
  name: string,
  id: string,
) {
  const message = listingShareText(kind, name, id, websiteOrigin());
  await Share.share({
    title: name.trim() || (kind === "artist" ? "Artist" : "Venue"),
    message,
  });
}
