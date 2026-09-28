import {readFileSync,writeFileSync,existsSync} from "node:fs";
import {join} from "node:path";
import {ownerChatUid,sendText} from "./plow-api.ts";
export async function openStudio(dir:string,mode:"redesign"|"assets"|"package",direction?:string){
 const base=process.env.REPORT_URL?.replace(/\/$/,"");const key=process.env.REPORT_KEY;const agentToken=process.env.PLOW_AGENT_TOKEN;
 if(!base||!key||!agentToken)throw new Error("The design workspace is not configured for this agent yet. Your regular reports still work.");
 const ownerChat=await ownerChatUid();
 const file=join(dir,"summary.json");const summary=JSON.parse(readFileSync(file,"utf8"));
 const payload:Record<string,unknown>={ownerChat,mode,direction:direction?.trim().slice(0,2000),projectId:summary.studioProjectId,site:summary.site,summary:summary.message,fix:readFileSync(summary.fixPrompt||join(dir,"FIX-PROMPT.md"),"utf8"),pdf:readFileSync(summary.report).toString("base64"),pages:(summary.pages||[]).map((p:{label?:string;path?:string;url:string})=>({label:p.label||p.path||"Page",url:p.url}))};
 const auditFile=join(summary.firstRun||dir,"audit.json");
 if(existsSync(auditFile)){const audit=JSON.parse(readFileSync(auditFile,"utf8"));const screen=audit.screens?.find((s:{id:string})=>s.id==="laptop");if(screen?.foldJpeg&&existsSync(screen.foldJpeg)){const image=readFileSync(screen.foldJpeg);if(image.length<=500000)payload.reference=image.toString("base64");}}
 if(Buffer.byteLength(JSON.stringify(payload))>4_000_000)delete payload.reference;
 const r=await fetch(`${base}/api/studio/projects`,{method:"POST",headers:{Authorization:`Bearer ${key}`,"X-Plow-Agent-Token":agentToken,"Content-Type":"application/json"},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw new Error("Couldn't open the private workspace. Try again later; no image generation was started.");
 const result=await r.json() as {url:string;projectId:string};
 if(new URL(result.url).origin!==new URL(base).origin||!/^[a-f0-9]{32}$/.test(result.projectId))throw new Error("Workspace returned an invalid link.");
 summary.studioProjectId=result.projectId;writeFileSync(file,JSON.stringify(summary,null,2));
 // The private owner link goes only to Plow's verified owner conversation,
 // never through model context, the public report or the calling chat.
 await sendText(ownerChat,`Your private ${mode} workspace:\n${result.url}\nLink expires in 15 minutes. Review your project colors and visual direction there, then choose your scope. Never text an API key. Image generation only starts after you approve it on the website.`);
 return "The private workspace link was sent to the owner's conversation. No image generation was started. Do not send another message.";
}
