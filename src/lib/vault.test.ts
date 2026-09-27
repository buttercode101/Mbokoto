import { describe, expect, it } from "vitest";
import { createVault, unlockVault, type VaultPayload } from "@/lib/vault";
import { emptyProfile } from "@/lib/protocol";
import { createDeviceIdentity } from "@/lib/identity";

const payload: VaultPayload = {
  profile: { ...emptyProfile(), displayName: "Test User", setupComplete: true },
  contacts: [], nodes: [], cases: [], evidence: [], events: [], buffer: [], custody: [], log: [],
  network: { cellular: "down", ble: false, mesh: false }, outbox: [], identity: createDeviceIdentity()
};

describe("encrypted vault", () => {
  it("round-trips the real payload and keeps plaintext out of the record", () => {
    const { record } = createVault("1234", "5678", payload);
    expect(record.payload).not.toContain("Test User");
    const unlocked = unlockVault(record, "1234");
    expect(unlocked.mode).toBe("unlocked");
    expect(unlocked.payload?.profile.displayName).toBe("Test User");
  });

  it("routes the decoy PIN to the neutral decoy mode", () => {
    const { record } = createVault("1234", "5678", payload);
    expect(unlockVault(record, "5678").mode).toBe("decoy");
  });

  it("rejects incorrect PINs and tampered ciphertext", () => {
    const { record } = createVault("1234", "5678", payload);
    expect(unlockVault(record, "0000").mode).toBe("bad");
    const tampered = { ...record, payload: record.payload.slice(0, -2) + "AA" };
    expect(unlockVault(tampered, "1234").mode).toBe("bad");
  });

  it("uses a fresh random nonce for each persistence encryption", () => {
    const first = createVault("1234", "5678", payload).record;
    const second = createVault("1234", "5678", payload).record;
    expect(first.payload).not.toBe(second.payload);
  });
});
