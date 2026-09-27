import { describe, expect, it } from "vitest";
import { createSentinelEnvelope, createTraceEnvelope, createBlackboxExportEnvelope, advanceDelivery } from "@/lib/engine";
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

  it("creates TRACE preservation requests without claiming acknowledgement", () => {\n    const envelope = createTraceEnvelope({ caseId: "case-1", ref: "SEN-2026-001", subject: "Test subject", nodeName: "Test node", note: "Preserve according to site policy." });\n    expect(envelope.kind).toBe("preservation-request");\n    expect(envelope.attempts[0].state).toBe("local");\n  });\n\n  it("creates BLACKBOX manifests without transferring evidence bytes", () => {\n    const envelope = createBlackboxExportEnvelope({ subject: "Manifest", evidenceCount: 2, custodyCount: 4, integrity: "abcd1234" });\n    expect(envelope.kind).toBe("blackbox-export");\n    expect(envelope.body).not.toContain("original evidence bytes");\n  });\n\n  it("records explicit handoff separately from acknowledgement", () => {
    const envelope = advanceDelivery(createSentinelEnvelope(event, "cellular"), "copy");
    expect(envelope.attempts.at(-1)?.state).toBe("handed-off");
    expect(envelope.attempts.at(-1)?.channel).toBe("copy");
  });
});
