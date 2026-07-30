import { test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { verifyAccessToken } from "./index.mjs";

const SECRET = "test-secret";

test("valid access token returns the userId", () => {
  const token = jwt.sign({ id: "user-1", email: "a@b.com" }, SECRET, { expiresIn: "1h" });
  assert.equal(verifyAccessToken(token, SECRET), "user-1");
});

test("expired token is rejected", () => {
  const token = jwt.sign({ id: "user-1" }, SECRET, { expiresIn: -1 });
  assert.throws(() => verifyAccessToken(token, SECRET));
});

test("token signed with a different secret is rejected", () => {
  const token = jwt.sign({ id: "user-1" }, "wrong-secret", { expiresIn: "1h" });
  assert.throws(() => verifyAccessToken(token, SECRET));
});

test("refresh token cannot be used to get an upload URL", () => {
  const token = jwt.sign({ id: "user-1", type: "refresh" }, SECRET, { expiresIn: "1h" });
  assert.throws(() => verifyAccessToken(token, SECRET));
});

test("token without a subject (id) is rejected", () => {
  const token = jwt.sign({ email: "a@b.com" }, SECRET, { expiresIn: "1h" });
  assert.throws(() => verifyAccessToken(token, SECRET));
});

// Regressão dos dois bugs bloqueantes achados na revisão: o presigner tem
// que assinar content-type/content-length (senão o upload real com bytes
// de verdade sempre falha com BadDigest, e o S3 aceita qualquer tipo/tamanho
// vindo do browser). Roda sem rede — getSignedUrl é cálculo local.
test("presigned URL signs content-type and content-length, no checksum param", async () => {
  const s3 = new S3Client({
    region: "us-east-1",
    requestChecksumCalculation: "WHEN_REQUIRED",
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
  });
  const command = new PutObjectCommand({
    Bucket: "bucket",
    Key: "avatars/user-1.png",
    ContentType: "image/png",
    ContentLength: 1024,
  });
  const url = await getSignedUrl(s3, command, {
    expiresIn: 300,
    signableHeaders: new Set(["content-type", "content-length"]),
  });
  const params = new URL(url).searchParams;

  assert.equal(params.get("X-Amz-SignedHeaders"), "content-length;content-type;host");
  assert.equal(params.has("x-amz-checksum-crc32"), false);
});
