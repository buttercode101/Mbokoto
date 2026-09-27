import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes } from "@noble/ciphers/webcrypto.js";
import { shortHash, uid } from "@/lib/format";

const DB_NAME = "mbokoto-evidence-v2";
const STORE = "objects";

export interface EvidenceBlobRecord {
  id: string;
  caseId: string | null;
  capturedAt: number;
  mediaType: string;
  size: number;
  originalName: string;
  hash: string;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putEvidenceBlob(input: {
  caseId?: string | null;
  file: Blob;
  originalName?: string;
  key: Uint8Array;
}): Promise<EvidenceBlobRecord> {
  if (input.key.length !== 32) throw new Error("Evidence encryption key must be 32 bytes.");
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const nonce = randomBytes(24);
  const ciphertext = xchacha20poly1305(input.key, nonce).encrypt(bytes);
  const hash = hex(sha256(bytes));
  const record: EvidenceBlobRecord = {
    id: uid("blob"),
    caseId: input.caseId ?? null,
    capturedAt: Date.now(),
    mediaType: input.file.type || "application/octet-stream",
    size: input.file.size,
    originalName: input.originalName || "evidence",
    hash: shortHash(hash),
    nonce,
    ciphertext,
  };
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  database.close();
  return record;
}

export async function getEvidenceBlob(id: string, key: Uint8Array): Promise<{ record: EvidenceBlobRecord; bytes: Uint8Array } | null> {
  if (key.length !== 32) throw new Error("Evidence encryption key must be 32 bytes.");
  const database = await db();
  const value = await new Promise<EvidenceBlobRecord | undefined>((resolve, reject) => {
    const tx = database.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.close();
  if (!value) return null;
  const bytes = xchacha20poly1305(key, value.nonce).decrypt(value.ciphertext);
  return { record: value, bytes };
}

export async function deleteEvidenceBlob(id: string): Promise<void> {
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  database.close();
}

export async function wipeEvidenceBlobs(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  database.close();
}
