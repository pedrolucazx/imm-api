import type { JournalRepository } from "./journal.repository.js";
import type { HabitsRepository } from "../habits/habits.repository.js";
import type { UserProfilesRepository } from "../users/user-profiles.repository.js";
import { format } from "date-fns";
import type { CreateJournalEntryInput } from "./journal.types.js";
import type { JournalEntry } from "../../core/database/schema/index.js";
import { NotFoundError } from "../../shared/errors/index.js";
import { countWords } from "../../shared/utils/string.js";

type JournalServiceDeps = {
  journalRepo: JournalRepository;
  habitsRepo: HabitsRepository;
  userProfilesRepo: UserProfilesRepository;
};

const DEFAULT_HISTORY_LIMIT = 100;
const MAX_HISTORY_LIMIT = 365;

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
      const today = input.entryDate ?? format(new Date(), "yyyy-MM-dd");

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

    async listHistory(
      userId: string,
      limit: number = DEFAULT_HISTORY_LIMIT
    ): Promise<JournalEntry[]> {
      const safeLimit = Number.isFinite(limit)
        ? Math.min(MAX_HISTORY_LIMIT, Math.max(1, Math.trunc(limit)))
        : DEFAULT_HISTORY_LIMIT;
      return journalRepo.findAllByUserId(userId, safeLimit);
    },
  };
}

export type JournalService = ReturnType<typeof createJournalService>;
