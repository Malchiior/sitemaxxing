// Run: node --test tests/guard.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { allowed, assertPublic, safeFetch, UrlRefused } from "../render/guard.mjs";

const publicDns = async () => [{ address: "93.184.216.34" }];
const privateDns = async () => [{ address: "10.0.0.5" }];
const byHost = async host => host.startsWith("internal.") ? privateDns() : publicDns();

test("assertPublic: the rules the first address gets, for any address", async () => {
  await assertPublic(new URL("https://sbeoc.com/about"), publicDns);
  for (const bad of ["http://127.0.0.1/", "http://169.254.169.254/latest/meta-data", "http://localhost/", "https://sbeoc.com:8443/", "https://u:p@sbeoc.com/", "ftp://sbeoc.com/", "http://printer.local/"]) {
    await assert.rejects(assertPublic(new URL(bad), publicDns), UrlRefused, bad);
  }
  await assert.rejects(assertPublic(new URL("https://internal.example.com/"), byHost), UrlRefused, "DNS pointing inside");
  assert.equal(await allowed("https://sbeoc.com/x.png", publicDns), true);
  assert.equal(await allowed("http://10.1.2.3/x.png", publicDns), false);
  assert.equal(await allowed("https://internal.example.com/x.png", byHost), false);
});

test("safeFetch: a redirect to a private address stops there", async () => {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    assert.equal(init.redirect, "manual");
    if (calls.length === 1) return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } });
    return new Response("should not get here", { status: 200 });
  };
  try {
    await assert.rejects(safeFetch("https://sbeoc.com/", {}, publicDns), UrlRefused);
    assert.deepEqual(calls, ["https://sbeoc.com/"], "the private hop was never fetched");
  } finally { globalThis.fetch = real; }
});

test("safeFetch: public redirects are followed, up to five hops", async () => {
  const real = globalThis.fetch;
  let n = 0;
  globalThis.fetch = async url => (++n <= 2
    ? new Response(null, { status: 301, headers: { location: `https://www.sbeoc.com/hop${n}` } })
    : new Response("home", { status: 200 }));
  try {
    const res = await safeFetch("https://sbeoc.com/", {}, publicDns);
    assert.equal(await res.text(), "home");
    assert.equal(n, 3);
    n = -100;
    await assert.rejects(safeFetch("https://sbeoc.com/", {}, publicDns), /Too many redirects/);
  } finally { globalThis.fetch = real; }
});
