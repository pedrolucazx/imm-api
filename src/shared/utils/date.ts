import { isSameDay as dateFnsIsSameDay } from "date-fns";

export function getTodayUTCString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isSameDay(a: Date, b: Date): boolean {
  return dateFnsIsSameDay(a, b);
}
