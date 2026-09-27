import { shortHash, uid } from "@/lib/format";
import type { EventNetwork, SafetyEvent, TriggerKind } from "@/lib/protocol";

export type DeliveryState = "local" | "queued" | "handed-off" | "acknowledged" | "failed";
export type EnvelopeKind = "sentinel-alert" | "trace-request" | "blackbox-export" | "preservation-request";

export interface DeliveryAttempt {
  id: string;
  at: number;
  state: DeliveryState;
  channel: "system-share" | "copy" | "local";
  detail: string;
}

export interface ProtocolEnvelope {
  id: string;
  version: 1;
  kind: EnvelopeKind;
  createdAt: number;
  expiresAt: number | null;
  subject: string;
  body: string;
  eventId?: string;
  caseId?: string;
  integrity: string;
  attempts: DeliveryAttempt[];
}

export function createSentinelEnvelope(event: SafetyEvent, network: EventNetwork): ProtocolEnvelope {
  const createdAt = Date.now();
  const body = [
    "MBOKOTO / SENTINEL",
    "Safety event requires attention.",
    `Event: ${event.id}`,
    `Trigger: ${event.trigger}`,
    `Created: ${new Date(event.triggeredAt).toISOString()}`,
    `Network at trigger: ${network}`,
    "Location tracking is not included in this message.",
    "This handoff does not claim emergency-service dispatch.",
  ].join("\n");
  return {
    id: uid("env"),
    version: 1,
    kind: "sentinel-alert",
    createdAt,
    expiresAt: null,
    subject: "Mbokoto safety alert",
    body,
    eventId: event.id,
    integrity: shortHash(body),
    attempts: [{
      id: uid("del"),
      at: createdAt,
      state: network === "offline" ? "queued" : "local",
      channel: network === "offline" ? "local" : "local",
      detail: network === "offline" ? "Stored locally until an explicit handoff is possible." : "Created locally; no remote delivery has occurred.",
    }],
  };
}

export function createTraceEnvelope(input: { caseId: string; ref: string; subject: string; nodeName: string; note: string }): ProtocolEnvelope {
  const createdAt = Date.now();
  const body = ["MBOKOTO / TRACE", "Preservation request.", `Case: ${input.ref}`, `Subject: ${input.subject}`, `Node: ${input.nodeName}`, input.note, "Request is explicit and limited to preservation. No footage is transferred by this message."].join("\n");
  return { id: uid("env"), version: 1, kind: "preservation-request", createdAt, expiresAt: createdAt + 72 * 3600_000, subject: `Preservation request · ${input.nodeName}`, body, caseId: input.caseId, integrity: shortHash(body), attempts: [{ id: uid("del"), at: createdAt, state: "local", channel: "local", detail: "Created locally; node acknowledgement has not occurred." }] };
}

export function createBlackboxExportEnvelope(input: { subject: string; evidenceCount: number; custodyCount: number; integrity: string }): ProtocolEnvelope {
  const createdAt = Date.now();
  const body = ["MBOKOTO / BLACKBOX", "Controlled export manifest.", `Records: ${input.evidenceCount}`, `Custody entries: ${input.custodyCount}`, `Manifest integrity: ${input.integrity}`, "This manifest references encrypted local evidence. It does not transfer the original evidence bytes."].join("\n");
  return { id: uid("env"), version: 1, kind: "blackbox-export", createdAt, expiresAt: null, subject: input.subject, body, integrity: shortHash(body), attempts: [{ id: uid("del"), at: createdAt, state: "local", channel: "local", detail: "Manifest created locally; no recipient has received it." }] };
}

export function advanceDelivery(envelope: ProtocolEnvelope, channel: "system-share" | "copy"): ProtocolEnvelope {
  const at = Date.now();
  return {
    ...envelope,
    attempts: [...envelope.attempts, {
      id: uid("del"),
      at,
      state: "handed-off",
      channel,
      detail: channel === "system-share"
        ? "Passed to the device share sheet. Recipient delivery is outside Mbokoto's control."
        : "Copied for explicit user-controlled delivery. Recipient delivery is outside Mbokoto's control.",
    }],
  };
}

export function triggerLabel(trigger: TriggerKind): string {
  return trigger.replaceAll("-", " ");
}
