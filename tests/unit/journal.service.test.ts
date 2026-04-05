import { createJournalService } from "@/modules/journal/journal.service.js";
import { NotFoundError, BadRequestError } from "@/shared/errors/index.js";
import type { HabitsRepository } from "@/modules/habits/habits.repository.js";
import type { JournalRepository } from "@/modules/journal/journal.repository.js";
import type { UserProfilesRepository } from "@/modules/users/user-profiles.repository.js";
import type { Habit, JournalEntry } from "@/core/database/schema/index.js";

const mockDownload = jest.fn();
const mockTranscribe = jest.fn();

const AUDIO_URL =
  "https://fake.supabase.co/storage/v1/object/public/audio-entries/user-uuid-1/file.webm";

const mockLanguageHabit: Habit = {
  id: "habit-uuid-1",
  userId: "user-uuid-1",
  name: "English",
  targetSkill: "en-US",
  icon: "🇺🇸",
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

const mockHabitNoSkill: Habit = {
  ...mockLanguageHabit,
  id: "habit-uuid-3",
  name: "Geral",
  targetSkill: null,
};

const mockJournalEntry: JournalEntry = {
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
  audioUrl: AUDIO_URL,
  createdAt: new Date("2026-03-28"),
  updatedAt: new Date("2026-03-28"),
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

function makeMockJournalRepo(existing: JournalEntry | null = null): JournalRepository {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findByHabitAndDate: jest.fn().mockResolvedValue(existing),
    findAllByHabitId: jest.fn().mockResolvedValue([]),
    findAllByDate: jest.fn().mockResolvedValue([]),
    findAllByUserId: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue(mockJournalEntry),
    upsert: jest.fn().mockResolvedValue(mockJournalEntry),
    update: jest.fn().mockResolvedValue(mockJournalEntry),
    clearAiFeedback: jest.fn().mockResolvedValue(mockJournalEntry),
  } as unknown as JournalRepository;
}

function makeMockUserProfilesRepo(uiLanguage = "pt-BR"): UserProfilesRepository {
  return {
    findByUserId: jest.fn().mockResolvedValue({ uiLanguage }),
    upsert: jest.fn(),
  } as unknown as UserProfilesRepository;
}

function makeService(
  habit: Habit | null,
  existing: JournalEntry | null = null,
  uiLanguage = "pt-BR"
) {
  const habitsRepo = makeMockHabitsRepo(habit);
  const journalRepo = makeMockJournalRepo(existing);
  const userProfilesRepo = makeMockUserProfilesRepo(uiLanguage);
  const transcription = { transcribe: mockTranscribe };
  const mockValidateOwnership = jest.fn();
  const storage = {
    downloadAudioAsBase64: mockDownload,
    validateAudioOwnership: mockValidateOwnership,
  } as never;
  const service = createJournalService({
    journalRepo,
    habitsRepo,
    userProfilesRepo,
    transcription,
    storage,
  });
  return { service, habitsRepo, journalRepo, userProfilesRepo, mockValidateOwnership };
}

// ---------------------------------------------------------------------------
// transcribe
// ---------------------------------------------------------------------------

describe("JournalService — transcribe", () => {
  beforeEach(() => {
    mockDownload.mockResolvedValue({ base64: "fakebase64", mimeType: "audio/webm" });
    mockTranscribe.mockResolvedValue("Today I practiced speaking English");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("business validation", () => {
    it("throws NotFoundError when habit does not exist", async () => {
      const { service } = makeService(null);

      await expect(
        service.transcribe("user-uuid-1", { audioUrl: AUDIO_URL, habitId: "nonexistent" })
      ).rejects.toThrow(NotFoundError);
    });

    it("throws BadRequestError when habit has no targetSkill", async () => {
      const { service } = makeService(mockHabitNoSkill);

      await expect(
        service.transcribe("user-uuid-1", { audioUrl: AUDIO_URL, habitId: "habit-uuid-3" })
      ).rejects.toThrow(BadRequestError);
    });

    it("throws BadRequestError when habit is a behavioral (fitness) habit", async () => {
      const { service } = makeService(mockBehavioralHabit);

      await expect(
        service.transcribe("user-uuid-1", { audioUrl: AUDIO_URL, habitId: "habit-uuid-2" })
      ).rejects.toThrow(BadRequestError);
    });

    it("throws BadRequestError when habit targetSkill is 'general'", async () => {
      const generalHabit: Habit = { ...mockLanguageHabit, targetSkill: "general" };
      const { service } = makeService(generalHabit);

      await expect(
        service.transcribe("user-uuid-1", { audioUrl: AUDIO_URL, habitId: "habit-uuid-1" })
      ).rejects.toThrow(BadRequestError);
    });

    it("throws BadRequestError when habit targetSkill is 'mindfulness'", async () => {
      const mindfulnessHabit: Habit = { ...mockLanguageHabit, targetSkill: "mindfulness" };
      const { service } = makeService(mindfulnessHabit);

      await expect(
        service.transcribe("user-uuid-1", { audioUrl: AUDIO_URL, habitId: "habit-uuid-1" })
      ).rejects.toThrow(BadRequestError);
    });

    it("throws BadRequestError when audioUrl has invalid storage path format", async () => {
      const { service, mockValidateOwnership } = makeService(mockLanguageHabit);
      mockValidateOwnership.mockImplementation(() => {
        throw new Error("Invalid audio URL format");
      });

      await expect(
        service.transcribe("user-uuid-1", {
          audioUrl: "https://fake.supabase.co/storage/v1/object/public/other-bucket/file.webm",
          habitId: "habit-uuid-1",
        })
      ).rejects.toThrow(BadRequestError);
    });

    it("throws BadRequestError when audioUrl belongs to another user", async () => {
      const { service, mockValidateOwnership } = makeService(mockLanguageHabit);
      mockValidateOwnership.mockImplementation(() => {
        throw new Error("Audio file does not belong to the authenticated user");
      });

      await expect(
        service.transcribe("user-uuid-1", {
          audioUrl:
            "https://fake.supabase.co/storage/v1/object/public/audio-entries/other-user-uuid/file.webm",
          habitId: "habit-uuid-1",
        })
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe("happy path — language habits", () => {
    it("returns transcription for en-US habit", async () => {
      const { service } = makeService(mockLanguageHabit);

      const result = await service.transcribe("user-uuid-1", {
        audioUrl: AUDIO_URL,
        habitId: "habit-uuid-1",
      });

      expect(result).toEqual({ transcription: "Today I practiced speaking English" });
    });

    it("returns transcription for es-ES habit", async () => {
      const esHabit: Habit = { ...mockLanguageHabit, targetSkill: "es-ES" };
      const { service } = makeService(esHabit);

      const result = await service.transcribe("user-uuid-1", {
        audioUrl: AUDIO_URL,
        habitId: "habit-uuid-1",
      });

      expect(result).toEqual({ transcription: "Today I practiced speaking English" });
    });

    it("returns transcription for pt-BR habit", async () => {
      const ptHabit: Habit = { ...mockLanguageHabit, targetSkill: "pt-BR" };
      const { service } = makeService(ptHabit);

      const result = await service.transcribe("user-uuid-1", {
        audioUrl: AUDIO_URL,
        habitId: "habit-uuid-1",
      });

      expect(result).toEqual({ transcription: "Today I practiced speaking English" });
    });

    it("returns transcription for fr-FR habit", async () => {
      const frHabit: Habit = { ...mockLanguageHabit, targetSkill: "fr-FR" };
      const { service } = makeService(frHabit);

      const result = await service.transcribe("user-uuid-1", {
        audioUrl: AUDIO_URL,
        habitId: "habit-uuid-1",
      });

      expect(result).toEqual({ transcription: "Today I practiced speaking English" });
    });
  });

  describe("dependency integration", () => {
    it("calls habitsRepo.findById with correct userId and habitId", async () => {
      const { service, habitsRepo } = makeService(mockLanguageHabit);

      await service.transcribe("user-uuid-1", {
        audioUrl: AUDIO_URL,
        habitId: "habit-uuid-1",
      });

      expect(habitsRepo.findById).toHaveBeenCalledWith("habit-uuid-1", "user-uuid-1");
    });

    it("calls downloadAudioAsBase64 with the provided audioUrl", async () => {
      const { service } = makeService(mockLanguageHabit);

      await service.transcribe("user-uuid-1", { audioUrl: AUDIO_URL, habitId: "habit-uuid-1" });

      expect(mockDownload).toHaveBeenCalledWith(AUDIO_URL);
    });

    it("calls transcription provider with base64 and mimeType returned by storage", async () => {
      mockDownload.mockResolvedValue({ base64: "abc123", mimeType: "audio/ogg" });
      const { service } = makeService(mockLanguageHabit);

      await service.transcribe("user-uuid-1", { audioUrl: AUDIO_URL, habitId: "habit-uuid-1" });

      expect(mockTranscribe).toHaveBeenCalledWith("abc123", "audio/ogg", expect.any(String), 500);
    });

    it("includes the habit targetSkill in the transcription prompt", async () => {
      const { service } = makeService(mockLanguageHabit);

      await service.transcribe("user-uuid-1", { audioUrl: AUDIO_URL, habitId: "habit-uuid-1" });

      const promptArg = mockTranscribe.mock.calls[0][2] as string;
      expect(promptArg).toContain("en-US");
    });

    it("returns the raw transcription output verbatim", async () => {
      mockTranscribe.mockResolvedValue("  Hello world  ");
      const { service } = makeService(mockLanguageHabit);

      const result = await service.transcribe("user-uuid-1", {
        audioUrl: AUDIO_URL,
        habitId: "habit-uuid-1",
      });

      expect(result.transcription).toBe("  Hello world  ");
    });

    it("propagates errors thrown by downloadAudioAsBase64", async () => {
      mockDownload.mockRejectedValue(new Error("Storage unreachable"));
      const { service } = makeService(mockLanguageHabit);

      await expect(
        service.transcribe("user-uuid-1", { audioUrl: AUDIO_URL, habitId: "habit-uuid-1" })
      ).rejects.toThrow("Storage unreachable");
    });

    it("propagates errors thrown by the transcription provider", async () => {
      mockTranscribe.mockRejectedValue(new Error("Transcription provider error: 500"));
      const { service } = makeService(mockLanguageHabit);

      await expect(
        service.transcribe("user-uuid-1", { audioUrl: AUDIO_URL, habitId: "habit-uuid-1" })
      ).rejects.toThrow("Transcription provider error: 500");
    });
  });
});

// ---------------------------------------------------------------------------
// createEntry — audioUrl passthrough (new field)
// ---------------------------------------------------------------------------

describe("JournalService — createEntry with audioUrl", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("passes audioUrl to journalRepo.upsert when provided", async () => {
    const { service, journalRepo } = makeService(mockLanguageHabit);

    await service.createEntry("user-uuid-1", {
      habitId: "habit-uuid-1",
      content: "Today I recorded an audio entry.",
      audioUrl: AUDIO_URL,
    });

    expect(journalRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ audioUrl: AUDIO_URL })
    );
  });

  it("passes audioUrl as null to journalRepo.upsert when not provided", async () => {
    const { service, journalRepo } = makeService(mockLanguageHabit);

    await service.createEntry("user-uuid-1", {
      habitId: "habit-uuid-1",
      content: "A text-only entry.",
    });

    expect(journalRepo.upsert).toHaveBeenCalledWith(expect.objectContaining({ audioUrl: null }));
  });
});

// ---------------------------------------------------------------------------
// listHistory — safeLimit clamping
// ---------------------------------------------------------------------------

describe("JournalService — listHistory", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("uses default limit of 100 when no limit is provided", async () => {
    const { service, journalRepo } = makeService(mockLanguageHabit);

    await service.listHistory("user-uuid-1");

    expect(journalRepo.findAllByUserId).toHaveBeenCalledWith("user-uuid-1", 100);
  });

  it("clamps limit to MAX_HISTORY_LIMIT (365)", async () => {
    const { service, journalRepo } = makeService(mockLanguageHabit);

    await service.listHistory("user-uuid-1", 9999);

    expect(journalRepo.findAllByUserId).toHaveBeenCalledWith("user-uuid-1", 365);
  });

  it("clamps limit to minimum of 1 when 0 is provided", async () => {
    const { service, journalRepo } = makeService(mockLanguageHabit);

    await service.listHistory("user-uuid-1", 0);

    expect(journalRepo.findAllByUserId).toHaveBeenCalledWith("user-uuid-1", 1);
  });

  it("clamps limit to minimum of 1 when a negative value is provided", async () => {
    const { service, journalRepo } = makeService(mockLanguageHabit);

    await service.listHistory("user-uuid-1", -10);

    expect(journalRepo.findAllByUserId).toHaveBeenCalledWith("user-uuid-1", 1);
  });

  it("uses default limit when NaN is provided", async () => {
    const { service, journalRepo } = makeService(mockLanguageHabit);

    await service.listHistory("user-uuid-1", NaN);

    expect(journalRepo.findAllByUserId).toHaveBeenCalledWith("user-uuid-1", 100);
  });

  it("truncates decimal limits", async () => {
    const { service, journalRepo } = makeService(mockLanguageHabit);

    await service.listHistory("user-uuid-1", 45.9);

    expect(journalRepo.findAllByUserId).toHaveBeenCalledWith("user-uuid-1", 45);
  });
});
