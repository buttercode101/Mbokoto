import { describe, expect, it } from "vitest";
import { createDeviceIdentity, publicKeyFingerprint, signBytes, verifyBytes } from "@/lib/identity";

describe("device signing identity", () => {
  it("creates unique Ed25519 identities with stable public fingerprints", () => {
    const a = createDeviceIdentity();
    const b = createDeviceIdentity();
    expect(a.publicKey).not.toBe(b.publicKey);
    expect(a.secretKey).not.toBe(b.secretKey);
    expect(a.fingerprint).toBe(publicKeyFingerprint(a.publicKey));
    expect(a.fingerprint).toMatch(/^SEN-[0-9A-F]{8}$/);
  });

  it("rejects modified messages and signatures", () => {
    const identity = createDeviceIdentity();
    const message = "mbokoto-test";
    const signature = signBytes(message, identity.secretKey);
    expect(verifyBytes(message, signature, identity.publicKey)).toBe(true);
    expect(verifyBytes(message + "x", signature, identity.publicKey)).toBe(false);
  });
});
