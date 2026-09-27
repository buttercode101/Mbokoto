import { shortHash, uid } from "@/lib/format";
import type { EventNetwork, SafetyEvent, TriggerKind } from "@/lib/protocol";

export type DeliveryState = "local" | "queued" | "handed-off" | "acknowledged" | "failed";
export type EnvelopeKind = "sentinel-alert" | "trace-request" | "blackbox-export";

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
