import { createJournalController } from "@/modules/journal/journal.controller.js";
import type { JournalService } from "@/modules/journal/journal.service.js";
import { NotFoundError, BadRequestError } from "@/shared/errors/index.js";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { CreateJournalEntryInput } from "@/modules/journal/journal.types.js";

const mockEntry = {
  id: "entry-uuid-1",
  userId: "user-uuid-1",
  habitId: "habit-uuid-1",
  entryDate: "2026-03-28",
  content: "Today I practiced speaking English.",
  wordCount: 6,
  uiLanguageSnap: "pt-BR",
  targetSkillSnap: "en-US",
  aiFeedback: null,
  aiAgentType: null,
  moodScore: 4,
  energyScore: 3,
  createdAt: new Date("2026-03-28"),
  updatedAt: new Date("2026-03-28"),
};

const VALID_HABIT_ID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_WEBM_BUFFER = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);

function makeMockMultipartFile(overrides: Record<string, unknown> = {}) {
  return {
    fieldname: "audio",
    mimetype: "audio/webm",
    toBuffer: jest.fn().mockResolvedValue(VALID_WEBM_BUFFER),
    fields: {
      habitId: { type: "field", value: VALID_HABIT_ID },
    },
    ...overrides,
  };
}

function makeMockRequest(fileResult: unknown) {
  return {
    user: { id: "user-uuid-1", email: "user@example.com" },
    file: jest.fn().mockResolvedValue(fileResult),
  };
}

describe("JournalController — transcribe", () => {
  let mockService: jest.Mocked<JournalService>;
  let controller: ReturnType<typeof createJournalController>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockService = {
      createEntry: jest.fn(),
      listEntries: jest.fn(),
      listEntriesByDate: jest.fn(),
      transcribe: jest.fn(),
      listHistory: jest.fn(),
    } as jest.Mocked<JournalService>;

    controller = createJournalController(mockService);

    mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  it("returns 200 with transcription on success", async () => {
    mockService.transcribe.mockResolvedValue({ transcription: "Hello world" });
    const mockRequest = makeMockRequest(makeMockMultipartFile());

    await controller.transcribe(
      mockRequest as unknown as FastifyRequest,
      mockReply as FastifyReply
    );

    expect(mockReply.code).toHaveBeenCalledWith(200);
    expect(mockReply.send).toHaveBeenCalledWith({ transcription: "Hello world" });
  });

  it("delegates to service.transcribe with userId, habitId and decoded audio buffer/mimeType", async () => {
    mockService.transcribe.mockResolvedValue({ transcription: "Hello world" });
    const mockRequest = makeMockRequest(makeMockMultipartFile());

    await controller.transcribe(
      mockRequest as unknown as FastifyRequest,
      mockReply as FastifyReply
    );

    expect(mockService.transcribe).toHaveBeenCalledWith("user-uuid-1", {
      habitId: VALID_HABIT_ID,
      audioBuffer: VALID_WEBM_BUFFER,
      mimeType: "audio/webm",
    });
  });

  it("returns 400 when no file part is present", async () => {
    const mockRequest = makeMockRequest(undefined);

    await controller.transcribe(
      mockRequest as unknown as FastifyRequest,
      mockReply as FastifyReply
    );

    expect(mockReply.code).toHaveBeenCalledWith(400);
    expect(mockService.transcribe).not.toHaveBeenCalled();
  });

  it("returns 400 for an unsupported audio mimetype", async () => {
    const mockRequest = makeMockRequest(makeMockMultipartFile({ mimetype: "video/mp4" }));

    await controller.transcribe(
      mockRequest as unknown as FastifyRequest,
      mockReply as FastifyReply
    );

    expect(mockReply.code).toHaveBeenCalledWith(400);
    expect(mockService.transcribe).not.toHaveBeenCalled();
  });

  it("returns 413 when the audio exceeds the multipart limit", async () => {
    const error = Object.assign(new Error("too large"), { code: "FST_REQ_FILE_TOO_LARGE" });
    const mockRequest = makeMockRequest(
      makeMockMultipartFile({ toBuffer: jest.fn().mockRejectedValue(error) })
    );

    await controller.transcribe(
      mockRequest as unknown as FastifyRequest,
      mockReply as FastifyReply
    );

    expect(mockReply.code).toHaveBeenCalledWith(413);
    expect(mockService.transcribe).not.toHaveBeenCalled();
  });

  it("returns 422 when habitId field is missing or not a UUID", async () => {
    const mockRequest = makeMockRequest(
      makeMockMultipartFile({ fields: { habitId: { type: "field", value: "not-a-uuid" } } })
    );

    await controller.transcribe(
      mockRequest as unknown as FastifyRequest,
      mockReply as FastifyReply
    );

    expect(mockReply.code).toHaveBeenCalledWith(422);
    expect(mockService.transcribe).not.toHaveBeenCalled();
  });

  it("returns 404 when service throws NotFoundError", async () => {
    mockService.transcribe.mockRejectedValue(new NotFoundError("Habit not found"));
    const mockRequest = makeMockRequest(makeMockMultipartFile());

    await controller.transcribe(
      mockRequest as unknown as FastifyRequest,
      mockReply as FastifyReply
    );

    expect(mockReply.code).toHaveBeenCalledWith(404);
  });

  it("returns 400 when service throws BadRequestError (non-language habit)", async () => {
    mockService.transcribe.mockRejectedValue(
      new BadRequestError("Transcription is only available for language habits")
    );
    const mockRequest = makeMockRequest(makeMockMultipartFile());

    await controller.transcribe(
      mockRequest as unknown as FastifyRequest,
      mockReply as FastifyReply
    );

    expect(mockReply.code).toHaveBeenCalledWith(400);
  });

  it("returns 500 for unexpected errors", async () => {
    mockService.transcribe.mockRejectedValue(new Error("Unexpected failure"));
    const mockRequest = makeMockRequest(makeMockMultipartFile());

    await controller.transcribe(
      mockRequest as unknown as FastifyRequest,
      mockReply as FastifyReply
    );

    expect(mockReply.code).toHaveBeenCalledWith(500);
  });
});

// ---------------------------------------------------------------------------
// createEntry
// ---------------------------------------------------------------------------

describe("JournalController — createEntry", () => {
  let mockService: jest.Mocked<JournalService>;
  let controller: ReturnType<typeof createJournalController>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockService = {
      createEntry: jest.fn().mockResolvedValue(mockEntry),
      listEntries: jest.fn(),
      listEntriesByDate: jest.fn(),
      transcribe: jest.fn(),
      listHistory: jest.fn(),
    } as jest.Mocked<JournalService>;

    controller = createJournalController(mockService);

    mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  it("creates entry from content, mood and energy scores", async () => {
    const mockRequest = {
      user: { id: "user-uuid-1", email: "user@example.com" },
      body: {
        habitId: VALID_HABIT_ID,
        content: "Today I recorded an audio entry.",
        moodScore: 4,
        energyScore: 3,
      },
    };

    await controller.createEntry(
      mockRequest as unknown as FastifyRequest<{ Body: CreateJournalEntryInput }>,
      mockReply as FastifyReply
    );

    expect(mockService.createEntry).toHaveBeenCalledWith("user-uuid-1", {
      habitId: VALID_HABIT_ID,
      content: "Today I recorded an audio entry.",
      moodScore: 4,
      energyScore: 3,
    });
    expect(mockReply.code).toHaveBeenCalledWith(201);
  });
});
