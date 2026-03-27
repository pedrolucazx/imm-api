import type { PronunciationRepository } from "./pronunciation.repository.js";
import type { HabitsRepository } from "../habits/habits.repository.js";
import { downloadAudioAsBase64 } from "../../core/storage/supabase-storage.js";
import { callGeminiMultimodal } from "../ai-agents/gemini-client.js";
import { getTodayUTCString } from "../../shared/utils/date.js";
import { NotFoundError, BadRequestError } from "../../shared/errors/index.js";
import { SKILL_BUILDING_LOCALE_SET } from "../../shared/schemas/habit-mode.js";
import { logger } from "../../core/config/logger.js";
import type {
  AnalyzePronunciationInput,
  AnalyzePronunciationResult,
  WordCloudItem,
} from "./pronunciation.types.js";

function normalize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const result: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return result;
}

function compareTexts(
  original: string,
  transcription: string
): { score: number; missedWords: string[]; correctWords: string[]; extraWords: string[] } {
  const orig = normalize(original);
  const trans = normalize(transcription);
  const lcs = computeLCS(orig, trans);
  const lcsSet = new Set(lcs);

  const score = orig.length > 0 ? Math.round((lcs.length / orig.length) * 1000) / 1000 : 0;

  return {
    score,
    missedWords: orig.filter((w) => !lcsSet.has(w)),
    correctWords: lcs,
    extraWords: trans.filter((w) => !lcsSet.has(w)),
  };
}

function buildTranscriptionPrompt(targetSkill: string): string {
  return `Transcribe the following audio exactly as spoken in ${targetSkill}. Return only the transcription text with no punctuation, no spelling corrections, and no commentary. Verbatim transcription only.`;
}

type PronunciationServiceDeps = {
  pronunciationRepo: PronunciationRepository;
  habitsRepo: HabitsRepository;
};

export function createPronunciationService({
  pronunciationRepo,
  habitsRepo,
}: PronunciationServiceDeps) {
  return {
    async analyze(
      userId: string,
      input: AnalyzePronunciationInput
    ): Promise<AnalyzePronunciationResult> {
      const habit = await habitsRepo.findById(input.habitId, userId);
      if (!habit) throw new NotFoundError("Habit not found");

      if (!habit.targetSkill || !SKILL_BUILDING_LOCALE_SET.has(habit.targetSkill)) {
        throw new BadRequestError("Pronunciation analysis is only available for language habits");
      }

      const entryDate = input.entryDate ?? getTodayUTCString();

      logger.info({ habitId: input.habitId, userId }, "[pronunciation] Downloading audio");
      const { base64, mimeType } = await downloadAudioAsBase64(input.audioUrl);

      const prompt = buildTranscriptionPrompt(habit.targetSkill);
      logger.info({ habitId: input.habitId }, "[pronunciation] Calling Gemini for transcription");
      const transcription = await callGeminiMultimodal(base64, mimeType, prompt, 500);
      logger.info(
        { habitId: input.habitId, transcription },
        "[pronunciation] Transcription complete"
      );

      const { score, missedWords, correctWords, extraWords } = compareTexts(
        input.originalText,
        transcription
      );

      const entry = await pronunciationRepo.create({
        userId,
        habitId: input.habitId,
        entryDate,
        originalText: input.originalText,
        transcription,
        score: String(score),
        missedWords,
        correctWords,
        extraWords,
        audioUrl: input.audioUrl,
      });

      return {
        id: entry.id,
        userId: entry.userId,
        habitId: entry.habitId,
        entryDate: entry.entryDate,
        originalText: entry.originalText,
        transcription: entry.transcription ?? null,
        score,
        missedWords,
        correctWords,
        extraWords,
        audioUrl: entry.audioUrl ?? null,
        createdAt: entry.createdAt,
      };
    },

    async getWordCloud(userId: string, habitId: string, limit = 50): Promise<WordCloudItem[]> {
      const habit = await habitsRepo.findById(habitId, userId);
      if (!habit) throw new NotFoundError("Habit not found");
      return pronunciationRepo.getWordCloud(userId, habitId, limit);
    },
  };
}

export type PronunciationService = ReturnType<typeof createPronunciationService>;
