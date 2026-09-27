import { describe, expect, it, afterEach } from "vitest";
import { createSentinelEnvelope } from "@/lib/engine";
import { createDeviceIdentity } from "@/lib/identity";
import { createSignedRelayMessage } from "@/lib/transport";
import { POST } from "../../api/v1/relay";

const oldToken = process.env.MBOKOTO_RELAY_TOKEN;

afterEach(() => {
  if (oldToken === undefined) delete process.env.MBOKOTO_RELAY_TOKEN;
  else process.env.MBOKOTO_RELAY_TOKEN = oldToken;
});

function message() {
  const identity = createDeviceIdentity();
  const envelope = createSentinelEnvelope({
    id: "ev-api",
    triggeredAt: Date.now(),
    surface: "sentinel",
    trigger: "manual",
    network: "cellular",
    meshHops: [],
    status: "local",
    lockScreenLeak: false,
  }, "cellular");
  return createSignedRelayMessage(envelope, identity);
}

describe("relay endpoint", () => {
  it("fails closed when not configured", async () => {
    delete process.env.MBOKOTO_RELAY_TOKEN;
    const response = await POST(new Request("https://relay.test/api/v1/relay", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer nope" }, body: JSON.stringify(message()) }));
    expect(response.status).toBe(503);
  });

  it("rejects an invalid signature", async () => {
    process.env.MBOKOTO_RELAY_TOKEN = "test-token-1234567890";
    const payload = message();
    payload.signature = payload.signature.slice(0, -2) + "AA";
    const response = await POST(new Request("https://relay.test/api/v1/relay", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer test-token-1234567890" }, body: JSON.stringify(payload) }));
    expect(response.status).toBe(401);
  });

  it("returns an explicit receipt for a valid signed message", async () => {
    process.env.MBOKOTO_RELAY_TOKEN = "test-token-1234567890";
    const payload = message();
    const response = await POST(new Request("https://relay.test/api/v1/relay", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer test-token-1234567890" }, body: JSON.stringify(payload) }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.acknowledgement.envelopeId).toBe(payload.envelopeId);
    expect(body.acknowledgement.state).toBe("acknowledged");
    expect(body.acknowledgement.durability).toBe("receipt-only");
  });
});
