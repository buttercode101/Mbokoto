import { describe, expect, it } from "vitest";
import { createSentinelEnvelope } from "@/lib/engine";
import { createDeviceIdentity } from "@/lib/identity";
import { createSignedRelayMessage } from "@/lib/transport";

describe("signed relay envelope", () => {
  it("binds the protocol envelope to the sender identity", () => {
    const identity = createDeviceIdentity();
    const envelope = createSentinelEnvelope({
      id: "ev-transport",
      triggeredAt: Date.now(),
      surface: "sentinel",
      trigger: "manual",
      network: "cellular",
      meshHops: [],
      status: "local",
      lockScreenLeak: false,
    }, "cellular");
    const message = createSignedRelayMessage(envelope, identity);
    expect(message.envelopeId).toBe(envelope.id);
    expect(message.senderPublicKey).toBe(identity.publicKey);
    expect(message.signature).toBeTruthy();
    expect(message.nonce).toBeTruthy();
  });
});
