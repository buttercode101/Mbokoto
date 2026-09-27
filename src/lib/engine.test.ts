import { describe, expect, it } from "vitest";
import { createSentinelEnvelope, advanceDelivery } from "@/lib/engine";
import type { SafetyEvent } from "@/lib/protocol";

const event: SafetyEvent = {
  id: "ev-test",
  triggeredAt: 1700000000000,
  surface: "sentinel",
  trigger: "manual",
  network: "cellular",
  meshHops: [],
  status: "queued",
  lockScreenLeak: false,
};

describe("protocol delivery boundary", () => {
  it("never labels a local event as remotely delivered", () => {
    const envelope = createSentinelEnvelope(event, "cellular");
    expect(envelope.attempts[0].state).toBe("local");
    expect(envelope.body).toContain("does not claim emergency-service dispatch");
  });

  it("records explicit handoff separately from acknowledgement", () => {
    const envelope = advanceDelivery(createSentinelEnvelope(event, "cellular"), "copy");
    expect(envelope.attempts.at(-1)?.state).toBe("handed-off");
    expect(envelope.attempts.at(-1)?.channel).toBe("copy");
  });
});
