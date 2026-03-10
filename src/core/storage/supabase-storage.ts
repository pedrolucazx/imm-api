import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AvatarContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

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
