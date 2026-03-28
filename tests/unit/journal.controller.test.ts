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
  audioUrl: "https://fake.supabase.co/storage/v1/object/public/audio-entries/user-uuid-1/file.webm",
  createdAt: new Date("2026-03-28"),
  updatedAt: new Date("2026-03-28"),
};

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

    const mockRequest = {
      user: { id: "user-uuid-1", email: "user@example.com" },
      body: {
        audioUrl:
          "https://fake.supabase.co/storage/v1/object/public/audio-entries/user-uuid-1/file.webm",
        habitId: "550e8400-e29b-41d4-a716-446655440000",
      },
    };

    await controller.transcribe(
      mockRequest as FastifyRequest<{ Body: { audioUrl: string; habitId: string } }>,
      mockReply as FastifyReply
    );

    expect(mockReply.code).toHaveBeenCalledWith(200);
    expect(mockReply.send).toHaveBeenCalledWith({ transcription: "Hello world" });
  });

  it("delegates to service.transcribe with correct userId and body", async () => {
    mockService.transcribe.mockResolvedValue({ transcription: "Hello world" });

    const audioUrl =
      "https://fake.supabase.co/storage/v1/object/public/audio-entries/user-uuid-1/file.webm";
    const habitId = "550e8400-e29b-41d4-a716-446655440000";

    const mockRequest = {
      user: { id: "user-uuid-1", email: "user@example.com" },
      body: { audioUrl, habitId },
    };

    await controller.transcribe(
      mockRequest as FastifyRequest<{ Body: { audioUrl: string; habitId: string } }>,
      mockReply as FastifyReply
    );

    expect(mockService.transcribe).toHaveBeenCalledWith("user-uuid-1", { audioUrl, habitId });
  });

  it("returns 404 when service throws NotFoundError", async () => {
    mockService.transcribe.mockRejectedValue(new NotFoundError("Habit not found"));

    const mockRequest = {
      user: { id: "user-uuid-1", email: "user@example.com" },
      body: {
        audioUrl: "https://fake.supabase.co/storage/v1/object/public/audio-entries/u/f.webm",
        habitId: "550e8400-e29b-41d4-a716-446655440000",
      },
    };

    await controller.transcribe(
      mockRequest as FastifyRequest<{ Body: { audioUrl: string; habitId: string } }>,
      mockReply as FastifyReply
    );

    expect(mockReply.code).toHaveBeenCalledWith(404);
  });

  it("returns 400 when service throws BadRequestError (non-language habit)", async () => {
    mockService.transcribe.mockRejectedValue(
      new BadRequestError("Transcription is only available for language habits")
    );

    const mockRequest = {
      user: { id: "user-uuid-1", email: "user@example.com" },
      body: {
        audioUrl: "https://fake.supabase.co/storage/v1/object/public/audio-entries/u/f.webm",
        habitId: "550e8400-e29b-41d4-a716-446655440000",
      },
    };

    await controller.transcribe(
      mockRequest as FastifyRequest<{ Body: { audioUrl: string; habitId: string } }>,
      mockReply as FastifyReply
    );

    expect(mockReply.code).toHaveBeenCalledWith(400);
  });

  it("returns 500 for unexpected errors", async () => {
    mockService.transcribe.mockRejectedValue(new Error("Storage unreachable"));

    const mockRequest = {
      user: { id: "user-uuid-1", email: "user@example.com" },
      body: {
        audioUrl: "https://fake.supabase.co/storage/v1/object/public/audio-entries/u/f.webm",
        habitId: "550e8400-e29b-41d4-a716-446655440000",
      },
    };

    await controller.transcribe(
      mockRequest as FastifyRequest<{ Body: { audioUrl: string; habitId: string } }>,
      mockReply as FastifyReply
    );

    expect(mockReply.code).toHaveBeenCalledWith(500);
  });
});

// ---------------------------------------------------------------------------
// createEntry — existing handler, now with audioUrl in body
// ---------------------------------------------------------------------------

describe("JournalController — createEntry (with audioUrl)", () => {
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

  it("forwards audioUrl to service.createEntry when present in body", async () => {
    const audioUrl =
      "https://fake.supabase.co/storage/v1/object/public/audio-entries/user-uuid-1/file.webm";

    const mockRequest = {
      user: { id: "user-uuid-1", email: "user@example.com" },
      body: {
        habitId: "550e8400-e29b-41d4-a716-446655440000",
        content: "Today I recorded an audio entry.",
        audioUrl,
        moodScore: 4,
        energyScore: 3,
      },
    };

    await controller.createEntry(
      mockRequest as unknown as FastifyRequest<{ Body: CreateJournalEntryInput }>,
      mockReply as FastifyReply
    );

    expect(mockService.createEntry).toHaveBeenCalledWith(
      "user-uuid-1",
      expect.objectContaining({ audioUrl })
    );
    expect(mockReply.code).toHaveBeenCalledWith(201);
  });

  it("creates entry without audioUrl when not provided", async () => {
    const mockRequest = {
      user: { id: "user-uuid-1", email: "user@example.com" },
      body: {
        habitId: "550e8400-e29b-41d4-a716-446655440000",
        content: "A text-only entry.",
      },
    };

    await controller.createEntry(
      mockRequest as unknown as FastifyRequest<{ Body: CreateJournalEntryInput }>,
      mockReply as FastifyReply
    );

    expect(mockService.createEntry).toHaveBeenCalledWith(
      "user-uuid-1",
      expect.not.objectContaining({ audioUrl: expect.any(String) })
    );
    expect(mockReply.code).toHaveBeenCalledWith(201);
  });
});
