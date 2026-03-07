import { createHash } from "crypto";

// SHA256 para lookup rápido — não para armazenamento de senha
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
