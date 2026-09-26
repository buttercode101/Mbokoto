import { useEffect, useState } from "react";

const TZ="Africa/Johannesburg";
export function formatTime(ts:number){return new Intl.DateTimeFormat("en-GB",{timeZone:TZ,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(ts));}
export function formatDate(ts:number){return new Intl.DateTimeFormat("en-GB",{timeZone:TZ,weekday:"long",day:"numeric",month:"long"}).format(new Date(ts));}
export function formatDateTime(ts:number){return new Intl.DateTimeFormat("en-GB",{timeZone:TZ,weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(ts))+" SAST";}
export function relative(ts:number,now=Date.now()){const delta=Math.round((now-ts)/1000);if(Math.abs(delta)<45)return"just now";const m=Math.round(delta/60);if(Math.abs(m)<60)return m>0?`${m} min ago`:`in ${-m} min`;const h=Math.round(m/60);if(Math.abs(h)<24)return h>0?`${h}h ago`:`in ${-h}h`;const d=Math.round(h/24);return d>0?`${d}d ago`:`in ${-d}d`;}
export function useNow(interval=15000){const[now,setNow]=useState(()=>Date.now());useEffect(()=>{const id=window.setInterval(()=>setNow(Date.now()),interval);return()=>window.clearInterval(id)},[interval]);return now;}
export function uid(prefix="id"){return`${prefix}-${Math.random().toString(36).slice(2,8)}${Date.now().toString(36).slice(-3)}`;}
export function shortHash(input:string){let h=2166136261;for(let i=0;i<input.length;i+=1){h^=input.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,"0");}
export function fingerprint(seed:string){const a=shortHash(seed);const b=shortHash(seed.split("").reverse().join(""));return`SEN-${a.slice(0,4)}-${b.slice(0,4)}`.toUpperCase();}
