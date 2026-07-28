import type { FastifyRequest } from "fastify";
import { BadRequestError, PayloadTooLargeError, TooManyRequestsError } from "../errors/index.js";

const ALLOWED_AUDIO_MIME_TYPES = new Set(["audio/webm", "audio/mp4", "audio/ogg"]);
const MAX_AUDIO_WAITERS = 4;
let audioBusy = false;
const audioWaiters: Array<() => void> = [];

export type ParsedAudioMultipart = {
  buffer: Buffer;
  mimeType: string;
  fields: Record<string, string>;
};

function isFileTooLarge(error: unknown): boolean {
  return (error as { code?: string })?.code === "FST_REQ_FILE_TOO_LARGE";
}

function hasAudioSignature(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "audio/webm")
    return buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (mimeType === "audio/ogg") return buffer.subarray(0, 4).toString("ascii") === "OggS";
  if (mimeType === "audio/mp4") return buffer.subarray(4, 8).toString("ascii") === "ftyp";
  return false;
}

export async function runWithAudioSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (audioBusy) {
    if (audioWaiters.length >= MAX_AUDIO_WAITERS) {
      throw new TooManyRequestsError("Too many audio uploads in progress");
    }
    await new Promise<void>((resolve) => audioWaiters.push(resolve));
  }
  // ponytail: global audio lock; replace with per-instance queue if audio throughput matters.
  audioBusy = true;
  try {
    return await fn();
  } finally {
    const next = audioWaiters.shift();
    if (next) next();
    else audioBusy = false;
  }
}

// Fields must be sent before the audio part in the multipart body — busboy
// parses serially, so data.fields only reflects parts already consumed.
export async function parseAudioMultipart(request: FastifyRequest): Promise<ParsedAudioMultipart> {
  let data;
  try {
    data = await request.file();
  } catch (error) {
    if (isFileTooLarge(error)) throw new PayloadTooLargeError("Audio file exceeds maximum size");
    throw new BadRequestError("Multipart audio upload is required");
  }
  if (!data) throw new BadRequestError("Audio file is required");
  if (data.fieldname !== "audio") throw new BadRequestError("Audio field must be named audio");
  if (!ALLOWED_AUDIO_MIME_TYPES.has(data.mimetype)) {
    throw new BadRequestError("Unsupported audio content type");
  }

  let buffer: Buffer;
  try {
    buffer = await data.toBuffer();
  } catch (error) {
    if (isFileTooLarge(error)) throw new PayloadTooLargeError("Audio file exceeds maximum size");
    throw new BadRequestError("Invalid audio file");
  }
  if (!hasAudioSignature(buffer, data.mimetype)) throw new BadRequestError("Invalid audio file");

  const fields: Record<string, string> = {};
  for (const [key, part] of Object.entries(data.fields)) {
    const field = Array.isArray(part) ? part[0] : part;
    if (field?.type === "field" && typeof field.value === "string") {
      fields[key] = field.value;
    }
  }

  return { buffer, mimeType: data.mimetype, fields };
}
