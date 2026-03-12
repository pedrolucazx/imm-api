import { and, eq } from "drizzle-orm";
import type { DrizzleDb } from "../../core/database/connection.js";
import { habitLogs, type HabitLog, type NewHabitLog } from "../../core/database/schema/index.js";

export function createHabitLogsRepository(db: DrizzleDb) {
  return {
    async upsert(data: NewHabitLog): Promise<HabitLog> {
      const [log] = await db
        .insert(habitLogs)
        .values(data)
        .onConflictDoUpdate({
          target: [habitLogs.habitId, habitLogs.logDate],
          set: {
            completed: data.completed,
            completedAt: data.completedAt,
          },
        })
        .returning();
      return log;
    },

    async findByHabitId(habitId: string): Promise<HabitLog[]> {
      return db.select().from(habitLogs).where(eq(habitLogs.habitId, habitId));
    },

    async findByHabitAndDate(habitId: string, logDate: string): Promise<HabitLog | undefined> {
      const [log] = await db
        .select()
        .from(habitLogs)
        .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.logDate, logDate)));
      return log;
    },
  };
}

export type HabitLogsRepository = ReturnType<typeof createHabitLogsRepository>;
