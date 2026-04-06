import { createClient } from "@supabase/supabase-js";
import { env } from "../../config/env.js";
import type { StorageProvider, AvatarContentType, AudioContentType } from "../storage.interface.js";

const ALLOWED_AVATAR_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const ALLOWED_AUDIO_CONTENT_TYPES = ["audio/webm", "audio/mp4", "audio/ogg"] as const;

const AUDIO_EXT_MAP: Record<AudioContentType, string> = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/ogg": "ogg",
};

const AVATAR_EXT_MAP: Record<AvatarContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!supabaseClient) {
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when STORAGE_PROVIDER=supabase"
      );
    }
    supabaseClient = createClient(url, key, { auth: { persistSession: false } });
  }
  return supabaseClient;
}

function extractAudioFilePath(audioUrl: string, supabaseUrl: string, bucket: string): string {
  const url = new URL(audioUrl);
  const expectedHostname = new URL(supabaseUrl).hostname;
  if (url.hostname !== expectedHostname) {
    throw new Error(
      `Unauthorized audio origin: URL hostname "${url.hostname}" does not match configured Supabase project`
    );
  }

  const canonicalPrefix = `/storage/v1/object/public/${bucket}/`;
  if (!url.pathname.startsWith(canonicalPrefix)) {
    throw new Error(`Invalid audio URL format`);
  }

  return url.pathname.slice(canonicalPrefix.length);
}

export const supabaseStorageProvider: StorageProvider = {
  allowedAudioContentTypes: ALLOWED_AUDIO_CONTENT_TYPES,

  isAllowedAvatarContentType(type: string): type is AvatarContentType {
    return (ALLOWED_AVATAR_CONTENT_TYPES as readonly string[]).includes(type);
  },

  isAllowedAudioContentType(type: string): type is AudioContentType {
    return (ALLOWED_AUDIO_CONTENT_TYPES as readonly string[]).includes(type);
  },

  async createAvatarUploadUrl(userId: string, contentType: AvatarContentType) {
    const supabase = getClient();
    const ext = AVATAR_EXT_MAP[contentType];
    const path = `${userId}/${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
      .from(env.SUPABASE_STORAGE_BUCKET)
      .createSignedUploadUrl(path, { upsert: true });

    if (error || !data) {
      throw new Error(`Failed to create signed upload URL: ${error?.message}`);
    }

    const publicUrl = `${env.SUPABASE_URL}/storage/v1/object/public/${env.SUPABASE_STORAGE_BUCKET}/${path}`;
    return { signedUrl: data.signedUrl, publicUrl, path };
  },

  async createAudioUploadUrl(userId: string, contentType: AudioContentType) {
    const supabase = getClient();
    const ext = AUDIO_EXT_MAP[contentType];
    const randomSuffix = Math.random().toString(36).slice(2, 10);
    const path = `${userId}/${Date.now()}-${randomSuffix}.${ext}`;

    const { data, error } = await supabase.storage
      .from(env.SUPABASE_AUDIO_BUCKET)
      .createSignedUploadUrl(path, { upsert: false });

    if (error || !data) {
      throw new Error(`Failed to create audio signed upload URL: ${error?.message}`);
    }

    const publicUrl = `${env.SUPABASE_URL}/storage/v1/object/public/${env.SUPABASE_AUDIO_BUCKET}/${path}`;
    return { signedUrl: data.signedUrl, publicUrl, path };
  },

  validateAudioOwnership(audioUrl: string, userId: string): void {
    if (!env.SUPABASE_URL) {
      throw new Error("SUPABASE_URL is required when STORAGE_PROVIDER=supabase");
    }
    const filePath = extractAudioFilePath(audioUrl, env.SUPABASE_URL, env.SUPABASE_AUDIO_BUCKET);
    const ownerId = filePath.split("/")[0];
    if (ownerId !== userId) {
      throw new Error(`Audio file does not belong to the authenticated user`);
    }
  },

  async deleteAudioFile(path: string) {
    const supabase = getClient();
    const { error } = await supabase.storage.from(env.SUPABASE_AUDIO_BUCKET).remove([path]);
    if (error) {
      throw new Error(`Failed to delete audio file: ${error.message}`);
    }
  },

  async downloadAudioAsBase64(audioUrl: string) {
    const supabase = getClient();
    const filePath = extractAudioFilePath(audioUrl, env.SUPABASE_URL!, env.SUPABASE_AUDIO_BUCKET);

    const { data, error } = await supabase.storage
      .from(env.SUPABASE_AUDIO_BUCKET)
      .createSignedUrl(filePath, 60);
    if (error || !data) {
      throw new Error(`Failed to create signed download URL: ${error?.message}`);
    }

    const downloadController = new AbortController();
    const downloadTimeout = setTimeout(() => downloadController.abort(), 30_000);
    let response: Response;
    try {
      response = await fetch(data.signedUrl, { signal: downloadController.signal });
    } finally {
      clearTimeout(downloadTimeout);
    }

    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`);
    }

    const rawContentType = response.headers.get("content-type");
    if (!rawContentType) {
      throw new Error("Failed to download audio: content-type header is missing");
    }
    const mimeType = rawContentType.split(";")[0].trim();
    if (!this.isAllowedAudioContentType(mimeType)) {
      throw new Error(`Unsupported audio mimeType: ${mimeType}`);
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    return { base64, mimeType };
  },
};
