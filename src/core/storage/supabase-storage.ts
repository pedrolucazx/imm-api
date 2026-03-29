import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AvatarContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

export const ALLOWED_AUDIO_CONTENT_TYPES = ["audio/webm", "audio/mp4", "audio/ogg"] as const;
export type AudioContentType = (typeof ALLOWED_AUDIO_CONTENT_TYPES)[number];

const AUDIO_EXT_MAP: Record<AudioContentType, string> = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/ogg": "ogg",
};

const EXT_MAP: Record<AvatarContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  }
  return supabaseClient;
}

export function isAllowedContentType(contentType: string): contentType is AvatarContentType {
  return (ALLOWED_CONTENT_TYPES as readonly string[]).includes(contentType);
}

export function isAllowedAudioContentType(contentType: string): contentType is AudioContentType {
  return (ALLOWED_AUDIO_CONTENT_TYPES as readonly string[]).includes(contentType);
}

export async function createAvatarSignedUploadUrl(userId: string, contentType: AvatarContentType) {
  const supabase = getSupabaseClient();
  const ext = EXT_MAP[contentType];
  const path = `${userId}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });

  if (error || !data) {
    throw new Error(`Failed to create signed upload URL: ${error?.message}`);
  }

  const publicUrl = `${env.SUPABASE_URL}/storage/v1/object/public/${env.SUPABASE_STORAGE_BUCKET}/${path}`;

  return { signedUrl: data.signedUrl, publicUrl, path };
}

export async function createAudioSignedUploadUrl(userId: string, contentType: AudioContentType) {
  const supabase = getSupabaseClient();
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
}

export async function deleteAudioFile(path: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(env.SUPABASE_AUDIO_BUCKET).remove([path]);
  if (error) {
    throw new Error(`Failed to delete audio file: ${error.message}`);
  }
}

export async function downloadAudioAsBase64(
  audioUrl: string
): Promise<{ base64: string; mimeType: string }> {
  const supabase = getSupabaseClient();
  const bucket = env.SUPABASE_AUDIO_BUCKET;

  const url = new URL(audioUrl);
  const expectedHostname = new URL(env.SUPABASE_URL).hostname;
  if (url.hostname !== expectedHostname) {
    throw new Error(
      `Unauthorized audio origin: URL hostname "${url.hostname}" does not match configured Supabase project`
    );
  }

  const marker = `/${bucket}/`;
  const markerIndex = url.pathname.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Invalid audio URL: cannot find bucket "${bucket}" in path`);
  }
  const filePath = url.pathname.slice(markerIndex + marker.length);

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, 60);
  if (error || !data) {
    throw new Error(`Failed to create signed download URL: ${error?.message}`);
  }

  const response = await fetch(data.signedUrl);
  if (!response.ok) {
    throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") ?? "audio/webm";
  const mimeType = contentType.split(";")[0].trim();
  if (!isAllowedAudioContentType(mimeType)) {
    throw new Error(`Unsupported audio mimeType: ${mimeType}`);
  }

  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  return { base64, mimeType };
}
