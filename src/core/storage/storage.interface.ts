export type AvatarContentType = "image/jpeg" | "image/png" | "image/webp";

export interface StorageProvider {
  createAvatarUploadUrl(
    userId: string,
    contentType: AvatarContentType
  ): Promise<{ signedUrl: string; publicUrl: string; path: string }>;

  isAllowedAvatarContentType(type: string): type is AvatarContentType;
}
