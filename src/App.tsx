import {useState} from "react";
import {useProtocol} from "@/lib/store";
import {PIN_DECOY_DEMO,PIN_DEMO} from "@/lib/protocol";

type Page="home"|"sentinel"|"trace"|"blackbox"|"setup";
const surfaces:{id:Page;title:string;eyebrow:string;copy:string}[]=[
 {id:"sentinel",title:"Sentinel",eyebrow:"TRIGGER",copy:"Discreet safety activation through a wearable or phone pattern."},
 {id:"trace",title:"Trace",eyebrow:"FIND",copy:"Last-known timeline, early reporting and preservation holds."},
 {id:"blackbox",title:"Blackbox",eyebrow:"PRESERVE",copy:"Local incident memory, evidence hashes and controlled deletion."}
];

export default function App(){
 const [page,setPage]=useState<Page>("home");
 const profile=useProtocol(s=>s.profile);
 const loadDemo=useProtocol(s=>s.loadDemo);
 const resetAll=useProtocol(s=>s.resetAll);
 if(page==="setup")return <Setup onDone={()=>setPage("home")} onBack={()=>setPage("home")}/>;
 return <div className="shell">
  <header><button className="brand" onClick={()=>setPage("home")}>MBOKOTO <span>/ SENTINEL</span></button>
   <nav>{profile.setupComplete&&surfaces.map(s=><button key={s.id} className={page===s.id?"active":""} onClick={()=>setPage(s.id)}>{s.title}</button>)}</nav>
  </header>
  {page==="home"&&!profile.setupComplete&&<Landing onDemo={()=>{loadDemo();setPage("home")}} onSetup={()=>setPage("setup")}/>}
  {page==="home"&&profile.setupComplete&&<Hub setPage={setPage}/>}
  {page==="sentinel"&&<Sentinel/>}
  {page==="trace"&&<Trace/>}
  {page==="blackbox"&&<Blackbox/>}
  <footer><span>Local-first · no silent tracking</span><span>{profile.demo?"DEMONSTRATION MODE":"REAL DEVICE MODE"}</span>{profile.setupComplete&&<button onClick={()=>{resetAll();setPage("home")}}>Reset local data</button>}</footer>
 </div>
}

function Landing({onDemo,onSetup}:{onDemo:()=>void;onSetup:()=>void}){return <main className="hero">
 <div className="eyebrow">SAFETY-EVENT PROTOCOL</div><h1>SENTINEL</h1><p className="lead">The trail, held in trust.</p>
 <p className="copy">A shared safety protocol for the moment someone does not arrive, a discreet trigger when the phone stays locked, and a local evidence trail that does not depend on an always-on connection.</p>
 <div className="actions"><button className="primary" onClick={onDemo}>Enter demonstration</button><button onClick={onSetup}>Set up for yourself</button></div>
 <div className="grid">{surfaces.map(s=><article key={s.id}><small>{s.eyebrow}</small><h2>{s.title}</h2><p>{s.copy}</p></article>)}</div>
 <div className="principles"><p>✓ Explicit, pre-authorised sharing</p><p>✓ No open CCTV access</p><p>✓ Original evidence remains source of truth</p><p>✓ Emergency deletion stays on-device</p></div>
 </main>}

function Hub({setPage}:{setPage:(p:Page)=>void}){const p=useProtocol(s=>s.profile);const cases=useProtocol(s=>s.cases);const net=useProtocol(s=>s.network);const check=useProtocol(s=>s.addCheckIn);const [place,setPlace]=useState("Bedford Gardens");const open=cases.find(c=>c.status==="open"||c.status==="coordinating");return <main className="content"><div className="eyebrow">PROTOCOL ARMED</div><h1>Welcome, {p.displayName.split(" ")[0]}</h1><p className="copy">Cellular: <b>{net.cellular}</b>. Trusted contacts are locally authorised. Silent tracking is not active.</p>
 {open&&<section className="alert"><small>{open.ref}</small><h2>{open.headline}</h2><p>Opened by {open.openedBy}. Early reporting is available immediately.</p><button onClick={()=>setPage("trace")}>Open Trace</button></section>}
 <div className="grid">{surfaces.map(s=><article className="clickable" key={s.id} onClick={()=>setPage(s.id)}><small>{s.eyebrow}</small><h2>{s.title}</h2><p>{s.copy}</p></article>)}</div>
 <section className="panel"><small>CHECK-IN</small><h2>Record where you are</h2><div className="inline"><input value={place} onChange={e=>setPlace(e.target.value)}/><button onClick={()=>check(place)}>Check in</button></div><p className="muted">Coarse place name only. This is not live tracking.</p></section>
 </main>}

function Sentinel(){const p=useProtocol(s=>s.profile);const net=useProtocol(s=>s.network);const trigger=useProtocol(s=>s.triggerSentinel);const events=useProtocol(s=>s.events);const setArmed=useProtocol(s=>s.setArmed);const [msg,setMsg]=useState("");const fire=(kind:"manual"|"volume-pattern"|"wearable-triple-tap")=>{const id=trigger(kind);setMsg(id?"Safety event queued: "+id:"Sentinel is disarmed.");};return <main className="content"><div className="eyebrow">SENTINEL / TRIGGER</div><h1>Trigger without a screen.</h1><p className="copy">The phone remains dark. A compatible wearable can trigger the same protocol. Without a real relay, events remain local rather than pretending delivery happened.</p><div className="panel"><div className="row"><div><small>ARMED STATE</small><h2>{p.armed?"Ready":"Disarmed"}</h2></div><button onClick={()=>setArmed(!p.armed)}>{p.armed?"Disarm":"Arm"}</button></div><div className="trigger-grid"><button onClick={()=>fire("wearable-triple-tap")}>Wearable · triple tap</button><button onClick={()=>fire("volume-pattern")}>Phone · volume pattern</button><button onClick={()=>fire("manual")}>Manual test</button></div>{msg&&<p className="success">{msg}</p>}</div><section className="panel"><small>RECENT EVENTS</small>{events.length?events.slice(0,5).map(e=><div className="event" key={e.id}><b>{e.trigger}</b><span>{e.network} · {e.status}</span></div>):<p className="muted">No events on this device.</p>}</section><p className="warning">No lock-screen leak is emitted by the protocol.</p></main>}

function Trace(){const cases=useProtocol(s=>s.cases);const nodes=useProtocol(s=>s.nodes);const openCase=useProtocol(s=>s.openCase);const preserve=useProtocol(s=>s.requestPreservation);const resolve=useProtocol(s=>s.resolveCase);const [subject,setSubject]=useState("");const open=cases[0];return <main className="content"><div className="eyebrow">TRACE / FIND</div><h1>Someone has not arrived.</h1><p className="copy">Open a case from the last-known trail. Participating places receive preservation requests, not open camera access.</p><section className="panel"><small>NEW CASE</small><div className="inline"><input placeholder="Name" value={subject} onChange={e=>setSubject(e.target.value)}/><button disabled={!subject.trim()} onClick={()=>{openCase({subject,relation:"trusted",openedBy:"Device user"});setSubject("")}}>Open case</button></div></section>{cases.map(c=><section className="panel" key={c.id}><div className="row"><div><small>{c.ref} · {c.status}</small><h2>{c.headline}</h2></div>{c.status!=="resolved"&&<button onClick={()=>resolve(c.id)}>Resolve</button>}</div><p>{c.lastKnown.length} last-known events · {c.evidenceIds.length} evidence records</p><div className="nodes">{nodes.length?nodes.map(n=><button key={n.id} onClick={()=>preserve(c.id,n.id)} disabled={n.status==="preserving"||n.status==="released"}>{n.name}<span>{n.status}</span></button>):<p className="muted">No participating places are configured on a real device.</p>}</div></section>)}</main>}

function Blackbox(){const buffer=useProtocol(s=>s.buffer);const custody=useProtocol(s=>s.custody);const note=useProtocol(s=>s.addNote);const wipe=useProtocol(s=>s.emergencyWipe);const [text,setText]=useState("");return <main className="content"><div className="eyebrow">BLACKBOX / PRESERVE</div><h1>Your incident memory stays yours.</h1><p className="copy">Local rolling records, hashes and custody entries. Derivatives never replace original evidence.</p><section className="panel"><div className="inline"><input placeholder="Private note" value={text} onChange={e=>setText(e.target.value)}/><button onClick={()=>{if(text.trim()){note("Private note",text);setText("")}}}>Save locally</button></div></section><section className="panel"><small>LOCAL BUFFER</small>{buffer.length?buffer.slice(0,8).map(b=><div className="event" key={b.id}><b>{b.title}</b><span>{b.kind} · {b.hash}</span></div>):<p className="muted">Buffer empty.</p>}</section><section className="panel"><small>CHAIN OF CUSTODY</small>{custody.slice(0,8).map(c=><div className="event" key={c.id}><b>{c.action}</b><span>{c.actor} · {c.detail}</span></div>)}</section><button className="danger" onClick={wipe}>Emergency delete local trail</button></main>}

function Setup({onDone,onBack}:{onDone:()=>void;onBack:()=>void}){const setup=useProtocol(s=>s.completeSetup);const [name,setName]=useState("");const [pin,setPin]=useState("");const [decoy,setDecoy]=useState("");const [contact,setContact]=useState("");const [error,setError]=useState("");return <main className="content narrow"><div className="eyebrow">SETUP</div><h1>Arm the protocol.</h1><p className="copy">This stores authorisation on the device. It does not create an account or silently track you.</p><div className="panel form"><label>Name<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Device PIN<input inputMode="numeric" maxLength={4} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))}/></label><label>Safe-mode PIN<input inputMode="numeric" maxLength={4} value={decoy} onChange={e=>setDecoy(e.target.value.replace(/\D/g,""))}/></label><label>Trusted contact<input value={contact} onChange={e=>setContact(e.target.value)}/></label>{error&&<p className="danger-text">{error}</p>}<div className="actions"><button onClick={onBack}>Cancel</button><button className="primary" onClick={()=>{if(name.trim().length<2||!/^[0-9]{4}$/.test(pin)||!/^[0-9]{4}$/.test(decoy)||pin===decoy||contact.trim().length<2){setError("Use a name, two different four-digit PINs and one trusted contact.");return}setup({displayName:name,pin,decoyPin:decoy,contacts:[{name:contact,relationship:"Trusted contact"}],consent:{timelineShare:true,nodeParticipation:true}});onDone()}}>Arm protocol</button></div></div><p className="muted">Demonstration PINs: {PIN_DEMO} / safe-mode {PIN_DECOY_DEMO}. These are demonstration-only values.</p></main>}
