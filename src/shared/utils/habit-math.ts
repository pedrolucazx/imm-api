import { format, parseISO, differenceInCalendarDays, subDays } from "date-fns";
import type { HabitLog } from "../../core/database/schema/index.js";
import { MAX_HABIT_DAYS } from "../constants.js";

export function computeCurrentDay(startDate: string | Date | null): number {
  if (!startDate) return 1;
  const start = typeof startDate === "string" ? parseISO(startDate) : startDate;
  if (Number.isNaN(start.getTime())) return 1;
  const diff = differenceInCalendarDays(new Date(), start);
  return Math.max(1, Math.min(diff + 1, MAX_HABIT_DAYS));
}

export function computeStreak(logs: HabitLog[]): number {
  const completedDates = new Set(logs.filter((l) => l.completed).map((l) => l.logDate));
  if (completedDates.size === 0) return 0;

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const yesterdayStr = format(subDays(today, 1), "yyyy-MM-dd");

  if (!completedDates.has(todayStr) && !completedDates.has(yesterdayStr)) return 0;

  let streak = 0;
  let cursor = completedDates.has(todayStr) ? today : subDays(today, 1);

  while (true) {
    const dateStr = format(cursor, "yyyy-MM-dd");
    if (completedDates.has(dateStr)) {
      streak++;
      cursor = subDays(cursor, 1);
    } else {
      break;
    }
  }

  return streak;
}
