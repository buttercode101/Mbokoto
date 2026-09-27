import { create } from "zustand";
import { createSentinelEnvelope, advanceDelivery } from "@/lib/engine";
import { putEvidenceBlob, wipeEvidenceBlobs } from "@/lib/evidence";
import { uid, shortHash } from "@/lib/format";
import { BUFFER_HOURS, RETENTION_HOURS, type Consent, type CustodyEntry, type EvidenceItem, type NetworkState, type Profile, type ProtocolLog, type SafetyEvent, type TraceCase, type TriggerKind, type LastKnownEvent, buildDemo, emptyProfile, eventNetworkFrom, nextCaseRef } from "@/lib/protocol";
import { createVault, persistVault, readVault, unlockVault, wipeVault, type VaultPayload } from "@/lib/vault";

export type SessionMode = "unlocked" | "locked" | "decoy";

interface ProtocolState extends VaultPayload {
  hasHydrated: boolean;
  session: SessionMode;
  pinError: string | null;
  storageError: string | null;
  setHydrated: () => void;
  loadDemo: () => void;
  completeSetup: (input: { displayName: string; pin: string; decoyPin: string; contacts: { name: string; relationship: string }[]; consent: Omit<Consent, "acceptedAt"> }) => void;
  lock: () => void;
  unlock: (pin: string) => "ok" | "decoy" | "bad";
  exitDecoy: () => void;
  setNetwork: (c: NetworkState["cellular"]) => void;
  setArmed: (a: boolean) => void;
  triggerSentinel: (t: TriggerKind) => string;
  markHopDelivered: (e: string, n: string) => void;
  handoffEnvelope: (id: string, channel: "system-share" | "copy") => Promise<string>;
  addEvidenceFile: (file: File, caseId?: string) => Promise<string>;
  openCase: (i: { subject: string; relation: "self" | "trusted"; openedBy: string }) => string;
  requestPreservation: (c: string, n: string) => void;
  resolveCase: (c: string) => void;
  addCheckIn: (p: string) => void;
  addNote: (t: string, b: string) => void;
  emergencyWipe: () => void;
  resetAll: () => void;
}

const initialNetwork: NetworkState = { cellular: "down", ble: true, mesh: true };
const emptyPayload = (): VaultPayload => ({ profile: emptyProfile(), contacts: [], nodes: [], cases: [], evidence: [], events: [], buffer: [], custody: [], log: [], network: initialNetwork, outbox: [] });
let sessionKey: Uint8Array | null = null;
let failedUnlocks = 0;
let unlockBlockedUntil = 0;

const logLine = (surface: ProtocolLog["surface"], text: string): ProtocolLog => ({ id: uid("log"), at: Date.now(), surface, text });
const custodyLine = (action: string, actor: CustodyEntry["actor"], detail: string): CustodyEntry => ({ id: uid("cus"), at: Date.now(), action, actor, detail });

export const useProtocol = create<ProtocolState>()((set, get) => ({
  ...emptyPayload(),
  hasHydrated: false,
  session: "unlocked",
  pinError: null,
  storageError: null,
  setHydrated: () => set({ hasHydrated: true }),
  loadDemo: () => {
    const d = buildDemo();
    const created = createVault("1408", "2580", d);
    sessionKey = created.key;
    try { window.localStorage.setItem("sentinel-v2", JSON.stringify(created.record)); }
    catch { set({ storageError: "Local storage is unavailable. The demonstration cannot be persisted." }); }
    set({ ...d, session: "unlocked", pinError: null, storageError: null });
  },
  completeSetup: ({ displayName, pin, decoyPin, contacts, consent }) => {
    const now = Date.now();
    const profile: Profile = { displayName: displayName.trim(), setupComplete: true, armed: true, consent: { ...consent, acceptedAt: now }, demo: false };
    const payload: VaultPayload = {
      profile,
      contacts: contacts.filter(c => c.name.trim()).map(c => ({
        id: uid("c"),
        name: c.name.trim(),
        relationship: c.relationship.trim() || "Trusted",
        keyFingerprint: `SEN-${shortHash(c.name + now).slice(0, 4)}-${shortHash(c.relationship + c.name).slice(0, 4)}`.toUpperCase(),
        authorised: true
      })),
      nodes: [], cases: [], evidence: [], events: [], buffer: [],
      custody: [custodyLine("Protocol armed", "user", "Consent recorded. Silent tracking remains off.")],
      log: [logLine("protocol", "Protocol armed. No wearable or participating infrastructure is connected yet.")],
      network: { cellular: "up", ble: false, mesh: false }, outbox: []
    };
    const created = createVault(pin, decoyPin, payload);
    sessionKey = created.key;
    try { window.localStorage.setItem("sentinel-v2", JSON.stringify(created.record)); }
    catch { set({ storageError: "Local storage is unavailable. Setup was not persisted." }); }
    set({ ...payload, session: "unlocked", pinError: null, storageError: null });
  },
  lock: () => {
    sessionKey = null;
    set({ ...emptyPayload(), session: "locked", pinError: null, storageError: null });
  },
  unlock: (pin) => {
    const now = Date.now();
    if (now < unlockBlockedUntil) { set({ pinError: `Try again in ${Math.ceil((unlockBlockedUntil - now) / 1000)}s.` }); return "bad"; }
    const record = readVault();
    if (!record) { set({ pinError: "No local vault is available." }); return "bad"; }
    const result = unlockVault(record, pin);
    if (result.mode === "unlocked" && result.payload && result.key) {
      sessionKey = result.key;
      failedUnlocks = 0;
      unlockBlockedUntil = 0;
      set({ ...result.payload, session: "unlocked", pinError: null, storageError: null });
      return "ok";
    }
    if (result.mode === "decoy") {
      sessionKey = null;
      failedUnlocks = 0;
      unlockBlockedUntil = 0;
      set({ ...emptyPayload(), session: "decoy", pinError: null, storageError: null });
      return "decoy";
    }
    failedUnlocks += 1;
    if (failedUnlocks >= 5) unlockBlockedUntil = now + 30_000;
    else if (failedUnlocks >= 3) unlockBlockedUntil = now + 10_000;
    set({ pinError: unlockBlockedUntil > now ? `That PIN does not match. Try again in ${Math.ceil((unlockBlockedUntil - now) / 1000)}s.` : "That PIN does not match." });
    return "bad";
  },
  exitDecoy: () => {
    sessionKey = null;
    set({ ...emptyPayload(), session: "locked", pinError: null });
  },
  setNetwork: (cellular) => set(s => ({ network: { ...s.network, cellular }, log: [logLine("protocol", `Network set to ${cellular}.`), ...s.log].slice(0, 40) })),
  setArmed: (armed) => set(s => ({ profile: { ...s.profile, armed }, log: [logLine("sentinel", armed ? "Sentinel armed." : "Sentinel disarmed."), ...s.log].slice(0, 40) })),
  triggerSentinel: (trigger) => {
    const s = get();
    if (!s.profile.armed) return "";
    const at = Date.now(), id = uid("ev"), network = eventNetworkFrom(s.network.cellular);
    const event: SafetyEvent = { id, triggeredAt: at, surface: "sentinel", trigger, network, meshHops: [{nodeId:"phone",label:"This phone (locked)",kind:"phone",at,delivered:true}], status: network === "offline" ? "queued" : "local", lockScreenLeak: false };
    const lk: LastKnownEvent = { id: uid("lk"), at, kind: "trigger", title: "Discrete trigger", detail: `Sentinel ${trigger.replace(/-/g, " ")}. Phone locked. Lock screen stayed dark. Network: ${network}.`, source: "device", verified: true };
    const buf = { id: uid("buf"), at, kind: "sensor" as const, title: "Sentinel trigger", body: `${trigger} · ${network} · BLE ${s.network.ble ? "up" : "down"}`, hash: shortHash(`sentinel:${id}:${at}`), expiresAt: at + BUFFER_HOURS * 3600_000, sourceOfTruth: true };
    const open = s.cases.find(c => c.status === "open" || c.status === "coordinating");
    set({
      events: [event, ...s.events],
      buffer: [buf, ...s.buffer],
      cases: s.cases.map(c => open && c.id === open.id ? { ...c, lastKnown: [...c.lastKnown, lk], eventIds: [...c.eventIds, id] } : c),
      custody: [custodyLine("Safety event queued", "device", `Trigger ${trigger}. No lock-screen notification.`), ...s.custody],
      outbox: [createSentinelEnvelope(event, network), ...s.outbox],
      log: [logLine("sentinel", `Safety event created locally · explicit handoff required.`), ...s.log].slice(0, 40)
    });
    return id;
  },
  markHopDelivered: (eventId, nodeId) => set(s => ({ events: s.events.map(e => e.id !== eventId ? e : { ...e, meshHops: e.meshHops.map(h => h.nodeId === nodeId ? { ...h, delivered: true } : h), status: e.meshHops.map(h => h.nodeId === nodeId ? { ...h, delivered: true } : h).every(h => h.delivered) ? "acknowledged" : e.status }) })),
  handoffEnvelope: async (id, channel) => {
    const envelope = get().outbox.find(e => e.id === id);
    if (!envelope) return "";
    const next = advanceDelivery(envelope, channel);
    set(s => ({ outbox: s.outbox.map(e => e.id === id ? next : e), events: next.eventId ? s.events.map(e => e.id === next.eventId ? { ...e, status: "handed-off" } : e) : s.events, custody: [custodyLine("Safety handoff recorded", "user", `${channel} · ${next.id}`), ...s.custody], log: [logLine("sentinel", `Safety envelope handed to ${channel}. Recipient acknowledgement remains unverified.`), ...s.log].slice(0,40) }));
    return next.body;
  },
  addEvidenceFile: async (file, caseId) => {
    if (!sessionKey) return "";
    try {
      const record = await putEvidenceBlob({ file, caseId: caseId ?? null, originalName: file.name, key: sessionKey });
      const at = record.capturedAt;
      const item: EvidenceItem = { id: record.id, caseId: caseId ?? "", kind: "original", media: file.type.startsWith("image/") ? "photo-hash" : file.type.startsWith("audio/") ? "audio-buffer" : "note", title: file.name, body: `Encrypted local evidence · ${record.size} bytes · hash ${record.hash}`, capturedAt: at, hash: record.hash, sourceOfTruth: true };
      set(s => ({ evidence: [item, ...s.evidence], custody: [custodyLine("Evidence captured", "device", `${file.name} · encrypted local object`), ...s.custody], log: [logLine("blackbox", `Evidence captured locally · ${record.hash}.`), ...s.log].slice(0,40) }));
      return record.id;
    } catch {
      set({ storageError: "The evidence object could not be stored securely on this device." });
      return "";
    }
  },
  openCase: ({ subject, relation, openedBy }) => {
    const s = get(), at = Date.now(), cleanSubject = subject.trim();
    if (!cleanSubject) return "";
    const id = uid("case"), ref = nextCaseRef(s.cases);
    const lastFromBuffer: LastKnownEvent[] = s.buffer.filter(b => ["location", "note", "sensor"].includes(b.kind)).slice(0, 4).reverse().map(b => ({ id: uid("lk"), at: b.at, kind: b.kind === "location" ? "place" : "check-in", title: b.title, detail: b.body, source: "device", verified: true }));
    const ev: EvidenceItem = { id: uid("evd"), caseId: id, kind: "original", media: "note", title: "Case opened — no footage transferred", body: "Authorised nodes have not been asked to preserve yet. Originals stay at source.", capturedAt: at, hash: shortHash(`open:${id}`), sourceOfTruth: true };
    const next: TraceCase = { id, ref, subject: cleanSubject, relation, openedAt: at, openedBy: openedBy.trim() || "Device user", status: "open", headline: `${cleanSubject} has not arrived`, lastKnown: lastFromBuffer, nodeIds: s.nodes.map(n => n.id), eventIds: [], evidenceIds: [ev.id], retentionHours: RETENTION_HOURS };
    set({ cases: [next, ...s.cases], evidence: [ev, ...s.evidence], custody: [custodyLine("Case opened", relation === "self" ? "user" : "trusted-contact", `${ref} · ${next.headline}`), ...s.custody], log: [logLine("trace", `Case ${ref} opened — ${next.headline}.`), ...s.log].slice(0, 40) });
    return id;
  },
  requestPreservation: (caseId, nodeId) => {
    const at = Date.now(), state = get(), node = state.nodes.find(n => n.id === nodeId), targetCase = state.cases.find(c => c.id === caseId);
    if (!node || !targetCase || targetCase.status === "resolved" || node.status === "released" || node.status === "preserving") return;
    const ev: EvidenceItem = { id: uid("evd"), caseId, kind: "original", media: "cctv-hold", title: `Hold placed · ${node.name}`, body: `${node.note} Footage is not copied off-site. Retention ${RETENTION_HOURS}h.`, capturedAt: at, hash: shortHash(`hold:${nodeId}:${at}`), sourceOfTruth: true };
    const derivative: EvidenceItem = { id: uid("evd"), caseId, kind: "derivative", media: "summary", title: `Hold receipt · ${node.name}`, body: `Derivative receipt: preservation requested at ${new Date(at).toISOString()}. Original remains at the node.`, capturedAt: at, hash: shortHash(`sum:${nodeId}:${at}`), sourceOfTruth: false };
    set(s => ({
      nodes: s.nodes.map(n => n.id === nodeId ? { ...n, status: "preserving", requestedAt: at, retainsUntil: at + RETENTION_HOURS * 3600_000 } : n),
      cases: s.cases.map(c => c.id === caseId ? { ...c, status: "coordinating", evidenceIds: [...c.evidenceIds, ev.id, derivative.id], lastKnown: [...c.lastKnown, { id: uid("lk"), at, kind: "node-sighting", title: `Preservation hold · ${node.name}`, detail: "Node acknowledged. No open camera access. Original stays on site.", source: "node", verified: true }] } : c),
      evidence: [ev, derivative, ...s.evidence],
      custody: [custodyLine("Preservation hold", "node", `${node.name} · ${RETENTION_HOURS}h local retain`), ...s.custody],
      log: [logLine("trace", `Hold placed at ${node.name}. Originals not transferred.`), ...s.log].slice(0, 40)
    }));
  },
  resolveCase: (caseId) => set(s => ({ cases: s.cases.map(c => c.id === caseId ? { ...c, status: "resolved" } : c), nodes: s.nodes.map(n => n.status === "preserving" || n.status === "preservation-requested" ? { ...n, status: "released" } : n), log: [logLine("trace", "Case resolved. Node holds released."), ...s.log].slice(0, 40) })),
  addCheckIn: (place) => {
    const cleanPlace = place.trim();
    if (!cleanPlace) return;
    const at = Date.now(), buf = { id: uid("buf"), at, kind: "location" as const, title: `Check-in · ${cleanPlace}`, body: "Explicit check-in. Coarse place name. Not a live track.", hash: shortHash(`checkin:${cleanPlace}:${at}`), expiresAt: at + BUFFER_HOURS * 3600_000, sourceOfTruth: true };
    const lk: LastKnownEvent = { id: uid("lk"), at, kind: "check-in", title: `Check-in · ${cleanPlace}`, detail: "Person at risk confirmed they are here.", source: "user", verified: true };
    set(s => {
      const open = s.cases.find(c => c.status === "open" || c.status === "coordinating");
      return { buffer: [buf, ...s.buffer], cases: s.cases.map(c => open && c.id === open.id ? { ...c, lastKnown: [...c.lastKnown, lk] } : c), custody: [custodyLine("Check-in recorded", "user", cleanPlace), ...s.custody], log: [logLine("protocol", `Check-in at ${cleanPlace}.`), ...s.log].slice(0, 40) };
    });
  },
  addNote: (title, body) => {
    const cleanTitle = title.trim(), cleanBody = body.trim();
    if (!cleanTitle || !cleanBody) return;
    const at = Date.now();
    set(s => ({ buffer: [{ id: uid("buf"), at, kind: "note", title: cleanTitle, body: cleanBody, hash: shortHash(`note:${cleanTitle}:${at}`), expiresAt: at + BUFFER_HOURS * 3600_000, sourceOfTruth: true }, ...s.buffer], custody: [custodyLine("Note written", "user", "Local buffer only"), ...s.custody] }));
  },
  emergencyWipe: () => {
    sessionKey = null;
    wipeVault();
    void wipeEvidenceBlobs();
    set({ ...emptyPayload(), session: "unlocked", pinError: null, storageError: null });
  },
  resetAll: () => {
    sessionKey = null;
    wipeVault();
    set({ ...emptyPayload(), session: "unlocked", pinError: null, storageError: null });
  }
}));

const saveIfUnlocked = (state: ProtocolState) => {
  if (!sessionKey || !state.hasHydrated || state.session !== "unlocked" || !state.profile.setupComplete) return;
  const record = readVault();
  if (!record) return;
  try {
    persistVault(record, sessionKey, {
      profile: state.profile, contacts: state.contacts, nodes: state.nodes, cases: state.cases,
      evidence: state.evidence, events: state.events, buffer: state.buffer, custody: state.custody, log: state.log, network: state.network, outbox: state.outbox
    });
  } catch {
    useProtocol.setState({ storageError: "The local vault could not be written. Check available device storage before continuing." });
  }
};

useProtocol.subscribe(saveIfUnlocked);

export function hydrateVault() {
  try {
    const record = readVault();
    if (!record) {
      wipeVault();
      useProtocol.setState({ hasHydrated: true, session: "unlocked" });
      return;
    }
    sessionKey = null;
    useProtocol.setState({ hasHydrated: true, session: "locked", ...emptyPayload(), pinError: null, storageError: null });
  } catch {
    sessionKey = null;
    useProtocol.setState({ hasHydrated: true, session: "locked", pinError: "The local vault could not be opened.", storageError: "Stored local data is unavailable." });
  }
}

if (typeof window !== "undefined") {
  hydrateVault();
  window.addEventListener("storage", event => {
    if (event.key !== "sentinel-v2") {
      if (event.key === "sentinel-v2" && event.newValue === null) {
        sessionKey = null;
        useProtocol.setState({ ...emptyPayload(), session: "unlocked", pinError: null, storageError: null });
      }
      return;
    }
    if (!event.newValue) {
      sessionKey = null;
      useProtocol.setState({ ...emptyPayload(), session: "unlocked", pinError: null, storageError: null });
      return;
    }
    // A non-empty external write cannot be decrypted without re-entering the PIN. Keep this tab state isolated.
  });
}
