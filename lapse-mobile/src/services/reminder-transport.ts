// Once registered, transient outages must not reactivate a duplicate local queue.
export function reminderTransport(
  configured: boolean | null,
  registered: boolean,
  previouslyRegistered: boolean,
): "local" | "server" {
  if (configured === false) return "local";
  return registered || previouslyRegistered ? "server" : "local";
}
