// Which addresses Sitemaxxing will open. The rules live in render/guard.mjs
// (copied beside this file at build time), which also guards every redirect
// and every browser request during a check: the same code, for the plugin's
// first look at what was texted.
export { checkableUrl, isPrivateAddress, UrlRefused } from "./guard.js";
