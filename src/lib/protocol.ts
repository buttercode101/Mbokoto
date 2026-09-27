import { fingerprint, shortHash, uid } from "@/lib/format";
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";

export type Surface = "sentinel" | "trace" | "blackbox";
export type NetworkLevel = "up" | "degraded" | "down";
export type EventNetwork = "cellular" | "degraded" | "offline";
export type TriggerKind = "wearable-triple-tap" | "wearable-hold" | "volume-pattern" | "missed-checkin" | "manual";
export type NodeKind = "mall" | "estate" | "campus" | "taxi" | "hospital" | "business";
export type NodeStatus = "idle" | "preservation-requested" | "preserving" | "released";
export type CaseStatus = "open" | "coordinating" | "preserved" | "resolved";
export type EvidenceKind = "original" | "derivative";
export type MediaKind = "note" | "photo-hash" | "audio-buffer" | "location" | "cctv-hold" | "summary" | "sensor";

export interface Consent { timelineShare: boolean; nodeParticipation: boolean; acceptedAt: number | null; }
export interface Profile { displayName: string; pinHash: string; decoyPinHash: string; pinSalt: string; setupComplete: boolean; armed: boolean; consent: Consent; demo: boolean; }
export interface TrustedContact { id: string; name: string; relationship: string; keyFingerprint: string; authorised: boolean; }
export interface MeshHop { nodeId: string; label: string; kind: "place" | "contact" | "phone"; at: number; delivered: boolean; }
export interface SafetyEvent { id: string; triggeredAt: number; surface: Surface; trigger: TriggerKind; network: EventNetwork; meshHops: MeshHop[]; status: "queued" | "relayed" | "acknowledged" | "closed"; lockScreenLeak: false; }
export interface LastKnownEvent { id: string; at: number; kind: "check-in" | "place" | "transit" | "phone" | "node-sighting" | "trigger" | "missed"; title: string; detail: string; source: "user" | "node" | "mesh" | "device" | "trusted-contact"; verified: boolean; }
export interface ParticipatingNode { id: string; name: string; kind: NodeKind; area: string; status: NodeStatus; requestedAt?: number; retainsUntil?: number; note: string; }
export interface EvidenceItem { id: string; caseId: string; kind: EvidenceKind; media: MediaKind; title: string; body: string; capturedAt: number; hash: string; sourceOfTruth: boolean; }
export interface TraceCase { id: string; ref: string; subject: string; relation: "self" | "trusted"; openedAt: number; openedBy: string; status: CaseStatus; headline: string; lastKnown: LastKnownEvent[]; nodeIds: string[]; eventIds: string[]; evidenceIds: string[]; retentionHours: number; }
export interface BufferEntry { id: string; at: number; kind: MediaKind; title: string; body: string; hash: string; expiresAt: number; sourceOfTruth: boolean; }
export interface CustodyEntry { id: string; at: number; action: string; actor: "device" | "user" | "trusted-contact" | "node"; detail: string; }
export interface ProtocolLog { id: string; at: number; surface: Surface | "protocol"; text: string; }
export interface NetworkState { cellular: NetworkLevel; ble: boolean; mesh: boolean; }

export const PIN_DEMO = "1408";
export const PIN_DECOY_DEMO = "2580";
export const BUFFER_HOURS = 24;
export const RETENTION_HOURS = 72;

export function hashPin(pin: string, salt: string) { return Array.from(pbkdf2(sha256, pin, salt, { c: 600_000, dkLen: 32 }), b => b.toString(16).padStart(2, "0")).join(""); }
export function nodeLabel(kind: NodeKind) {
  switch (kind) {
    case "mall": return "Shopping centre";
    case "estate": return "Estate";
    case "campus": return "Campus";
    case "taxi": return "Taxi association";
    case "hospital": return "Hospital";
    case "business": return "Business";
  }
}
export function emptyProfile(): Profile {
  return { displayName:"", pinHash:"", decoyPinHash:"", pinSalt:"", setupComplete:false, armed:false,
    consent:{timelineShare:false,nodeParticipation:false,acceptedAt:null}, demo:false };
}
export function demoNodes(_now: number): ParticipatingNode[] {
  return [
    {id:"node-eastgate",name:"Eastgate Shopping Centre",kind:"mall",area:"Bedfordview",status:"idle",note:"Preservation desk only. No live camera feed leaves the site."},
    {id:"node-rank",name:"Eastgate taxi rank",kind:"taxi",area:"Bedfordview / Boksburg corridor",status:"idle",note:"Rank marshals. Last-seen statements, not tracking."},
    {id:"node-estate",name:"Bedford Gardens estate",kind:"estate",area:"Bedfordview",status:"idle",note:"Gate logs and perimeter holds, opt-in per household."},
    {id:"node-ortambo",name:"OR Tambo precinct",kind:"business",area:"Kempton Park",status:"idle",note:"Public-area retention under site policy."},
    {id:"node-netcare",name:"Netcare Garden City",kind:"hospital",area:"Mayfair West",status:"idle",note:"Admissions check only. No clinical record sharing."},
    {id:"node-uj",name:"UJ Kingsway campus",kind:"campus",area:"Auckland Park",status:"idle",note:"Campus protection unit. Hold, do not stream."}
  ];
}
export function nextCaseRef(existing: TraceCase[]) { return `SEN-2026-${String(existing.length+1).padStart(3,"0")}`; }
export function networkLabel(level: NetworkLevel) { return level==="up" ? "Cellular up" : level==="degraded" ? "Cellular degraded" : "Cellular down"; }
export function eventNetworkFrom(level: NetworkLevel): EventNetwork { return level==="up" ? "cellular" : level==="degraded" ? "degraded" : "offline"; }
export function buildHops(nodes: ParticipatingNode[], contacts: TrustedContact[], at: number): MeshHop[] {
  const place=nodes.find(n=>n.id==="node-rank")??nodes[0]; const contact=contacts[0];
  const hops:MeshHop[]=[{nodeId:"phone",label:"This phone (locked)",kind:"phone",at,delivered:true}];
  if(place) hops.push({nodeId:place.id,label:place.name,kind:"place",at:at+400,delivered:false});
  if(contact) hops.push({nodeId:contact.id,label:`${contact.name} · trusted key`,kind:"contact",at:at+900,delivered:false});
  return hops;
}
export const RESOURCES = [
  {name:"SAPS",number:"10111",detail:"Police emergency"},
  {name:"Ambulance",number:"10177",detail:"Medical emergency"},
  {name:"GBV Command Centre",number:"0800 428 428",detail:"24-hour GBV support"},
  {name:"GBV Please Call Me",number:"*120*7867#",detail:"USSD, no airtime needed"},
  {name:"SADAG",number:"0800 567 567",detail:"Mental health, 24-hour"},
  {name:"Childline",number:"116",detail:"Children and adolescents"}
] as const;

export function buildDemo(now=Date.now()) {
  const ago=(m:number)=>now-m*60_000;
  const contacts:TrustedContact[]=[
    {id:"c-naledi",name:"Naledi Khumalo",relationship:"Sister",keyFingerprint:fingerprint("naledi-khumalo-independent-key"),authorised:true},
    {id:"c-sipho",name:"Sipho Dlamini",relationship:"Friend",keyFingerprint:fingerprint("sipho-dlamini-independent-key"),authorised:true}
  ];
  const nodes=demoNodes(now);
  const lastKnown:LastKnownEvent[]=[
    {id:"lk-1",at:ago(268),kind:"check-in",title:"Left home",detail:"Explicit check-in. Pre-authorised trail only.",source:"user",verified:true},
    {id:"lk-2",at:ago(214),kind:"place",title:"Eastgate, P2 parking",detail:"Authorised node ping. Not continuous GPS.",source:"node",verified:true},
    {id:"lk-3",at:ago(196),kind:"transit",title:"Eastgate taxi rank",detail:"Last phone activity. Cellular degraded.",source:"device",verified:true},
    {id:"lk-4",at:ago(124),kind:"missed",title:"Expected home",detail:"Check-in window closed. Case eligible immediately.",source:"device",verified:true}
  ];
  const caseId="case-lerato";
  const evidence:EvidenceItem={id:"ev-hold-pending",caseId,kind:"original",media:"note",title:"Case opened — no footage transferred",body:"Preservation has not been requested. Originals remain at participating nodes until a hold is placed.",capturedAt:ago(118),hash:shortHash("case-opened-lerato"),sourceOfTruth:true};
  const traceCase:TraceCase={id:caseId,ref:"SEN-2026-014",subject:"Lerato Maseko",relation:"trusted",openedAt:ago(118),openedBy:"Naledi Khumalo",status:"open",headline:"Lerato has not arrived",lastKnown,nodeIds:nodes.map(n=>n.id),eventIds:[],evidenceIds:[evidence.id],retentionHours:RETENTION_HOURS};
  const buffer:BufferEntry[]=[
    {id:"buf-1",at:ago(268),kind:"location",title:"Check-in · Bedford Gardens",body:"Coarse place name only. Not a live track.",hash:shortHash("checkin-bedford"),expiresAt:ago(268)+BUFFER_HOURS*3600_000,sourceOfTruth:true},
    {id:"buf-2",at:ago(220),kind:"audio-buffer",title:"Ambient buffer · 47s",body:"Local rolling audio. Not uploaded.",hash:shortHash("audio-47s"),expiresAt:ago(220)+BUFFER_HOURS*3600_000,sourceOfTruth:true}
  ];
  const custody:CustodyEntry[]=[
    {id:uid("cus"),at:ago(400),action:"Protocol armed",actor:"user",detail:"Lerato armed Sentinel. Silent tracking remains off."},
    {id:uid("cus"),at:ago(268),action:"Check-in recorded",actor:"user",detail:"Local buffer with pre-authorised trail sharing."},
    {id:uid("cus"),at:ago(118),action:"Case opened",actor:"trusted-contact",detail:"Case opened with independent contact key."}
  ];
  const log:ProtocolLog[]=[
    {id:uid("log"),at:ago(118),surface:"trace",text:"Case SEN-2026-014 opened — Lerato has not arrived."},
    {id:uid("log"),at:ago(124),surface:"protocol",text:"Check-in window closed. Early reporting path is open."}
  ];
  const demoSalt="mbokoto-demo-salt-v1"; const profile:Profile={displayName:"Lerato Maseko",pinHash:hashPin(PIN_DEMO,demoSalt),decoyPinHash:hashPin(PIN_DECOY_DEMO,demoSalt),pinSalt:demoSalt,setupComplete:true,armed:true,consent:{timelineShare:true,nodeParticipation:true,acceptedAt:ago(800)},demo:true};
  return {profile,contacts,nodes,cases:[traceCase] as TraceCase[],evidence:[evidence] as EvidenceItem[],events:[] as SafetyEvent[],buffer,custody,log};
}
