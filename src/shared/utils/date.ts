import { format, isSameDay as dateFnsIsSameDay } from "date-fns";

export function getTodayUTCString(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function isSameDay(a: Date, b: Date): boolean {
  return dateFnsIsSameDay(a, b);
}
