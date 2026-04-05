import { env } from "../config/env.js";
import { supabaseStorageProvider } from "./providers/supabase-storage.js";
import type { StorageProvider } from "./storage.interface.js";

export function createStorageProvider(provider: string): StorageProvider {
  switch (provider.trim()) {
    case "supabase":
      return supabaseStorageProvider;
    default:
      throw new Error(`Unknown storage provider: "${provider}". Supported: supabase`);
  }
}

let _storageInstance: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!_storageInstance) {
    _storageInstance = createStorageProvider(env.STORAGE_PROVIDER);
  }
  return _storageInstance;
}
