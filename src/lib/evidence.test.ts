import { describe, expect, it } from "vitest";
import { openEvidence, sealEvidence } from "@/lib/evidence";

describe("evidence encryption boundary", () => {
  const key = new Uint8Array(32).fill(7);

  it("encrypts bytes and recovers the exact original", () => {
    const original = new TextEncoder().encode("original incident evidence");
    const sealed = sealEvidence(original, key);
    expect(sealed.ciphertext).not.toEqual(original);
    expect(sealed.nonce).toHaveLength(24);
    expect(sealed.hash).toHaveLength(16);
    expect(new TextDecoder().decode(openEvidence(sealed, key))).toBe("original incident evidence");
  });

  it("rejects a wrong key", () => {
    const sealed = sealEvidence(new TextEncoder().encode("secret"), key);
    expect(() => openEvidence(sealed, new Uint8Array(32).fill(8))).toThrow();
  });
});
