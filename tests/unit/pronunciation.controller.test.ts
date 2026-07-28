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

const VALID_HABIT_ID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_WEBM_BUFFER = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);

function makeMockRequest(fileResult: unknown) {
  return {
    user: { id: "user-uuid-1", email: "user@example.com" },
    file: jest.fn().mockResolvedValue(fileResult),
  };
}

function makeMockMultipartFile(overrides: Record<string, unknown> = {}) {
  return {
    fieldname: "audio",
    mimetype: "audio/webm",
    toBuffer: jest.fn().mockResolvedValue(VALID_WEBM_BUFFER),
    fields: {
      habitId: { type: "field", value: VALID_HABIT_ID },
      originalText: { type: "field", value: "hello world" },
    },
    ...overrides,
  };
}

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
      createdAt: new Date(),
    };

    it("returns 201 with analysis result on success", async () => {
      mockService.analyze.mockResolvedValue(mockResult);
      const mockRequest = makeMockRequest(makeMockMultipartFile());

      await controller.analyze(mockRequest as unknown as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith(mockResult);
    });

    it("calls service.analyze with userId, decoded audio buffer/mimeType and form fields", async () => {
      mockService.analyze.mockResolvedValue(mockResult);
      const mockRequest = makeMockRequest(makeMockMultipartFile());

      await controller.analyze(mockRequest as unknown as FastifyRequest, mockReply as FastifyReply);

      expect(mockService.analyze).toHaveBeenCalledWith("user-uuid-1", {
        habitId: VALID_HABIT_ID,
        originalText: "hello world",
        audioBuffer: VALID_WEBM_BUFFER,
        mimeType: "audio/webm",
      });
    });

    it("returns 400 when no file part is present", async () => {
      const mockRequest = makeMockRequest(undefined);

      await controller.analyze(mockRequest as unknown as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockService.analyze).not.toHaveBeenCalled();
    });

    it("returns 400 for an unsupported audio mimetype", async () => {
      const mockRequest = makeMockRequest(makeMockMultipartFile({ mimetype: "video/mp4" }));

      await controller.analyze(mockRequest as unknown as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockService.analyze).not.toHaveBeenCalled();
    });

    it("handles service errors via handleControllerError", async () => {
      mockService.analyze.mockRejectedValue(new Error("Service error"));
      const mockRequest = makeMockRequest(makeMockMultipartFile());

      await controller.analyze(mockRequest as unknown as FastifyRequest, mockReply as FastifyReply);

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
        query: { habitId: VALID_HABIT_ID },
      };

      await controller.getWordCloud(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.code).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith(mockWordCloud);
    });

    it("calls service.getWordCloud with correct parameters", async () => {
      mockService.getWordCloud.mockResolvedValue([]);
      const mockRequest = {
        user: { id: "user-uuid-1", email: "user@example.com" },
        query: { habitId: VALID_HABIT_ID },
      };

      await controller.getWordCloud(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockService.getWordCloud).toHaveBeenCalledWith("user-uuid-1", VALID_HABIT_ID);
    });
  });
});
