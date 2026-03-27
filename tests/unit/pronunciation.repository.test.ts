import { createPronunciationRepository } from "@/modules/pronunciation/pronunciation.repository.js";
import type { DrizzleDb } from "@/core/database/connection.js";

const mockDb = {
  insert: jest.fn().mockReturnValue({
    values: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue([
        {
          id: "entry-uuid-1",
          userId: "user-uuid-1",
          habitId: "habit-uuid-1",
          entryDate: "2026-03-27",
          originalText: "hello world",
          transcription: "hello world",
          score: "1.000",
          missedWords: [],
          correctWords: ["hello", "world"],
          extraWords: [],
          audioUrl: "https://example.com/audio.webm",
          createdAt: new Date("2026-03-27"),
        },
      ]),
    }),
  }),
  select: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        orderBy: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([
            {
              id: "entry-uuid-1",
              userId: "user-uuid-1",
              habitId: "habit-uuid-1",
              entryDate: "2026-03-27",
              originalText: "hello world",
              transcription: "hello world",
              score: "1.000",
              missedWords: [],
              correctWords: ["hello", "world"],
              extraWords: [],
              audioUrl: null,
              createdAt: new Date("2026-03-27"),
            },
          ]),
        }),
      }),
    }),
  }),
  execute: jest.fn(),
} as unknown as DrizzleDb;

describe("PronunciationRepository", () => {
  let repo: ReturnType<typeof createPronunciationRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = createPronunciationRepository(mockDb);
  });

  describe("create", () => {
    it("inserts pronunciation entry and returns the created entry", async () => {
      const result = await repo.create({
        userId: "user-uuid-1",
        habitId: "habit-uuid-1",
        entryDate: "2026-03-27",
        originalText: "hello world",
        transcription: "hello world",
        score: "1.000",
        missedWords: [],
        correctWords: ["hello", "world"],
        extraWords: [],
      });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result.id).toBe("entry-uuid-1");
      expect(result.originalText).toBe("hello world");
    });
  });

  describe("getWordCloud", () => {
    it("returns word cloud data from database", async () => {
      const mockRows = [
        { habit_id: "habit-uuid-1", word: "difficult", frequency: 5 },
        { habit_id: "habit-uuid-1", word: "pronunciation", frequency: 3 },
      ];
      (mockDb.execute as jest.Mock).mockResolvedValue(mockRows);

      const result = await repo.getWordCloud("user-uuid-1", "habit-uuid-1");

      expect(mockDb.execute).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].word).toBe("difficult");
      expect(result[0].frequency).toBe(5);
    });

    it("returns empty array when no entries exist", async () => {
      (mockDb.execute as jest.Mock).mockResolvedValue([]);

      const result = await repo.getWordCloud("user-uuid-1", "habit-uuid-1");

      expect(result).toEqual([]);
    });
  });

  describe("findLatestByHabitAndDate", () => {
    it("returns the latest entry for habit and date", async () => {
      const result = await repo.findLatestByHabitAndDate(
        "habit-uuid-1",
        "user-uuid-1",
        "2026-03-27"
      );

      expect(mockDb.select).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result?.id).toBe("entry-uuid-1");
    });

    it("returns null when no entry exists", async () => {
      const selectMock = mockDb.select as jest.Mock;
      selectMock.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });

      const result = await repo.findLatestByHabitAndDate(
        "habit-uuid-1",
        "user-uuid-1",
        "2026-03-27"
      );

      expect(result).toBeNull();
    });
  });
});
