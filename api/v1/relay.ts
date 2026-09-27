import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";

type SignedRelayMessage = {
  version: 1;
  envelopeId: string;
  envelopeKind: string;
  createdAt: number;
  expiresAt: number | null;
  subject: string;
  body: string;
  integrity: string;
  senderPublicKey: string;
  signature: string;
  nonce: string;
};

const encoder = new TextEncoder();
const MAX_BODY = 64 * 1024;
const MAX_CLOCK_SKEW_MS = 5 * 60_000;

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function fingerprint(publicKey: string): string {
  return Array.from(sha256(base64ToBytes(publicKey)), b => b.toString(16).padStart(2, "0")).join("").slice(0, 8).toUpperCase();
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

function json(status: number, value: Record<string, unknown>) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET() {
  return json(200, {
    service: "mbokoto-relay",
    version: 1,
    status: "configured",
    persistence: "none",
    acknowledgement: "receipt-only",
  });
}

export async function POST(request: Request) {
  const expectedToken = process.env.MBOKOTO_RELAY_TOKEN;
  if (!expectedToken) return json(503, { ok: false, code: "relay_not_configured" });

  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expectedToken}`) return json(401, { ok: false, code: "unauthorised" });

  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") {
    return json(415, { ok: false, code: "json_required" });
  }

  let message: SignedRelayMessage;
  try {
    const raw = await request.text();
    if (raw.length > 100_000) return json(413, { ok: false, code: "payload_too_large" });
    message = JSON.parse(raw) as SignedRelayMessage;
  } catch {
    return json(400, { ok: false, code: "invalid_json" });
  }

  if (message.version !== 1 || typeof message.envelopeId !== "string" || typeof message.body !== "string" ||
      typeof message.subject !== "string" || typeof message.senderPublicKey !== "string" ||
      typeof message.signature !== "string" || typeof message.nonce !== "string" ||
      typeof message.createdAt !== "number" || typeof message.integrity !== "string") {
    return json(400, { ok: false, code: "invalid_message" });
  }

  if (message.body.length > MAX_BODY || message.subject.length > 512 || message.envelopeId.length > 128) {
    return json(413, { ok: false, code: "message_too_large" });
  }

  if (Math.abs(Date.now() - message.createdAt) > MAX_CLOCK_SKEW_MS) {
    return json(408, { ok: false, code: "stale_message" });
  }

  const unsigned = { ...message };
  delete (unsigned as Partial<SignedRelayMessage>).signature;
  const canonical = signingMaterial(unsigned);
  let valid = false;
  try {
    valid = ed25519.verify(base64ToBytes(message.signature), encoder.encode(canonical), base64ToBytes(message.senderPublicKey));
  } catch {
    valid = false;
  }
  if (!valid) return json(401, { ok: false, code: "invalid_signature" });

  const ackId = crypto.randomUUID();
  return json(200, {
    ok: true,
    acknowledgement: {
      id: ackId,
      receivedAt: Date.now(),
      envelopeId: message.envelopeId,
      senderFingerprint: fingerprint(message.senderPublicKey),
      state: "acknowledged",
      durability: "receipt-only",
    },
  });
}
