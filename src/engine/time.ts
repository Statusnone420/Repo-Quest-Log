export function relativeSince(iso?: string): string {
  if (!iso) {
    return "just now";
  }

  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return "just now";
  }

  const deltaMs = Math.max(0, Date.now() - timestamp);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (deltaMs < minute) {
    return "just now";
  }
  if (deltaMs < hour) {
    return `${Math.max(1, Math.round(deltaMs / minute))}m`;
  }
  if (deltaMs < day) {
    return `${Math.max(1, Math.round(deltaMs / hour))}h`;
  }
  return `${Math.max(1, Math.round(deltaMs / day))}d`;
}
