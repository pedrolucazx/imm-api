import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import jwt from "jsonwebtoken";

// WHEN_REQUIRED: sem isso, o SDK embute o checksum de um corpo VAZIO na URL
// assinada (calculado antes do PUT real acontecer) — o upload real, com bytes
// de verdade, sempre bate BadDigest contra esse checksum errado.
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  requestChecksumCalculation: "WHEN_REQUIRED",
});
const ssm = new SSMClient({ region: process.env.AWS_REGION });
const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const MAX_CONTENT_LENGTH = 5 * 1024 * 1024; // 5 MB — generoso pra foto de perfil

// Lido uma vez no cold start e cacheado em memória entre invocações warm —
// não bate no SSM a cada request. Se a promise rejeitar, NÃO fica cacheada
// (reset no catch) — um erro transitório do SSM não deve travar o container
// inteiro em "sem segredo" pra sempre; a próxima invocação tenta de novo.
let jwtSecretPromise;
function getJwtSecret() {
  if (!jwtSecretPromise) {
    jwtSecretPromise = ssm
      .send(new GetParameterCommand({ Name: "/imm/production/JWT_SECRET", WithDecryption: true }))
      .then((res) => res.Parameter.Value)
      .catch((err) => {
        jwtSecretPromise = undefined;
        throw err;
      });
  }
  return jwtSecretPromise;
}

// Pura (sem AWS SDK) — testável isolada. Nunca confia em userId de fora:
// deriva de um JWT verificado. Refresh token tem { type: "refresh" } no
// payload (ver token.ts do imm-api) — só access token gera upload URL.
export function verifyAccessToken(token, secret) {
  const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
  if (payload.type === "refresh") {
    throw new Error("refresh token cannot be used here");
  }
  if (!payload.id) {
    throw new Error("token missing subject");
  }
  return payload.id; // mesmo campo que generateTokens() usa no imm-api
}

export const handler = async (event) => {
  const authHeader = event.headers?.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: "Token ausente" }) };
  }

  // Falha de infra (SSM fora do ar) é 503 + log — não é a mesma coisa que
  // "usuário mandou token inválido", e sem log não dá pra distinguir os dois
  // numa Function URL pública sem auth IAM.
  let secret;
  try {
    secret = await getJwtSecret();
  } catch (err) {
    console.error("Failed to load JWT secret from SSM", err);
    return { statusCode: 503, body: JSON.stringify({ error: "Serviço indisponível" }) };
  }

  let userId;
  try {
    userId = verifyAccessToken(token, secret);
  } catch {
    return { statusCode: 401, body: JSON.stringify({ error: "Token inválido ou expirado" }) };
  }

  let body;
  try {
    body = JSON.parse(
      event.isBase64Encoded
        ? Buffer.from(event.body ?? "", "base64").toString("utf8")
        : (event.body ?? "{}")
    );
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Corpo da requisição inválido" }) };
  }

  const { contentType, contentLength } = body ?? {};
  const ext = ALLOWED_TYPES.get(contentType);
  if (!ext) {
    return {
      statusCode: 422,
      body: JSON.stringify({ error: "contentType (jpeg/png/webp) obrigatório" }),
    };
  }
  if (
    !Number.isInteger(contentLength) ||
    contentLength <= 0 ||
    contentLength > MAX_CONTENT_LENGTH
  ) {
    return {
      statusCode: 422,
      body: JSON.stringify({
        error: `contentLength deve ser entre 1 e ${MAX_CONTENT_LENGTH} bytes`,
      }),
    };
  }

  // key fixa por usuário — novo upload sobrescreve o antigo, sem órfão
  const key = `avatars/${userId}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: process.env.S3_AVATARS_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });

  let signedUrl;
  try {
    // content-type e content-length precisam entrar em signableHeaders — por
    // padrão o presigner só assina "host", então sem isso o S3 aceitaria
    // qualquer content-type/tamanho no PUT real, tornando a validação acima
    // inútil (o browser pode mandar o header que quiser).
    signedUrl = await getSignedUrl(s3, command, {
      expiresIn: 300, // 5 min pra completar o upload
      signableHeaders: new Set(["content-type", "content-length"]),
    });
  } catch (err) {
    console.error("Failed to generate presigned URL", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Falha ao gerar URL de upload" }) };
  }

  const publicUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`;

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      signedUrl,
      publicUrl,
      requiredHeaders: { "Content-Type": contentType, "Content-Length": contentLength },
    }),
  };
};
