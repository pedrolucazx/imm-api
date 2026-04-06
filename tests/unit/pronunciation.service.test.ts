import { createPronunciationService } from "@/modules/pronunciation/pronunciation.service.js";
import { NotFoundError, BadRequestError } from "@/shared/errors/index.js";
import type { HabitsRepository } from "@/modules/habits/habits.repository.js";
import type { PronunciationRepository } from "@/modules/pronunciation/pronunciation.repository.js";
import type { Habit } from "@/core/database/schema/index.js";

const mockDownload = jest.fn();
const mockTranscribe = jest.fn();

function makeMockProviders() {
  return {
    storage: { downloadAudioAsBase64: mockDownload } as never,
    transcription: { transcribe: mockTranscribe },
  };
}

const mockLanguageHabit: Habit = {
  id: "habit-uuid-1",
  userId: "user-uuid-1",
  name: "English",
  targetSkill: "en-US",
  icon: "🌍",
  color: "#4299e1",
  frequency: "daily",
  targetDays: 7,
  isActive: true,
  sortOrder: 0,
  startDate: null,
  habitPlan: {},
  planStatus: "active",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const mockBehavioralHabit: Habit = {
  ...mockLanguageHabit,
  id: "habit-uuid-2",
  name: "Academia",
  targetSkill: "fitness",
};

function makeMockHabitsRepo(habit: Habit | null): HabitsRepository {
  return {
    findById: jest.fn().mockResolvedValue(habit),
    create: jest.fn(),
    findAllByUserId: jest.fn(),
    countActiveByUserId: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  } as unknown as HabitsRepository;
}

function makeMockPronunciationRepo(): PronunciationRepository {
  return {
    create: jest.fn().mockResolvedValue({
      id: "entry-uuid-1",
      userId: "user-uuid-1",
      habitId: "habit-uuid-1",
      entryDate: "2026-03-27",
      originalText: "the quick brown fox",
      transcription: "the quick brown fox",
      score: "1.000",
      missedWords: [],
      correctWords: ["the", "quick", "brown", "fox"],
      extraWords: [],
      audioUrl: "https://fake.supabase.co/storage/v1/object/public/audio-entries/u/file.webm",
      createdAt: new Date("2026-03-27"),
    }),
    getWordCloud: jest.fn().mockResolvedValue([]),
    findLatestByHabitAndDate: jest.fn().mockResolvedValue(null),
  };
}

describe("PronunciationService — compareTexts (via analyze)", () => {
  beforeEach(() => {
    mockDownload.mockResolvedValue({ base64: "fakebase64", mimeType: "audio/webm" });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("score calculation", () => {
    it("returns score 1.0 when transcription matches original exactly", async () => {
      const habitsRepo = makeMockHabitsRepo(mockLanguageHabit);
      const pronunciationRepo = makeMockPronunciationRepo();
      (pronunciationRepo.create as jest.Mock).mockResolvedValueOnce({
        ...(await pronunciationRepo.create({} as Parameters<typeof pronunciationRepo.create>[0])),
        score: "1.000",
        missedWords: [],
        correctWords: ["the", "quick", "brown", "fox"],
        extraWords: [],
        transcription: "the quick brown fox",
      });

      mockTranscribe.mockResolvedValue("the quick brown fox");

      const { storage, transcription } = makeMockProviders();
      const service = createPronunciationService({
        pronunciationRepo,
        habitsRepo,
        storage,
        transcription,
      });
      const result = await service.analyze("user-uuid-1", {
        habitId: "habit-uuid-1",
        audioUrl: "https://fake.supabase.co/storage/v1/object/public/audio-entries/u/file.webm",
        originalText: "the quick brown fox",
      });

      expect(result.score).toBe(1);
      expect(result.missedWords).toHaveLength(0);
      expect(result.extraWords).toHaveLength(0);
    });

    it("returns score 0.5 when half the words are correct", async () => {
      const habitsRepo = makeMockHabitsRepo(mockLanguageHabit);
      const pronunciationRepo = makeMockPronunciationRepo();

      mockTranscribe.mockResolvedValue("the quick");

      const { storage, transcription } = makeMockProviders();
      const service = createPronunciationService({
        pronunciationRepo,
        habitsRepo,
        storage,
        transcription,
      });
      const result = await service.analyze("user-uuid-1", {
        habitId: "habit-uuid-1",
        audioUrl: "https://fake.supabase.co/storage/v1/object/public/audio-entries/u/file.webm",
        originalText: "the quick brown fox",
      });

      expect(result.score).toBe(0.5);
      expect(result.correctWords).toEqual(["the", "quick"]);
      expect(result.missedWords).toContain("brown");
      expect(result.missedWords).toContain("fox");
    });

    it("returns score 0 when transcription is completely different", async () => {
      const habitsRepo = makeMockHabitsRepo(mockLanguageHabit);
      const pronunciationRepo = makeMockPronunciationRepo();

      mockTranscribe.mockResolvedValue("completely different words here");

      const { storage, transcription } = makeMockProviders();
      const service = createPronunciationService({
        pronunciationRepo,
        habitsRepo,
        storage,
        transcription,
      });
      const result = await service.analyze("user-uuid-1", {
        habitId: "habit-uuid-1",
        audioUrl: "https://fake.supabase.co/storage/v1/object/public/audio-entries/u/file.webm",
        originalText: "the quick brown fox",
      });

      expect(result.score).toBe(0);
      expect(result.missedWords).toHaveLength(4);
    });
  });

  describe("text normalization", () => {
    it("is case-insensitive", async () => {
      const habitsRepo = makeMockHabitsRepo(mockLanguageHabit);
      const pronunciationRepo = makeMockPronunciationRepo();

      mockTranscribe.mockResolvedValue("THE QUICK BROWN FOX");

      const { storage, transcription } = makeMockProviders();
      const service = createPronunciationService({
        pronunciationRepo,
        habitsRepo,
        storage,
        transcription,
      });
      const result = await service.analyze("user-uuid-1", {
        habitId: "habit-uuid-1",
        audioUrl: "https://fake.supabase.co/storage/v1/object/public/audio-entries/u/file.webm",
        originalText: "the quick brown fox",
      });

      expect(result.score).toBe(1);
      expect(result.missedWords).toHaveLength(0);
    });

    it("ignores punctuation in both original and transcription", async () => {
      const habitsRepo = makeMockHabitsRepo(mockLanguageHabit);
      const pronunciationRepo = makeMockPronunciationRepo();

      mockTranscribe.mockResolvedValue("the quick brown fox");

      const { storage, transcription } = makeMockProviders();
      const service = createPronunciationService({
        pronunciationRepo,
        habitsRepo,
        storage,
        transcription,
      });
      const result = await service.analyze("user-uuid-1", {
        habitId: "habit-uuid-1",
        audioUrl: "https://fake.supabase.co/storage/v1/object/public/audio-entries/u/file.webm",
        originalText: "The quick, brown fox!",
      });

      expect(result.score).toBe(1);
    });
  });

  describe("business validation", () => {
    it("throws NotFoundError when habit does not exist", async () => {
      const habitsRepo = makeMockHabitsRepo(null);
      const pronunciationRepo = makeMockPronunciationRepo();
      const { storage, transcription } = makeMockProviders();
      const service = createPronunciationService({
        pronunciationRepo,
        habitsRepo,
        storage,
        transcription,
      });

      await expect(
        service.analyze("user-uuid-1", {
          habitId: "nonexistent-habit",
          audioUrl: "https://fake.supabase.co/storage/v1/object/public/audio-entries/u/f.webm",
          originalText: "hello world",
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("throws BadRequestError when habit is not a language habit", async () => {
      const habitsRepo = makeMockHabitsRepo(mockBehavioralHabit);
      const pronunciationRepo = makeMockPronunciationRepo();
      const { storage, transcription } = makeMockProviders();
      const service = createPronunciationService({
        pronunciationRepo,
        habitsRepo,
        storage,
        transcription,
      });

      await expect(
        service.analyze("user-uuid-1", {
          habitId: "habit-uuid-2",
          audioUrl: "https://fake.supabase.co/storage/v1/object/public/audio-entries/u/f.webm",
          originalText: "hello world",
        })
      ).rejects.toThrow(BadRequestError);
    });

    it("calls downloadAudioAsBase64 with the provided audioUrl", async () => {
      const habitsRepo = makeMockHabitsRepo(mockLanguageHabit);
      const pronunciationRepo = makeMockPronunciationRepo();
      mockTranscribe.mockResolvedValue("hello world");

      const { storage, transcription } = makeMockProviders();
      const service = createPronunciationService({
        pronunciationRepo,
        habitsRepo,
        storage,
        transcription,
      });
      const audioUrl =
        "https://fake.supabase.co/storage/v1/object/public/audio-entries/u/file.webm";

      await service.analyze("user-uuid-1", {
        habitId: "habit-uuid-1",
        audioUrl,
        originalText: "hello world",
      });

      expect(mockDownload).toHaveBeenCalledWith(audioUrl);
    });

    it("calls transcription provider with base64 and mimeType from storage", async () => {
      const habitsRepo = makeMockHabitsRepo(mockLanguageHabit);
      const pronunciationRepo = makeMockPronunciationRepo();
      mockDownload.mockResolvedValue({ base64: "abc123", mimeType: "audio/ogg" });
      mockTranscribe.mockResolvedValue("hello world");

      const { storage, transcription } = makeMockProviders();
      const service = createPronunciationService({
        pronunciationRepo,
        habitsRepo,
        storage,
        transcription,
      });
      await service.analyze("user-uuid-1", {
        habitId: "habit-uuid-1",
        audioUrl: "https://fake.supabase.co/storage/v1/object/public/audio-entries/u/file.webm",
        originalText: "hello world",
      });

      expect(mockTranscribe).toHaveBeenCalledWith("abc123", "audio/ogg", expect.any(String), 500);
    });
  });

  describe("getWordCloud", () => {
    it("throws NotFoundError when habit does not exist", async () => {
      const habitsRepo = makeMockHabitsRepo(null);
      const pronunciationRepo = makeMockPronunciationRepo();
      const { storage, transcription } = makeMockProviders();
      const service = createPronunciationService({
        pronunciationRepo,
        habitsRepo,
        storage,
        transcription,
      });

      await expect(service.getWordCloud("user-uuid-1", "nonexistent")).rejects.toThrow(
        NotFoundError
      );
    });

    it("delegates to pronunciationRepo.getWordCloud", async () => {
      const habitsRepo = makeMockHabitsRepo(mockLanguageHabit);
      const pronunciationRepo = makeMockPronunciationRepo();
      (pronunciationRepo.getWordCloud as jest.Mock).mockResolvedValue([
        { word: "the", frequency: 5 },
        { word: "fox", frequency: 3 },
      ]);

      const { storage, transcription } = makeMockProviders();
      const service = createPronunciationService({
        pronunciationRepo,
        habitsRepo,
        storage,
        transcription,
      });
      const result = await service.getWordCloud("user-uuid-1", "habit-uuid-1");

      expect(pronunciationRepo.getWordCloud).toHaveBeenCalledWith(
        "user-uuid-1",
        "habit-uuid-1",
        50
      );
      expect(result).toHaveLength(2);
      expect(result[0].word).toBe("the");
    });
  });
});
