import { sha256 } from "@noble/hashes/sha2.js";
import { shortHash, uid } from "@/lib/format";

const DB_NAME = "mbokoto-evidence-v1";
const STORE = "objects";

export interface EvidenceBlobRecord {
  id: string;
  caseId: string | null;
  capturedAt: number;
  mediaType: string;
  size: number;
  originalName: string;
  hash: string;
  bytes: ArrayBuffer;
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
}): Promise<EvidenceBlobRecord> {
  const bytes = await input.file.arrayBuffer();
  const hash = shortHash(new TextDecoder().decode(sha256(new Uint8Array(bytes))));
  const record: EvidenceBlobRecord = {
    id: uid("blob"),
    caseId: input.caseId ?? null,
    capturedAt: Date.now(),
    mediaType: input.file.type || "application/octet-stream",
    size: input.file.size,
    originalName: input.originalName || "evidence",
    hash,
    bytes,
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

export async function getEvidenceBlob(id: string): Promise<EvidenceBlobRecord | null> {
  const database = await db();
  const value = await new Promise<EvidenceBlobRecord | undefined>((resolve, reject) => {
    const tx = database.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return value ?? null;
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
