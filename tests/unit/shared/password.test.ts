import { hashPassword, comparePassword } from "@/shared/utils/password.js";

jest.setTimeout(30000);

describe("hashPassword", () => {
  it("returns a bcrypt hash string", async () => {
    const hash = await hashPassword("mypassword");
    expect(typeof hash).toBe("string");
    expect(hash).toMatch(/^\$2[ab]\$\d+\$/);
  });

  it("returns different hashes for the same input (salt)", async () => {
    const hash1 = await hashPassword("same");
    const hash2 = await hashPassword("same");
    expect(hash1).not.toBe(hash2);
  });
});

describe("comparePassword", () => {
  it("returns true when password matches hash", async () => {
    const hash = await hashPassword("correct");
    const result = await comparePassword("correct", hash);
    expect(result).toBe(true);
  });

  it("returns false when password does not match hash", async () => {
    const hash = await hashPassword("correct");
    const result = await comparePassword("wrong", hash);
    expect(result).toBe(false);
  });
});
