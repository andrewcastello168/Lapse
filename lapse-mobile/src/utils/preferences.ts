export const reminderOffsetsOf = (saved: {
  reminderOffsets?: unknown;
  reminderOffset?: unknown;
}) => {
  const allowed = [0, 1, 3, 7, 14, 30];
  if (Array.isArray(saved.reminderOffsets)) {
    const offsets = [
      ...new Set(
        saved.reminderOffsets.filter(
          (n): n is number => typeof n === "number" && allowed.includes(n),
        ),
      ),
    ];
    if (offsets.length) return offsets;
  }
  if (
    typeof saved.reminderOffset === "number" &&
    [1, 3, 7, 30].includes(saved.reminderOffset)
  )
    return [saved.reminderOffset];
  return [7, 1, 0];
};
export function resolveTimezone(
  saved: { timezone?: string; timezoneMode?: string },
  device: string,
  fallback = "UTC",
) {
  const mode =
    saved.timezoneMode === "manual" || (!saved.timezoneMode && saved.timezone)
      ? "manual"
      : "automatic";
  const timezone = mode === "automatic" ? device : (saved.timezone ?? fallback);
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    return { timezone, mode };
  } catch {
    return { timezone: fallback, mode };
  }
}
