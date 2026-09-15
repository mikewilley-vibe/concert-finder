import { Alert } from "react-native";

import type { TicketmasterShow } from "./api";
import type { AddToCalendarResult } from "./calendar";
import { openCalendarSettings } from "./calendar";
import { calendarEventTitle } from "./calendar-event";

export function promptAddToCalendar(
  show: TicketmasterShow,
  add: (show: TicketmasterShow) => Promise<AddToCalendarResult>,
) {
  Alert.alert(
    "Add this show to your calendar?",
    calendarEventTitle(show),
    [
      { text: "Not now", style: "cancel" },
      {
        text: "Add to Calendar",
        onPress: () => {
          void add(show).then((result) => {
            if (result.ok) {
              return;
            }
            if (result.code === "no_date") {
              return;
            }
            if (result.code === "denied") {
              Alert.alert("Calendar access is off", result.message, [
                { text: "OK", style: "cancel" },
                {
                  text: "Open Settings",
                  onPress: () => {
                    openCalendarSettings();
                  },
                },
              ]);
              return;
            }
            Alert.alert("Couldn't add to Calendar", result.message);
          });
        },
      },
    ],
  );
}
