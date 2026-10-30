import { describe, expect, it } from "vitest";
import { hashPassword, normalizeAuthEmail, verifyPassword } from "./auth/service";

describe("email account credentials", () => {
  it("hashes passwords and verifies only the matching secret", async () => {
    const password = "MOVA-Unique-Password-2026!";
    const encoded = await hashPassword(password);
    expect(encoded).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(encoded).not.toContain(password);
    await expect(verifyPassword(password, encoded)).resolves.toBe(true);
    await expect(verifyPassword(`${password}x`, encoded)).resolves.toBe(false);
  });

  it("rejects malformed stored hashes", async () => {
    await expect(verifyPassword("anything", "not-a-valid-hash")).resolves.toBe(false);
  });

  it("normalizes account e-mail consistently", () => {
    expect(normalizeAuthEmail("  MOVA.Tickets+Equipe@Example.COM  ")).toBe("mova.tickets+equipe@example.com");
  });
});
