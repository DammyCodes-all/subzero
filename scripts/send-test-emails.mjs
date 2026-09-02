#!/usr/bin/env node
// Plain text test — no HTML
import { readFileSync } from "fs";
const to = process.argv[3] || "harliarmeen@gmail.com";
const type = process.argv[2] || "all";
const apiKey = process.env.AGENTMAIL_API_KEY;
if (!apiKey) { console.error("Missing AGENTMAIL_API_KEY"); process.exit(1); }
function formatPrice(p,c){ try{return new Intl.NumberFormat("en-US",{style:"currency",currency:c}).format(p);}catch{return `${c} ${p}`;}}
function formatDate(ms){ return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(new Date(ms));}
function siteUrl(){ return (process.env.SITE_URL||"http://localhost:3000").replace(/\/$/,"");}
function tpl(type,input){
  const priceStr=formatPrice(input.price,input.currency);
  const dash=input.dashboardUrl||`${siteUrl()}/subscriptions/${input.subscriptionId||""}`;
  if(type==="7d"||type==="3d"||type==="24h"){
    const label=type==="7d"?"renews in 7 days":type==="3d"?"renews in 3 days":"renews tomorrow!";
    return {subject:`Renewal Alert: ${input.merchant} ${label}`, text:`Hi there,\nYour ${input.merchant} ${priceStr}/${input.billingInterval} ${label} — ${formatDate(input.nextRenewalAt)}.\n\nCancel: ${dash}\nDirect: ${input.cancellationUrl||"Open SubZero"}\n\n— SubZero`};
  }
  if(type==="trial") return {subject:`Trial ending: ${input.merchant} — ${formatDate(input.trialEndsAt)}`, text:`Trial ${input.merchant} ends ${formatDate(input.trialEndsAt)} → then ${priceStr}/${input.billingInterval}\n${dash}`};
  if(type==="cancelled") return {subject:`Cancelled: ${input.merchant} — you're all set`, text:`Cancelled ${input.merchant} ${priceStr} saved.\n${dash}`};
  if(type==="reminder") return {subject:`Still need to cancel ${input.merchant}?`, text:`Reminder — you started cancelling ${input.merchant} but it's still active. Renews ${formatDate(input.nextRenewalAt)}\n${dash}`};
  throw new Error(type);
}
async function send(to,t){
  console.log(`→ ${to} | ${t.subject}`);
  const inboxId=process.env.AGENTMAIL_INBOX||"subzero-agent@agentmail.to";
  const res=await fetch(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxId)}/messages/send`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${apiKey}`},body:JSON.stringify({to,subject:t.subject,text:t.text})});
  const body=await res.text(); console.log(res.ok?`✔ ${res.status}`:`✘ ${res.status} ${body.slice(0,400)}`); if(!res.ok) throw new Error(body);
}
const base={merchant:"Google One",product:"Google AI Plus (400 GB)",price:7700,currency:"NGN",billingInterval:"monthly",nextRenewalAt:Date.now()+6*86400000,trialEndsAt:Date.now()+2*86400000,cancellationUrl:"https://play.google.com/store/account/subscriptions",dashboardUrl:`${siteUrl()}/subscriptions/demo`,subscriptionId:"demo"};
if(type==="all"){ for(const t of ["7d","3d","24h","trial","cancelled","reminder"]){ await send(to,tpl(t,base)); await new Promise(r=>setTimeout(r,800)); } } else { await send(to,tpl(type,base)); }
console.log("done to",to);
