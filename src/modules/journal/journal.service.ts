import type { JournalRepository } from "./journal.repository.js";
import type { HabitsRepository } from "../habits/habits.repository.js";
import type { UserProfilesRepository } from "../users/user-profiles.repository.js";
import { getTodayUTCString } from "../../shared/utils/date.js";
import type { CreateJournalEntryInput } from "./journal.types.js";
import type { JournalEntry } from "../../core/database/schema/index.js";
import { NotFoundError, BadRequestError } from "../../shared/errors/index.js";
import { countWords } from "../../shared/utils/string.js";
import { downloadAudioAsBase64 } from "../../core/storage/supabase-storage.js";
import { callGeminiMultimodal } from "../ai-agents/gemini-client.js";
import { SKILL_BUILDING_LOCALE_SET } from "../../shared/schemas/habit-mode.js";

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
      const today = input.entryDate ?? getTodayUTCString();

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
        audioUrl: input.audioUrl ?? null,
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

    async transcribe(
      userId: string,
      input: { audioUrl: string; habitId: string }
    ): Promise<{ transcription: string }> {
      const habit = await habitsRepo.findById(input.habitId, userId);
      if (!habit) throw new NotFoundError("Habit not found");

      if (!habit.targetSkill || !SKILL_BUILDING_LOCALE_SET.has(habit.targetSkill)) {
        throw new BadRequestError("Transcription is only available for language habits");
      }

      const { base64, mimeType } = await downloadAudioAsBase64(input.audioUrl);
      const prompt = `Transcribe the following audio exactly as spoken in ${habit.targetSkill}. Return only the transcription text, no punctuation corrections, no commentary. Verbatim only.`;
      const transcription = await callGeminiMultimodal(base64, mimeType, prompt, 500);

      return { transcription };
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
