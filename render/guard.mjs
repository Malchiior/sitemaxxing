// Public destinations only, everywhere a check reaches the network: the
// address the person texted, every redirect after it, every request the
// browser makes while rendering, and every GET the checks make themselves.
// The check runs a real browser inside the container, so an internal address
// (localhost, a private network, cloud metadata) must never be reached, not
// even one hop away.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class UrlRefused extends Error {}

/** True for loopback, private, link-local, carrier-grade NAT, multicast and reserved ranges. */
export function isPrivateAddress(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const v6 = address.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9")
    || v6.startsWith("fea") || v6.startsWith("feb") || v6.startsWith("ff");
}

const PRIVATE_NAMES = /\.(local|internal|localhost|lan|home|corp)$/i;

/** Resolved addresses per host, so a page with 200 requests to one CDN costs one lookup. */
const cache = new Map();
export async function resolves(host, resolve = lookup) {
  if (resolve !== lookup) return resolve(host, { all: true });
  if (!cache.has(host)) cache.set(host, resolve(host, { all: true }).catch(error => { cache.delete(host); throw error; }));
  return cache.get(host);
}

/**
 * Is this URL somewhere a check may go? Public web address, normal ports, no
 * credentials, a name (not an IP) that resolves only to public addresses.
 * Throws UrlRefused with a reason in plain words.
 */
export async function assertPublic(url, resolve = lookup) {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UrlRefused("Only web addresses (http or https) can be checked.");
  if (url.username || url.password) throw new UrlRefused("Send the address without a username or password in it.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new UrlRefused("Only public websites on the normal web ports can be checked.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) throw new UrlRefused("Send the site's name, not an IP address.");
  if (!host.includes(".") || PRIVATE_NAMES.test(host) || host === "localhost") throw new UrlRefused("Only public websites can be checked.");
  let addresses;
  try { addresses = await resolves(host, resolve); }
  catch { throw new UrlRefused(`${host} doesn't resolve to a website. Check the spelling?`); }
  if (!addresses.length || addresses.some(a => isPrivateAddress(a.address))) throw new UrlRefused("Only public websites can be checked.");
  return url;
}

/** True when a request to this URL may go out: same rules, never throws (for the browser's request guard). */
export async function allowed(href, resolve = lookup) {
  try { await assertPublic(new URL(href), resolve); return true; }
  catch { return false; }
}

/** Normalize what someone texted ("sbeoc.com", "https://www.sbeoc.com/about") into a URL we're willing to open. */
export async function checkableUrl(input, resolve = lookup) {
  const text = input.trim().replace(/[)>\].,!?]+$/, "");
  let url;
  try { url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`); }
  catch { throw new UrlRefused("That doesn't look like a web address."); }
  await assertPublic(url, resolve);
  url.hash = "";
  return url;
}

/**
 * fetch() that checks every hop: the first address and each redirect after
 * it must pass assertPublic, or the request stops there (UrlRefused). At
 * most five redirects.
 */
export async function safeFetch(input, init = {}, resolve = lookup) {
  let url = new URL(input);
  for (let hop = 0; hop <= 5; hop++) {
    await assertPublic(url, resolve);
    const response = await fetch(url, { ...init, redirect: "manual" });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) return response;
    await response.body?.cancel().catch(() => {});
    url = new URL(location, url);
    if (response.status === 303 || ((response.status === 301 || response.status === 302) && init.method && init.method !== "GET")) init = { ...init, method: "GET", body: undefined };
  }
  throw new UrlRefused("Too many redirects.");
}
