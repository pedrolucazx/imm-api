import { GeminiTranscriptionProvider } from "@/core/ai/providers/gemini-transcription.js";

function mockFetchOnce(responseBody: unknown, status = 200) {
  return jest.fn().mockResolvedValue({
    ok: status < 300,
    status,
    json: () => Promise.resolve(responseBody),
    text: () => Promise.resolve(JSON.stringify(responseBody)),
  });
}

function getSentMimeType(fetchMock: jest.Mock): string {
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  return body.contents[0].parts[0].inlineData.mimeType;
}

const geminiOkResponse = { candidates: [{ content: { parts: [{ text: "hello world" }] } }] };

describe("GeminiTranscriptionProvider — mimeType mapping", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it.each([
    ["audio/webm", "video/webm"],
    ["audio/mp4", "video/mp4"],
    ["audio/ogg", "audio/ogg"],
  ])(
    "sends %s to Gemini as %s (Gemini's inline audio input rejects webm/mp4 with 400)",
    async (recordedMimeType, expectedGeminiMimeType) => {
      const fetchMock = mockFetchOnce(geminiOkResponse);
      global.fetch = fetchMock as unknown as typeof fetch;

      const provider = new GeminiTranscriptionProvider();
      await provider.transcribe("ZmFrZQ==", recordedMimeType, "transcribe this", 500);

      expect(getSentMimeType(fetchMock)).toBe(expectedGeminiMimeType);
    }
  );
});
