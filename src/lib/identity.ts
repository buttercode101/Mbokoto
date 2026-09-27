import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes } from "@noble/hashes/utils.js";

const encoder = new TextEncoder();

export interface DeviceIdentity {
  publicKey: string;
  secretKey: string;
  fingerprint: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

export function publicKeyFingerprint(publicKey: string): string {
  const digest = sha256(base64ToBytes(publicKey));
  return "SEN-" + Array.from(digest, b => b.toString(16).padStart(2, "0")).join("").slice(0, 8).toUpperCase();
}

export function createDeviceIdentity(): DeviceIdentity {
  const secretKey = ed25519.utils.randomSecretKey();
  const publicKey = ed25519.getPublicKey(secretKey);
  const publicKeyEncoded = bytesToBase64(publicKey);
  return {
    publicKey: publicKeyEncoded,
    secretKey: bytesToBase64(secretKey),
    fingerprint: publicKeyFingerprint(publicKeyEncoded),
  };
}

export function signBytes(message: string, secretKey: string): string {
  return bytesToBase64(ed25519.sign(encoder.encode(message), base64ToBytes(secretKey)));
}

export function verifyBytes(message: string, signature: string, publicKey: string): boolean {
  try {
    return ed25519.verify(base64ToBytes(signature), encoder.encode(message), base64ToBytes(publicKey));
  } catch {
    return false;
  }
}

export function nonce(): string {
  return bytesToBase64(randomBytes(16));
}
