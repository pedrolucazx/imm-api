import { createPronunciationController } from "@/modules/pronunciation/pronunciation.controller.js";
import type { PronunciationService } from "@/modules/pronunciation/pronunciation.service.js";
import type { FastifyRequest, FastifyReply } from "fastify";

jest.mock("@/modules/pronunciation/pronunciation.types.js", () => ({
  analyzePronunciationSchema: {
    parse: jest.fn((input) => input),
  },
  wordCloudQuerySchema: {
    parse: jest.fn((input) => input),
  },
}));

describe("PronunciationController", () => {
  const mockService: jest.Mocked<PronunciationService> = {
    analyze: jest.fn(),
    getWordCloud: jest.fn(),
  };

  let controller: ReturnType<typeof createPronunciationController>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = createPronunciationController(mockService);

    mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  describe("analyze", () => {
    const mockResult = {
      id: "entry-uuid-1",
      userId: "user-uuid-1",
      habitId: "habit-uuid-1",
      entryDate: "2026-03-27",
      originalText: "hello world",
      transcription: "hello world",
      score: 1,
      missedWords: [],
      correctWords: ["hello", "world"],
      extraWords: [],
      audioUrl: null,
      createdAt: new Date(),
    };

    it("returns 201 with analysis result on success", async () => {
      mockService.analyze.mockResolvedValue(mockResult);
      const mockRequest = {
        user: { id: "user-uuid-1", email: "user@example.com" },
        body: {
          habitId: "550e8400-e29b-41d4-a716-446655440000",
          audioUrl: "https://example.com/audio.webm",
          originalText: "hello world",
        },
      };

      await controller.analyze(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith(mockResult);
    });

    it("calls service.analyze with correct userId and input", async () => {
      mockService.analyze.mockResolvedValue(mockResult);
      const mockRequest = {
        user: { id: "user-uuid-1", email: "user@example.com" },
        body: {
          habitId: "550e8400-e29b-41d4-a716-446655440000",
          audioUrl: "https://example.com/audio.webm",
          originalText: "hello world",
        },
      };

      await controller.analyze(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockService.analyze).toHaveBeenCalledWith("user-uuid-1", {
        habitId: "550e8400-e29b-41d4-a716-446655440000",
        audioUrl: "https://example.com/audio.webm",
        originalText: "hello world",
      });
    });

    it("handles service errors via handleControllerError", async () => {
      mockService.analyze.mockRejectedValue(new Error("Service error"));
      const mockRequest = {
        user: { id: "user-uuid-1", email: "user@example.com" },
        body: {
          habitId: "550e8400-e29b-41d4-a716-446655440000",
          audioUrl: "https://example.com/audio.webm",
          originalText: "hello world",
        },
      };

      await controller.analyze(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(500);
    });
  });

  describe("getWordCloud", () => {
    it("returns 200 with word cloud data", async () => {
      const mockWordCloud = [
        { word: "difficult", frequency: 5 },
        { word: "pronunciation", frequency: 3 },
      ];

      mockService.getWordCloud.mockResolvedValue(mockWordCloud);
      const mockRequest = {
        user: { id: "user-uuid-1", email: "user@example.com" },
        query: { habitId: "550e8400-e29b-41d4-a716-446655440000" },
      };

      await controller.getWordCloud(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith(mockWordCloud);
    });

    it("calls service.getWordCloud with correct parameters", async () => {
      mockService.getWordCloud.mockResolvedValue([]);
      const mockRequest = {
        user: { id: "user-uuid-1", email: "user@example.com" },
        query: { habitId: "550e8400-e29b-41d4-a716-446655440000" },
      };

      await controller.getWordCloud(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockService.getWordCloud).toHaveBeenCalledWith(
        "user-uuid-1",
        "550e8400-e29b-41d4-a716-446655440000"
      );
    });
  });
});
