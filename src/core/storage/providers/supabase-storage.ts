import { createClient } from "@supabase/supabase-js";
import { env } from "../../config/env.js";
import type { StorageProvider, AvatarContentType } from "../storage.interface.js";

const ALLOWED_AVATAR_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

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

export const supabaseStorageProvider: StorageProvider = {
  isAllowedAvatarContentType(type: string): type is AvatarContentType {
    return (ALLOWED_AVATAR_CONTENT_TYPES as readonly string[]).includes(type);
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
};
