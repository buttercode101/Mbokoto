import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { managedNonce, randomBytes } from "@noble/ciphers/utils.js";
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import type { BufferEntry, CustodyEntry, EvidenceItem, NetworkState, ParticipatingNode, Profile, ProtocolLog, SafetyEvent, TraceCase, TrustedContact } from "@/lib/protocol";
import type { DeviceIdentity } from "@/lib/identity";
import type { ProtocolEnvelope } from "@/lib/engine";

export const VAULT_KEY = "sentinel-v2";
const LEGACY_KEY = "sentinel-v1";
const VERSION = 2;
const ITERATIONS = 600_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};
const fromBase64 = (value: string) => {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
};
const deriveKey = (pin: string, salt: string) => pbkdf2(sha256, pin, salt, { c: ITERATIONS, dkLen: 32 });
const seal = (value: unknown, key: Uint8Array) => {
  const nonceCipher = managedNonce(xchacha20poly1305)(key);
  return toBase64(nonceCipher.encrypt(encoder.encode(JSON.stringify(value))));
};
const open = <T>(ciphertext: string, key: Uint8Array): T | null => {
  try {
    const nonceCipher = managedNonce(xchacha20poly1305)(key);
    return JSON.parse(decoder.decode(nonceCipher.decrypt(fromBase64(ciphertext)))) as T;
  } catch {
    return null;
  }
};

export interface VaultPayload {
  profile: Profile;
  contacts: TrustedContact[];
  nodes: ParticipatingNode[];
  cases: TraceCase[];
  evidence: EvidenceItem[];
  events: SafetyEvent[];
  buffer: BufferEntry[];
  custody: CustodyEntry[];
  log: ProtocolLog[];
  network: NetworkState;
  outbox: ProtocolEnvelope[];
  identity: DeviceIdentity | null;
}

export interface VaultRecord {
  version: number;
  realSalt: string;
  decoySalt: string;
  realProbe: string;
  decoyProbe: string;
  payload: string;
}

export function createVault(realPin: string, decoyPin: string, payload: VaultPayload): { record: VaultRecord; key: Uint8Array } {
  const realSalt = toBase64(randomBytes(16));
  const decoySalt = toBase64(randomBytes(16));
  const realKey = deriveKey(realPin, realSalt);
  const decoyKey = deriveKey(decoyPin, decoySalt);
  return {
    record: {
      version: VERSION,
      realSalt,
      decoySalt,
      realProbe: seal("SENTINEL-REAL-PROBE-V2", realKey),
      decoyProbe: seal("SENTINEL-DECOY-PROBE-V2", decoyKey),
      payload: seal(payload, realKey)
    },
    key: realKey
  };
}

export function readVault(): VaultRecord | null {
  try {
    const raw = window.localStorage.getItem(VAULT_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw) as VaultRecord;
    if (record.version !== VERSION || !record.realSalt || !record.decoySalt || !record.realProbe || !record.decoyProbe || !record.payload) return null;
    return record;
  } catch {
    return null;
  }
}

function normalisePayload(payload: VaultPayload): VaultPayload { return { ...payload, outbox: payload.outbox ?? [] }; }

export function unlockVault(record: VaultRecord, pin: string): { mode: "unlocked" | "decoy" | "bad"; key?: Uint8Array; payload?: VaultPayload } {
  const realKey = deriveKey(pin, record.realSalt);
  if (open<string>(record.realProbe, realKey) === "SENTINEL-REAL-PROBE-V2") {
    const payload = open<VaultPayload>(record.payload, realKey);
    if (payload?.profile?.setupComplete) return { mode: "unlocked", key: realKey, payload: normalisePayload(payload) };
    return { mode: "bad" };
  }
  const decoyKey = deriveKey(pin, record.decoySalt);
  if (open<string>(record.decoyProbe, decoyKey) === "SENTINEL-DECOY-PROBE-V2") return { mode: "decoy", key: decoyKey };
  return { mode: "bad" };
}

export function persistVault(record: VaultRecord, key: Uint8Array, payload: VaultPayload) {
  const next = { ...record, payload: seal(payload, key) };
  window.localStorage.setItem(VAULT_KEY, JSON.stringify(next));
}

export function wipeVault() {
  window.localStorage.removeItem(VAULT_KEY);
  window.localStorage.removeItem(LEGACY_KEY);
}
