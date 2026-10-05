import { shortHash, uid } from "@/lib/format";
import type { EventNetwork, SafetyEvent, TriggerKind } from "@/lib/protocol";

export type DeliveryState = "local" | "queued" | "handed-off" | "acknowledged" | "failed";
export type EnvelopeKind = "sentinel-alert" | "trace-request" | "blackbox-export" | "preservation-request" | "station-pack" | "place-hold-request";

export interface DeliveryAttempt {
  id: string;
  at: number;
  state: DeliveryState;
  channel: "system-share" | "copy" | "local" | "relay";
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

export function acknowledgeDelivery(envelope: ProtocolEnvelope, acknowledgementId: string): ProtocolEnvelope {
  const at = Date.now();
  return {
    ...envelope,
    attempts: [...envelope.attempts, {
      id: acknowledgementId,
      at,
      state: "acknowledged",
      channel: "relay",
      detail: "Remote relay receipt verified. This is receipt acknowledgement, not proof of downstream contact response.",
    }],
  };
}

export function createStationPackEnvelope(input: { caseId: string; ref: string; subject: string; openedAt: number; lastKnown: {at:number;title:string;detail:string;verified:boolean}[]; evidenceCount: number }): ProtocolEnvelope {
  const createdAt = Date.now();
  const timeline = input.lastKnown.slice(-8).map(e => `- ${new Date(e.at).toISOString()} · ${e.title} · ${e.verified ? "verified local record" : "unverified"} · ${e.detail}`);
  const body = ["MBOKOTO / TRACE — STATION PACK", `Case: ${input.ref}`, `Missing person: ${input.subject}`, `Case opened: ${new Date(input.openedAt).toISOString()}`, "SAPS guidance: there is no waiting period to report a missing person; report at the nearest police station immediately.", "Last-known timeline:", ...timeline, `Evidence records referenced: ${input.evidenceCount}`, "This pack was created locally. It does NOT mean SAPS received, accepted or opened a police case. A police official must complete the official reporting process."].join("\n");
  return { id: uid("env"), version: 1, kind: "station-pack", createdAt, expiresAt: null, subject: `Station pack · ${input.ref}`, body, caseId: input.caseId, integrity: shortHash(body), attempts: [{id:uid("del"),at:createdAt,state:"local",channel:"local",detail:"Station pack created locally; no police submission has occurred."}] };
}

export function createPlaceHoldEnvelope(input: { caseId: string; ref: string; subject: string; place: string }): ProtocolEnvelope {
  const createdAt = Date.now();
  const body = ["MBOKOTO / TRACE — PLACE HOLD REQUEST", `Case: ${input.ref}`, `Subject: ${input.subject}`, `Place: ${input.place}`, "Request: please preserve relevant records or footage under your normal lawful retention process while the matter is reported.", "This is a user-created preservation request only. It does NOT claim the place received, acknowledged or acted on it, and it does not transfer footage."].join("\n");
  return { id: uid("env"), version: 1, kind: "place-hold-request", createdAt, expiresAt: createdAt + 72*3600_000, subject: `Place hold request · ${input.place}`, body, caseId: input.caseId, integrity: shortHash(body), attempts: [{id:uid("del"),at:createdAt,state:"local",channel:"local",detail:"Request created locally; place acknowledgement has not occurred."}] };
}
