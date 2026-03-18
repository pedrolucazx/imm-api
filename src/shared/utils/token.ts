import { createHash, randomBytes } from "crypto";
import { ACCESS_TOKEN_EXPIRES, REFRESH_TOKEN_EXPIRES } from "../constants.js";
import type { JwtSignFn } from "../../modules/auth/auth.types.js";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateTokens(
  jwt: JwtSignFn,
  user: { id: string; email: string }
): { accessToken: string; refreshToken: string } {
  const nonce = randomBytes(16).toString("hex");
  const accessToken = jwt({ id: user.id, email: user.email }, { expiresIn: ACCESS_TOKEN_EXPIRES });
  const refreshToken = jwt(
    { id: user.id, type: "refresh", nonce },
    { expiresIn: REFRESH_TOKEN_EXPIRES }
  );

  return { accessToken, refreshToken };
}
