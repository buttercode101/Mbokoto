import { useEffect, useState } from "react";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes } from "@noble/hashes/utils.js";

const TZ="Africa/Johannesburg";
const encoder=new TextEncoder();
export function formatTime(ts:number){return new Intl.DateTimeFormat("en-GB",{timeZone:TZ,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(ts));}
export function formatDate(ts:number){return new Intl.DateTimeFormat("en-GB",{timeZone:TZ,weekday:"long",day:"numeric",month:"long"}).format(new Date(ts));}
export function formatDateTime(ts:number){return new Intl.DateTimeFormat("en-GB",{timeZone:TZ,weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(ts))+" SAST";}
export function relative(ts:number,now=Date.now()){const delta=Math.round((now-ts)/1000);if(Math.abs(delta)<45)return"just now";const m=Math.round(delta/60);if(Math.abs(m)<60)return m>0?m+" min ago":"in "+(-m)+" min";const h=Math.round(m/60);if(Math.abs(h)<24)return h>0?h+"h ago":"in "+(-h)+"h";const d=Math.round(h/24);return d>0?d+"d ago":"in "+(-d)+"d";}
export function useNow(interval=15000){const[now,setNow]=useState(()=>Date.now());useEffect(()=>{const id=window.setInterval(()=>setNow(Date.now()),interval);return()=>window.clearInterval(id)},[interval]);return now;}
export function uid(prefix="id"){const id=globalThis.crypto?.randomUUID?.()??Array.from(randomBytes(16),b=>b.toString(16).padStart(2,"0")).join("");return prefix+"-"+id;}
export function shortHash(input:string){return Array.from(sha256(encoder.encode(input)),b=>b.toString(16).padStart(2,"0")).join("").slice(0,16);}
export function randomSalt(){return Array.from(randomBytes(16),b=>b.toString(16).padStart(2,"0")).join("");}
export function fingerprint(seed:string){const a=shortHash(seed);const b=shortHash(seed.split("").reverse().join(""));return("SEN-"+a.slice(0,4)+"-"+b.slice(0,4)).toUpperCase();}