export type AvatarContentType = "image/jpeg" | "image/png" | "image/webp";
export type AudioContentType = "audio/webm" | "audio/mp4" | "audio/ogg";

export interface StorageProvider {
  createAvatarUploadUrl(
    userId: string,
    contentType: AvatarContentType
  ): Promise<{ signedUrl: string; publicUrl: string; path: string }>;

  createAudioUploadUrl(
    userId: string,
    contentType: AudioContentType
  ): Promise<{ signedUrl: string; publicUrl: string; path: string }>;

  downloadAudioAsBase64(audioUrl: string): Promise<{ base64: string; mimeType: string }>;

  validateAudioOwnership(audioUrl: string, userId: string): void;

  deleteAudioFile(path: string): Promise<void>;

  isAllowedAvatarContentType(type: string): type is AvatarContentType;

  isAllowedAudioContentType(type: string): type is AudioContentType;

  readonly allowedAudioContentTypes: readonly AudioContentType[];
}
