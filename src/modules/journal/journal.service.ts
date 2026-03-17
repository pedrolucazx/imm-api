import type { JournalRepository } from "./journal.repository.js";
import type { HabitsRepository } from "../habits/habits.repository.js";
import type { UserProfilesRepository } from "../users/user-profiles.repository.js";
import type { CreateJournalEntryInput } from "./journal.types.js";
import type { JournalEntry } from "../../core/database/schema/index.js";
import { NotFoundError } from "../../shared/errors/index.js";

type JournalServiceDeps = {
  journalRepo: JournalRepository;
  habitsRepo: HabitsRepository;
  userProfilesRepo: UserProfilesRepository;
};

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function createJournalService({
  journalRepo,
  habitsRepo,
  userProfilesRepo,
}: JournalServiceDeps) {
  return {
    async createEntry(userId: string, input: CreateJournalEntryInput): Promise<JournalEntry> {
      const habit = await habitsRepo.findById(input.habitId, userId);
      if (!habit) throw new NotFoundError("Habit not found");

      const profile = await userProfilesRepo.findByUserId(userId);
      const uiLanguageSnap = profile?.uiLanguage ?? "pt-BR";
      const targetSkillSnap = habit.targetSkill ?? null;
      const wordCount = countWords(input.content);
      const today = input.entryDate ?? new Date().toISOString().slice(0, 10);

      const existing = await journalRepo.findByHabitAndDate(input.habitId, userId, today);

      return journalRepo.upsert({
        userId,
        habitId: input.habitId,
        entryDate: today,
        content: input.content,
        wordCount,
        uiLanguageSnap,
        targetSkillSnap,
        moodScore: input.moodScore ?? null,
        energyScore: input.energyScore ?? null,
        existingId: existing?.id,
      });
    },

    async listEntries(
      userId: string,
      habitId: string,
      limit: number = 30
    ): Promise<JournalEntry[]> {
      const habit = await habitsRepo.findById(habitId, userId);
      if (!habit) throw new NotFoundError("Habit not found");

      return journalRepo.findAllByHabitId(habitId, userId, limit);
    },

    async listEntriesByDate(userId: string, date: string): Promise<JournalEntry[]> {
      return journalRepo.findAllByDate(userId, date);
    },

    async listHistory(userId: string, limit: number = 100): Promise<JournalEntry[]> {
      return journalRepo.findAllByUserId(userId, limit);
    },
  };
}

export type JournalService = ReturnType<typeof createJournalService>;
