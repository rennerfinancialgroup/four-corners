// Turns a plan date + "HH:mm" local time + timezone into an absolute
// epoch-ms timestamp the scheduler can compare against. Luxon handles DST.
import { DateTime } from "luxon";

export function fireTimestamp(dateISO, hhmm, tz) {
  const [h, m] = hhmm.split(":").map(Number);
  const dt = DateTime.fromISO(dateISO, { zone: tz }).set({
    hour: h,
    minute: m,
    second: 0,
    millisecond: 0,
  });
  return dt.toMillis();
}

export function nowInZone(tz) {
  return DateTime.now().setZone(tz);
}

// "2:05 pm" style label for messages
export function clockLabel(ms, tz) {
  return DateTime.fromMillis(ms, { zone: tz }).toFormat("h:mm a").toLowerCase();
}
