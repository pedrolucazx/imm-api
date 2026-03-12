import { and, eq, count } from "drizzle-orm";
import type { DrizzleDb, DbClient } from "../../core/database/connection.js";
import { habits, type Habit, type NewHabit } from "../../core/database/schema/index.js";

type MutableHabitFields = Partial<Omit<NewHabit, "id" | "userId" | "createdAt">>;

export function createHabitsRepository(db: DrizzleDb) {
  return {
    async create(data: NewHabit): Promise<Habit> {
      const [habit] = await db.insert(habits).values(data).returning();
      return habit;
    },

    async findById(id: string, tx?: DbClient): Promise<Habit | undefined> {
      const client = tx ?? db;
      const [habit] = await client.select().from(habits).where(eq(habits.id, id));
      return habit;
    },

    async findAllByUserId(userId: string): Promise<Habit[]> {
      return db.select().from(habits).where(eq(habits.userId, userId));
    },

    async countActiveByUserId(userId: string): Promise<number> {
      const [result] = await db
        .select({ count: count() })
        .from(habits)
        .where(and(eq(habits.userId, userId), eq(habits.isActive, true)));
      return result?.count ?? 0;
    },

    async update(id: string, data: MutableHabitFields, tx?: DbClient): Promise<Habit | undefined> {
      const client = tx ?? db;
      const fields = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined)
      ) as MutableHabitFields;
      if (Object.keys(fields).length === 0) return undefined;

      const [habit] = await client
        .update(habits)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(habits.id, id))
        .returning();
      return habit;
    },

    async softDelete(id: string, tx?: DbClient): Promise<Habit | undefined> {
      const client = tx ?? db;
      const [habit] = await client
        .update(habits)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(habits.id, id))
        .returning();
      return habit;
    },
  };
}

export type HabitsRepository = ReturnType<typeof createHabitsRepository>;
