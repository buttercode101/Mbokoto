import { describe, expect, it } from "vitest";
import { createSentinelEnvelope, createTraceEnvelope, createBlackboxExportEnvelope, createStationPackEnvelope, createPlaceHoldEnvelope, advanceDelivery } from "@/lib/engine";
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

  it("creates TRACE preservation requests without claiming acknowledgement", () => {
    const envelope = createTraceEnvelope({ caseId: "case-1", ref: "SEN-2026-001", subject: "Test subject", nodeName: "Test node", note: "Preserve according to site policy." });
    expect(envelope.kind).toBe("preservation-request");
    expect(envelope.attempts[0].state).toBe("local");
  });

  it("creates BLACKBOX manifests without transferring evidence bytes", () => {
    const envelope = createBlackboxExportEnvelope({ subject: "Manifest", evidenceCount: 2, custodyCount: 4, integrity: "abcd1234" });
    expect(envelope.kind).toBe("blackbox-export");
    expect(envelope.body).toContain("does not transfer the original evidence bytes");
  });

  it("records explicit handoff separately from acknowledgement", () => {
    const envelope = advanceDelivery(createSentinelEnvelope(event, "cellular"), "copy");
    expect(envelope.attempts.at(-1)?.state).toBe("handed-off");
    expect(envelope.attempts.at(-1)?.channel).toBe("copy");
  });
  it("station pack never claims a police report was submitted", () => {
    const envelope=createStationPackEnvelope({caseId:"case-1",ref:"SEN-2026-001",subject:"Test subject",openedAt:1700000000000,lastKnown:[{at:1700000001000,title:"Check-in",detail:"Local record",verified:true}],evidenceCount:1});
    expect(envelope.kind).toBe("station-pack");
    expect(envelope.attempts[0].state).toBe("local");
    expect(envelope.body).toContain("does NOT mean SAPS received");
  });

  it("place hold remains a request until an external acknowledgement exists", () => {
    const envelope=createPlaceHoldEnvelope({caseId:"case-1",ref:"SEN-2026-001",subject:"Test subject",place:"Test place"});
    expect(envelope.kind).toBe("place-hold-request");
    expect(envelope.attempts[0].state).toBe("local");
    expect(envelope.body).toContain("does NOT claim the place received");
  });
});
