import { describe, expect, it } from "vitest";
import { sdk } from "./_core/sdk";

describe("versioned application sessions", () => {
  it("stores and verifies the email password-session version", async () => {
    const token = await sdk.createSessionToken("email-user", {
      name: "Conta de teste",
      expiresInMs: 60_000,
      authMethod: "email",
      passwordSessionVersion: 3,
    });
    await expect(sdk.verifySession(token)).resolves.toMatchObject({
      openId: "email-user",
      authMethod: "email",
      passwordSessionVersion: 3,
    });
  });

  it("preserves legacy Manus/Preview tokens without auth claims", async () => {
    const token = await sdk.createSessionToken("manus-user", { name: "Conta Manus", expiresInMs: 60_000 });
    const decoded = await sdk.verifySession(token);
    expect(decoded).toMatchObject({ openId: "manus-user", name: "Conta Manus" });
    expect(decoded?.authMethod).toBeUndefined();
  });

  it("rejects malformed email session tokens that omit the version", async () => {
    const token = await sdk.createSessionToken("email-user", {
      name: "Conta de teste",
      expiresInMs: 60_000,
      authMethod: "email",
    });
    await expect(sdk.verifySession(token)).resolves.toBeNull();
  });
});
