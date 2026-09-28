import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {toolAccess} from "../plugins/ro/access.ts";
test("studio is declared, enabled, built and owner-only",()=>{
 const manifest=JSON.parse(readFileSync("plugins/ro/openclaw.plugin.json","utf8"));assert.ok(manifest.contracts.tools.includes("ro_studio"));
 assert.match(readFileSync("boot/ro-config.ts","utf8"),/RO_TOOLS = \[[^\]]*"ro_studio"/);
 assert.match(readFileSync("build-ro.ts","utf8"),/"studio"/);
 assert.equal(toolAccess("ro_studio",{senderId:"owner",senderIsOwner:true}),undefined);
 for(const requester of [undefined,{senderId:"guest",senderIsOwner:false},{senderIsOwner:true}])assert.equal(toolAccess("ro_studio",requester)?.block,true);
});
