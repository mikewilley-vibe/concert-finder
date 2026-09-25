# ShowSignal Phase 4: Outdoor-show weather

The first Phase 4 vertical slice adds weather to concerts that a user marks **I'm Going**.

## Current implementation

- `mobile/lib/outdoor.ts` conservatively classifies venue names as outdoor, indoor, or unknown.
- `app/api/v1/weather/route.ts` fetches an hourly forecast from Open-Meteo on the server.
- `mobile/lib/weather.ts` calls the versioned weather endpoint from the app.
- `mobile/components/WeatherCard.tsx` displays temperature, conditions, rain chance, wind, and feels-like temperature.
- The concert detail screen only shows the card for an event marked **I'm Going** and a venue classified as outdoor.

Forecasts are intentionally limited to the next 16 days. Earlier dates show a “coming soon” state rather than pretending a long-range forecast is reliable.

## Before deployment

1. Test a known outdoor venue with coordinates and a start time.
2. Test an indoor venue and confirm no weather card appears.
3. Test a show without venue coordinates and confirm the graceful unavailable state.
4. Test an event more than 16 days away.
5. Add venue overrides for local outdoor venues that Ticketmaster names ambiguously.
6. Add push alerts only after the forecast card is reliable.

The next slice should add venue-level outdoor overrides and a weather summary to the **I'm Going** list. Cancellation, rain-delay, and severe-weather alerts should follow after that.

