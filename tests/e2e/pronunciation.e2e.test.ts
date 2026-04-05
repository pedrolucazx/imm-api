import request from "supertest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./helpers/app.js";
import { closeDb, getDb } from "@/core/database/connection.js";
import { habits } from "@/core/database/schema/habits.schema.js";
import { pronunciationEntries } from "@/core/database/schema/pronunciation.schema.js";
import { setupTestDatabase, type TestDatabase } from "../integration/helpers/database.js";
import { verifyEmailInDb } from "./helpers/db.js";

const mockDownload = jest.fn();
const mockTranscribe = jest.fn();

jest.mock("@/core/storage/storage.factory.js", () => ({
  getStorageProvider: jest.fn(() => ({
    downloadAudioAsBase64: mockDownload,
    createAvatarUploadUrl: jest
      .fn()
      .mockResolvedValue({ signedUrl: "url", publicUrl: "pub", path: "p" }),
    createAudioUploadUrl: jest
      .fn()
      .mockResolvedValue({ signedUrl: "url", publicUrl: "pub", path: "p" }),
    deleteAudioFile: jest.fn().mockResolvedValue(undefined),
    isAllowedAvatarContentType: jest.fn().mockReturnValue(true),
    isAllowedAudioContentType: jest.fn().mockReturnValue(true),
    allowedAudioContentTypes: ["audio/webm", "audio/mp4", "audio/ogg"],
  })),
}));

jest.mock("@/core/ai/transcription.factory.js", () => ({
  getTranscriptionProvider: jest.fn(() => ({
    transcribe: mockTranscribe,
  })),
}));

const AUDIO_URL =
  "https://fake.supabase.co/storage/v1/object/public/audio-entries/user-id/file.webm";
const ORIGINAL_TEXT = "the quick brown fox jumps over the lazy dog";

async function registerAndLogin(
  app: FastifyInstance,
  suffix: string
): Promise<{ token: string; userId: string }> {
  const email = `pronunciation-e2e-${suffix}-${Date.now()}@example.com`;
  await request(app.server)
    .post("/api/auth/register")
    .send({ email, password: "password123", name: "Pronunciation User" })
    .expect(201);

  await verifyEmailInDb(email);

  const res = await request(app.server)
    .post("/api/auth/login")
    .send({ email, password: "password123" })
    .expect(200);

  return { token: res.body.token, userId: res.body.user.id };
}

async function createLanguageHabit(app: FastifyInstance, token: string): Promise<string> {
  const res = await request(app.server)
    .post("/api/habits")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "English Practice",
      targetSkill: "en-US",
      icon: "🌍",
      color: "#4299e1",
      frequency: "daily",
      targetDays: 7,
    })
    .expect(201);
  return res.body.id;
}

async function createFitnessHabit(app: FastifyInstance, token: string): Promise<string> {
  const res = await request(app.server)
    .post("/api/habits")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Academia",
      targetSkill: "fitness",
      icon: "💪",
      color: "#48bb78",
      frequency: "daily",
      targetDays: 7,
    })
    .expect(201);
  return res.body.id;
}

describe("Pronunciation API — E2E", () => {
  let app: FastifyInstance | undefined;
  let testDb: TestDatabase | undefined;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    process.env.DATABASE_URL = testDb.connectionUri;
    app = await buildTestApp();
  }, 120000);

  beforeEach(async () => {
    mockDownload.mockResolvedValue({ base64: "fakebase64==", mimeType: "audio/webm" });
    mockTranscribe.mockResolvedValue(ORIGINAL_TEXT);

    const db = getDb();
    await db.delete(pronunciationEntries);
    await db.delete(habits);
  });

  afterAll(async () => {
    try {
      if (app) await app.close();
    } finally {
      await closeDb();
      if (testDb) await testDb.teardown();
    }
  });

  // -------------------------------------------------------------------
  // POST /api/pronunciation/analyze
  // -------------------------------------------------------------------

  describe("POST /api/pronunciation/analyze", () => {
    it("returns 401 without token", async () => {
      await request(app!.server)
        .post("/api/pronunciation/analyze")
        .send({
          habitId: "00000000-0000-0000-0000-000000000000",
          audioUrl: AUDIO_URL,
          originalText: ORIGINAL_TEXT,
        })
        .expect(401);
    });

    it("returns 404 when habitId does not exist", async () => {
      const { token } = await registerAndLogin(app!, "analyze-404");
      const res = await request(app!.server)
        .post("/api/pronunciation/analyze")
        .set("Authorization", `Bearer ${token}`)
        .send({
          habitId: "00000000-0000-0000-0000-000000000000",
          audioUrl: AUDIO_URL,
          originalText: ORIGINAL_TEXT,
        })
        .expect(404);

      expect(res.body.error).toMatch(/not found/i);
    });

    it("returns 400 when habit is not a language habit", async () => {
      const { token } = await registerAndLogin(app!, "analyze-400");
      const habitId = await createFitnessHabit(app!, token);

      const res = await request(app!.server)
        .post("/api/pronunciation/analyze")
        .set("Authorization", `Bearer ${token}`)
        .send({ habitId, audioUrl: AUDIO_URL, originalText: ORIGINAL_TEXT })
        .expect(400);

      expect(res.body.error).toMatch(/language/i);
    });

    it("returns 201 with analysis result on happy path", async () => {
      const { token } = await registerAndLogin(app!, "analyze-201");
      const habitId = await createLanguageHabit(app!, token);

      mockTranscribe.mockResolvedValue("the quick brown fox jumps over the lazy dog");

      const res = await request(app!.server)
        .post("/api/pronunciation/analyze")
        .set("Authorization", `Bearer ${token}`)
        .send({ habitId, audioUrl: AUDIO_URL, originalText: ORIGINAL_TEXT })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.transcription).toBe("the quick brown fox jumps over the lazy dog");
      expect(res.body.score).toBe(1);
      expect(res.body.missedWords).toHaveLength(0);
      expect(res.body.correctWords.length).toBeGreaterThan(0);
      expect(res.body.extraWords).toHaveLength(0);
    });

    it("persists the entry in pronunciation_entries", async () => {
      const { token, userId } = await registerAndLogin(app!, "analyze-persist");
      const habitId = await createLanguageHabit(app!, token);

      mockTranscribe.mockResolvedValue("the quick brown fox");

      await request(app!.server)
        .post("/api/pronunciation/analyze")
        .set("Authorization", `Bearer ${token}`)
        .send({ habitId, audioUrl: AUDIO_URL, originalText: ORIGINAL_TEXT })
        .expect(201);

      const db = getDb();
      const entries = await db.select().from(pronunciationEntries);
      expect(entries).toHaveLength(1);
      expect(entries[0].habitId).toBe(habitId);
      expect(entries[0].userId).toBe(userId);
      expect(entries[0].transcription).toBe("the quick brown fox");
      expect(entries[0].missedWords).toContain("jumps");
    });

    it("does not allow accessing another user's habit", async () => {
      const { token: token1 } = await registerAndLogin(app!, "analyze-owner1");
      const { token: token2 } = await registerAndLogin(app!, "analyze-owner2");
      const habitIdOfUser1 = await createLanguageHabit(app!, token1);

      await request(app!.server)
        .post("/api/pronunciation/analyze")
        .set("Authorization", `Bearer ${token2}`)
        .send({ habitId: habitIdOfUser1, audioUrl: AUDIO_URL, originalText: ORIGINAL_TEXT })
        .expect(404);
    });
  });

  // -------------------------------------------------------------------
  // GET /api/pronunciation/word-cloud
  // -------------------------------------------------------------------

  describe("GET /api/pronunciation/word-cloud", () => {
    it("returns 401 without token", async () => {
      await request(app!.server)
        .get("/api/pronunciation/word-cloud?habitId=00000000-0000-0000-0000-000000000000")
        .expect(401);
    });

    it("returns 404 when habitId does not exist", async () => {
      const { token } = await registerAndLogin(app!, "wc-404");

      await request(app!.server)
        .get("/api/pronunciation/word-cloud?habitId=00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
    });

    it("returns empty array when no pronunciation entries exist", async () => {
      const { token } = await registerAndLogin(app!, "wc-empty");
      const habitId = await createLanguageHabit(app!, token);

      const res = await request(app!.server)
        .get(`/api/pronunciation/word-cloud?habitId=${habitId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it("returns word cloud sorted by frequency after analysis", async () => {
      const { token } = await registerAndLogin(app!, "wc-populated");
      const habitId = await createLanguageHabit(app!, token);

      // First entry: misses "jumps", "over", "the", "lazy", "dog"
      mockTranscribe.mockResolvedValueOnce("the quick brown fox");
      await request(app!.server)
        .post("/api/pronunciation/analyze")
        .set("Authorization", `Bearer ${token}`)
        .send({ habitId, audioUrl: AUDIO_URL, originalText: ORIGINAL_TEXT })
        .expect(201);

      // Second entry: misses "jumps", "over", "lazy", "dog" — "jumps" missed twice
      mockTranscribe.mockResolvedValueOnce("the quick brown fox the");
      await request(app!.server)
        .post("/api/pronunciation/analyze")
        .set("Authorization", `Bearer ${token}`)
        .send({ habitId, audioUrl: AUDIO_URL, originalText: ORIGINAL_TEXT })
        .expect(201);

      const res = await request(app!.server)
        .get(`/api/pronunciation/word-cloud?habitId=${habitId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty("word");
      expect(res.body[0]).toHaveProperty("frequency");
      // Most missed word should appear first (highest frequency)
      const frequencies = res.body.map((item: { frequency: number }) => item.frequency);
      expect(frequencies).toEqual([...frequencies].sort((a, b) => b - a));
    });
  });

  // -------------------------------------------------------------------
  // GET /api/analytics/summary — wordCloud field
  // -------------------------------------------------------------------

  describe("GET /api/analytics/summary — wordCloud", () => {
    it("returns wordCloud: null for non-language habits", async () => {
      const { token } = await registerAndLogin(app!, "analytics-wc-null");
      await createFitnessHabit(app!, token);

      const res = await request(app!.server)
        .get("/api/analytics/summary")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const fitnessHabit = res.body.habits.find(
        (h: { targetSkill: string }) => h.targetSkill === "fitness"
      );
      expect(fitnessHabit).toBeDefined();
      expect(fitnessHabit.wordCloud).toBeNull();
    });

    it("returns wordCloud: [] for language habits with no pronunciation entries", async () => {
      const { token } = await registerAndLogin(app!, "analytics-wc-empty");
      await createLanguageHabit(app!, token);

      const res = await request(app!.server)
        .get("/api/analytics/summary")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const langHabit = res.body.habits.find(
        (h: { targetSkill: string }) => h.targetSkill === "en-US"
      );
      expect(langHabit).toBeDefined();
      expect(langHabit.wordCloud).toEqual([]);
    });

    it("returns wordCloud populated after pronunciation analysis", async () => {
      const { token } = await registerAndLogin(app!, "analytics-wc-data");
      const habitId = await createLanguageHabit(app!, token);

      mockTranscribe.mockResolvedValue("the quick brown fox");
      await request(app!.server)
        .post("/api/pronunciation/analyze")
        .set("Authorization", `Bearer ${token}`)
        .send({ habitId, audioUrl: AUDIO_URL, originalText: ORIGINAL_TEXT })
        .expect(201);

      const res = await request(app!.server)
        .get("/api/analytics/summary")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const langHabit = res.body.habits.find(
        (h: { targetSkill: string }) => h.targetSkill === "en-US"
      );
      expect(langHabit.wordCloud.length).toBeGreaterThan(0);
      expect(langHabit.wordCloud[0]).toHaveProperty("word");
      expect(langHabit.wordCloud[0]).toHaveProperty("frequency");
    });
  });
});
