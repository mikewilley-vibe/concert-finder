import {
  findNewEventIds,
} from "../lib/find-new-event-ids";

const known = ["A", "B"];
const current = ["A", "B", "C"];
const discovered = findNewEventIds(known, current);

for (const id of discovered) {
  console.log(`NEW EVENT DETECTED: ${id}`);
}

const duplicates = findNewEventIds(["A", "A"], ["A", "B", "B", "C", "C"]);
const again = findNewEventIds(["A", "B"], ["A", "B", "C"]);
const sameOrder =
  JSON.stringify(duplicates) === JSON.stringify(["B", "C"]) &&
  JSON.stringify(again) === JSON.stringify(discovered);

if (!sameOrder) {
  process.exitCode = 1;
}
