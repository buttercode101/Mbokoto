import { fingerprint, shortHash, uid } from "@/lib/format";

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
export interface Profile { displayName: string; pinHash: string; decoyPinHash: string; setupComplete: boolean; armed: boolean; consent: Consent; demo: boolean; }
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

export function hashPin(pin: string) { return shortHash(`sentinel-pin:${pin}`); }
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
  return { displayName:"", pinHash:"", decoyPinHash:"", setupComplete:false, armed:false,
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
