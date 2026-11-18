import catalogue from "../constants/timezones.json";

const aliases: Record<string, string> = {
  "Asia/Jakarta": "Indonesia Java WIB",
  "Asia/Makassar": "Indonesia Bali WITA",
  "Asia/Jayapura": "Indonesia Papua WIT",
  "Asia/Shanghai": "China Beijing Peking",
  "Asia/Kolkata": "India Mumbai Delhi Calcutta",
  "Asia/Calcutta": "India Mumbai Delhi Kolkata",
  "Asia/Kathmandu": "Nepal Katmandu",
  "Asia/Katmandu": "Nepal Kathmandu",
  "Asia/Tokyo": "Japan Osaka",
  "Asia/Dubai": "UAE Abu Dhabi",
  "Europe/London": "UK Britain England United Kingdom",
  "Europe/Kyiv": "Ukraine Kiev",
  "Europe/Kiev": "Ukraine Kyiv",
  "America/New_York": "US USA United States NYC Eastern Boston Washington",
  "America/Chicago": "US USA United States Central Dallas",
  "America/Denver": "US USA United States Mountain",
  "America/Los_Angeles": "US USA United States Pacific San Francisco Seattle",
  "America/Toronto": "Canada Ottawa",
  "Australia/Sydney": "Australia Canberra",
  "Pacific/Auckland": "New Zealand Wellington",
  UTC: "GMT Greenwich coordinated universal time",
};
const normalize = (value: string) =>
  value.toLowerCase().replaceAll(/[_/]/g, " ");
export function timezoneCatalogue(current?: string): string[] {
  let runtime: string[] = [];
  try {
    runtime =
      (
        Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }
      ).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    /* Hermes may omit this API; the bundled catalogue remains complete. */
  }
  return [
    ...new Set([...catalogue.zones, ...runtime, ...(current ? [current] : [])]),
  ].sort();
}
export function searchTimezones(zones: string[], query: string) {
  const words = normalize(query.trim()).split(/\s+/);
  return zones.filter((zone) => {
    const text = normalize(zone + " " + (aliases[zone] ?? ""));
    return words.every((word) => text.includes(word));
  });
}
export function timezoneOffset(zone: string, date = new Date()): string {
  try {
    return (
      new Intl.DateTimeFormat("en", {
        timeZone: zone,
        timeZoneName: "shortOffset",
      })
        .formatToParts(date)
        .find((part) => part.type === "timeZoneName")?.value ?? ""
    );
  } catch {
    try {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }).formatToParts(date);
      const part = (name: Intl.DateTimeFormatPartTypes) =>
        Number(parts.find((p) => p.type === name)?.value);
      const local = Date.UTC(
        part("year"),
        part("month") - 1,
        part("day"),
        part("hour"),
        part("minute"),
        part("second"),
      );
      const minutes = Math.round((local - date.getTime()) / 60000);
      if (!Number.isFinite(minutes)) return "Offset unavailable";
      return minutes === 0
        ? "GMT"
        : `GMT${minutes < 0 ? "-" : "+"}${Math.floor(Math.abs(minutes) / 60)}${Math.abs(minutes) % 60 ? ":" + String(Math.abs(minutes) % 60).padStart(2, "0") : ""}`;
    } catch {
      return "Offset unavailable";
    }
  }
}
