import { and, eq, count } from "drizzle-orm";
import type { DrizzleDb, DbClient } from "../../core/database/connection.js";
import { habits, type Habit, type NewHabit } from "../../core/database/schema/index.js";

type MutableHabitFields = Partial<Omit<NewHabit, "id" | "userId" | "createdAt">>;
type HabitFilter = "active" | "inactive" | "all";

export function createHabitsRepository(db: DrizzleDb) {
  return {
    async create(data: NewHabit): Promise<Habit> {
      const [habit] = await db.insert(habits).values(data).returning();
      return habit;
    },

    async findById(id: string, userId: string, tx?: DbClient): Promise<Habit | null> {
      const client = tx ?? db;
      const [habit] = await client
        .select()
        .from(habits)
        .where(and(eq(habits.id, id), eq(habits.userId, userId)));
      return habit ?? null;
    },

    async findAllByUserId(userId: string, filter: HabitFilter = "all"): Promise<Habit[]> {
      const conditions = [eq(habits.userId, userId)];
      if (filter === "active") conditions.push(eq(habits.isActive, true));
      if (filter === "inactive") conditions.push(eq(habits.isActive, false));
      return db
        .select()
        .from(habits)
        .where(and(...conditions));
    },

    async countActiveByUserId(userId: string): Promise<number> {
      const [result] = await db
        .select({ count: count() })
        .from(habits)
        .where(and(eq(habits.userId, userId), eq(habits.isActive, true)));
      return result?.count ?? 0;
    },

    async update(
      id: string,
      userId: string,
      data: MutableHabitFields,
      tx?: DbClient
    ): Promise<Habit | undefined> {
      const client = tx ?? db;
      const fields = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined)
      ) as MutableHabitFields;
      if (Object.keys(fields).length === 0) return undefined;

      const [habit] = await client
        .update(habits)
        .set({ ...fields, updatedAt: new Date() })
        .where(and(eq(habits.id, id), eq(habits.userId, userId)))
        .returning();
      return habit;
    },

    async softDelete(id: string, userId: string, tx?: DbClient): Promise<Habit | undefined> {
      const client = tx ?? db;
      const [habit] = await client
        .update(habits)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(habits.id, id), eq(habits.userId, userId)))
        .returning();
      return habit;
    },
  };
}

export type HabitsRepository = ReturnType<typeof createHabitsRepository>;
