import { test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
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
