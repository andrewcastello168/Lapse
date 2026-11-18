export function tourKey(userId: string, path: string, section = "") {
  const screen = path.startsWith("/item/")
    ? "item"
    : path.replace(/[^a-zA-Z0-9]/g, "_");
  return `lapse.tour.v2.${userId}.${screen}.${section}`;
}
export function tourExplanation(name: string) {
  const label = name.toLowerCase();
  if (label.includes("filter"))
    return "Choose 7 days to 12 months, or All. Overdue stays visible separately. Counts distinguish items from scheduled occurrences.";
  if (label.includes("notification") || label.includes("remind"))
    return "Allow device permission, choose account offsets and local delivery hour, or override reminders on an item. Server delivery is approximate; provider acceptance does not prove delivery.";
  if (label.includes("renew"))
    return "Manual renewal requires explicit confirmation of old and new validity dates. The new date must be later; renewing one missed period may still leave the item overdue. Automatic schedules do not verify payments.";
  if (label.includes("recurr") || label.includes("repeat"))
    return "Combine years, months and days. For example, 1 year + 1 month + 2 days. Monthly from 31 January returns to 31 March after February is clamped.";
  if (label.includes("expir") || label.includes("date"))
    return "ONCE keeps its due date until edited or renewed. RECURRING repeats from the original anchor. NEVER has no expiration or reminders.";
  if (label.includes("timezone"))
    return "Automatic follows your device IANA timezone without GPS. Select a city for a manual override. Calendar dates stay unchanged while reminder delivery follows DST.";
  if (label.includes("calendar") || label.includes("timeline"))
    return "Select a day or month to see scheduled occurrences. Automatic items can appear more than once. Manual validity remains actionable until you confirm renewal.";
  if (
    label.includes("name") ||
    label.includes("category") ||
    label.includes("create")
  )
    return "Choose a category, then a catalog or custom item. Custom items inherit category artwork. Review the schedule before saving.";
  if (label.includes("password"))
    return "Use at least 8 characters. Changing your password signs out your devices. Reset links expire in 30 minutes and work only once.";
  return "Use this control to explore your tracked items. Status is based on your selected timezone: overdue, due today, expiring in 1?7 days, upcoming or no expiry. Detailed examples are in the offline Help Center.";
}
