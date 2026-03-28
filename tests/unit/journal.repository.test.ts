import { createJournalRepository } from "@/modules/journal/journal.repository.js";
import type { DrizzleDb } from "@/core/database/connection.js";
import type { JournalEntry } from "@/core/database/schema/index.js";

const baseEntry: JournalEntry = {
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
  audioUrl: "https://fake.supabase.co/storage/v1/object/public/audio-entries/user/file.webm",
  createdAt: new Date("2026-03-28"),
  updatedAt: new Date("2026-03-28"),
};

// ---------------------------------------------------------------------------
// upsert — audioUrl handling
// ---------------------------------------------------------------------------

describe("JournalRepository — upsert", () => {
  it("persists audioUrl in the SET clause when updating an existing entry", async () => {
    const mockUpdate = jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([baseEntry]),
        }),
      }),
    });

    const mockDb = { update: mockUpdate } as unknown as DrizzleDb;
    const repo = createJournalRepository(mockDb);

    const audioUrl =
      "https://fake.supabase.co/storage/v1/object/public/audio-entries/user/file.webm";

    await repo.upsert({
      ...baseEntry,
      existingId: "entry-uuid-1",
      audioUrl,
    });

    const setCall = mockUpdate.mock.results[0].value.set as jest.Mock;
    const setPayload = setCall.mock.calls[0][0];
    expect(setPayload).toHaveProperty("audioUrl", audioUrl);
  });

  it("sets audioUrl to null in the SET clause when audioUrl is not provided (update path)", async () => {
    const mockUpdate = jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ ...baseEntry, audioUrl: null }]),
        }),
      }),
    });

    const mockDb = { update: mockUpdate } as unknown as DrizzleDb;
    const repo = createJournalRepository(mockDb);

    await repo.upsert({
      ...baseEntry,
      existingId: "entry-uuid-1",
      audioUrl: undefined,
    });

    const setCall = mockUpdate.mock.results[0].value.set as jest.Mock;
    const setPayload = setCall.mock.calls[0][0];
    expect(setPayload).toHaveProperty("audioUrl", null);
  });

  it("inserts with audioUrl when creating a new entry (insert path)", async () => {
    const mockInsert = jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([baseEntry]),
      }),
    });

    const mockDb = { insert: mockInsert } as unknown as DrizzleDb;
    const repo = createJournalRepository(mockDb);

    const audioUrl =
      "https://fake.supabase.co/storage/v1/object/public/audio-entries/user/file.webm";

    await repo.upsert({ ...baseEntry, audioUrl });

    const valuesCall = mockInsert.mock.results[0].value.values as jest.Mock;
    const insertPayload = valuesCall.mock.calls[0][0];
    expect(insertPayload).toHaveProperty("audioUrl", audioUrl);
  });

  it("takes the update path when existingId is provided", async () => {
    const mockUpdate = jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([baseEntry]),
        }),
      }),
    });
    const mockInsert = jest.fn();
    const mockDb = { update: mockUpdate, insert: mockInsert } as unknown as DrizzleDb;
    const repo = createJournalRepository(mockDb);

    await repo.upsert({ ...baseEntry, existingId: "entry-uuid-1" });

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("takes the insert path when existingId is absent", async () => {
    const mockUpdate = jest.fn();
    const mockInsert = jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([baseEntry]),
      }),
    });
    const mockDb = { update: mockUpdate, insert: mockInsert } as unknown as DrizzleDb;
    const repo = createJournalRepository(mockDb);

    await repo.upsert({ ...baseEntry });

    expect(mockInsert).toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
