import type { ProtocolEnvelope } from "@/lib/engine";
import { nonce, signBytes, type DeviceIdentity } from "@/lib/identity";
import type { TrustedContact } from "@/lib/protocol";

export interface SignedRelayMessage {
  version: 1;
  envelopeId: string;
  envelopeKind: ProtocolEnvelope["kind"];
  createdAt: number;
  expiresAt: number | null;
  subject: string;
  body: string;
  integrity: string;
  senderPublicKey: string;
  signature: string;
  nonce: string;
}

export interface RelayAcknowledgement {
  id: string;
  receivedAt: number;
  envelopeId: string;
  senderFingerprint: string;
  state: "acknowledged";
  durability: "receipt-only";
}

export interface RelayResult {
  ok: boolean;
  acknowledgement?: RelayAcknowledgement;
  error?: string;
}

function signingMaterial(message: Omit<SignedRelayMessage, "signature">): string {
  return [
    "MBOKOTO-RELAY-V1",
    message.version,
    message.envelopeId,
    message.envelopeKind,
    message.createdAt,
    message.expiresAt ?? "",
    message.subject,
    message.body,
    message.integrity,
    message.senderPublicKey,
    message.nonce,
  ].join("\n");
}

export function createSignedRelayMessage(envelope: ProtocolEnvelope, identity: DeviceIdentity): SignedRelayMessage {
  const message: Omit<SignedRelayMessage, "signature"> = {
    version: 1,
    envelopeId: envelope.id,
    envelopeKind: envelope.kind,
    createdAt: envelope.createdAt,
    expiresAt: envelope.expiresAt,
    subject: envelope.subject,
    body: envelope.body,
    integrity: envelope.integrity,
    senderPublicKey: identity.publicKey,
    nonce: nonce(),
  };
  return { ...message, signature: signBytes(signingMaterial(message), identity.secretKey) };
}

export async function relayEnvelope(envelope: ProtocolEnvelope, identity: DeviceIdentity, contact: TrustedContact): Promise<RelayResult> {
  if (!contact.relayToken) return { ok: false, error: "No relay token is configured for this trusted contact." };
  let url: URL;
  try {
    url = new URL(contact.relayUrl || `${window.location.origin}/api/v1/relay`);
    if (url.protocol !== "https:") throw new Error("Relay must use HTTPS.");\n    if (typeof window !== "undefined" && url.origin !== window.location.origin) throw new Error("Relay must use the same origin as the Mbokoto application.");
  } catch {
    return { ok: false, error: "Relay destination must be a valid HTTPS URL." };
  }

  const message = createSignedRelayMessage(envelope, identity);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${contact.relayToken}`,
      },
      body: JSON.stringify(message),
    });
    const data = await response.json().catch(() => null) as { ok?: boolean; acknowledgement?: RelayAcknowledgement; code?: string } | null;
    if (!response.ok || !data?.ok || !data.acknowledgement || data.acknowledgement.envelopeId !== envelope.id) {
      return { ok: false, error: data?.code || `Relay returned HTTP ${response.status}.` };
    }
    return { ok: true, acknowledgement: data.acknowledgement };
  } catch {
    return { ok: false, error: "Relay could not be reached. The envelope remains local." };
  }
}
