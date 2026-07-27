import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import jwt from "jsonwebtoken";

const s3 = new S3Client({ region: process.env.AWS_REGION });
const ssm = new SSMClient({ region: process.env.AWS_REGION });
const ALLOWED_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Lido uma vez no cold start e cacheado em memória entre invocações warm —
// não bate no SSM a cada request.
let jwtSecretPromise;
function getJwtSecret() {
  if (!jwtSecretPromise) {
    jwtSecretPromise = ssm
      .send(new GetParameterCommand({ Name: "/imm/production/JWT_SECRET", WithDecryption: true }))
      .then((res) => res.Parameter.Value);
  }
  return jwtSecretPromise;
}

// Pura (sem AWS SDK) — testável isolada. Nunca confia em userId de fora:
// deriva de um JWT verificado. Refresh token tem { type: "refresh" } no
// payload (ver token.ts do imm-api) — só access token gera upload URL.
export function verifyAccessToken(token, secret) {
  const payload = jwt.verify(token, secret);
  if (payload.type === "refresh") {
    throw new Error("refresh token cannot be used here");
  }
  return payload.id; // mesmo campo que generateTokens() usa no imm-api
}

export const handler = async (event) => {
  const authHeader = event.headers?.authorization ?? event.headers?.Authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: "Token ausente" }) };
  }

  let userId;
  try {
    const secret = await getJwtSecret();
    userId = verifyAccessToken(token, secret);
  } catch {
    return { statusCode: 401, body: JSON.stringify({ error: "Token inválido ou expirado" }) };
  }

  const { contentType } = JSON.parse(event.body ?? "{}");
  if (!ALLOWED_TYPES[contentType]) {
    return { statusCode: 422, body: JSON.stringify({ error: "contentType (jpeg/png/webp) obrigatório" }) };
  }

  // key fixa por usuário — novo upload sobrescreve o antigo, sem órfão
  const key = `avatars/${userId}.${ALLOWED_TYPES[contentType]}`;

  const command = new PutObjectCommand({
    Bucket: process.env.S3_AVATARS_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const signedUrl = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 min pra completar o upload
  const publicUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`;

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signedUrl, publicUrl }),
  };
};
