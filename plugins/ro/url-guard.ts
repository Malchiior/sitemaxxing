// Which addresses Sitemaxxing will open. Public websites only: the
// check runs a real browser inside the container, so an internal address
// (localhost, a private network, cloud metadata) must never reach it.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class UrlRefused extends Error {}

/** True for loopback, private, link-local, carrier-grade NAT, multicast and reserved ranges. */
export function isPrivateAddress(address: string): boolean {
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

/** Normalize what someone texted ("sbeoc.com", "https://www.sbeoc.com/about") into a URL we're willing to open. */
export async function checkableUrl(input: string, resolve = lookup): Promise<URL> {
  const text = input.trim().replace(/[)>\].,!?]+$/, "");
  let url: URL;
  try { url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`); }
  catch { throw new UrlRefused("That doesn't look like a web address."); }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UrlRefused("Only web addresses (http or https) can be checked.");
  if (url.username || url.password) throw new UrlRefused("Send the address without a username or password in it.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new UrlRefused("Only public websites on the normal web ports can be checked.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) throw new UrlRefused("Send the site's name, not an IP address.");
  if (!host.includes(".") || /\.(local|internal|localhost|lan|home|corp)$/i.test(host) || host === "localhost") {
    throw new UrlRefused("Only public websites can be checked.");
  }
  let addresses: { address: string }[];
  try { addresses = await resolve(host, { all: true }) as { address: string }[]; }
  catch { throw new UrlRefused(`${host} doesn't resolve to a website. Check the spelling?`); }
  if (!addresses.length || addresses.some(a => isPrivateAddress(a.address))) throw new UrlRefused("Only public websites can be checked.");
  url.hash = "";
  return url;
}
