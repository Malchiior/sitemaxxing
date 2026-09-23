// Run: node --test tests/url-guard.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkableUrl, isPrivateAddress, UrlRefused } from "../plugins/ro/url-guard.ts";

const publicDns = async () => [{ address: "93.184.216.34" }];
const privateDns = async () => [{ address: "10.0.0.5" }];

test("private, loopback, link-local and metadata addresses are private", () => {
  for (const a of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) assert.ok(isPrivateAddress(a), a);
  for (const a of ["93.184.216.34", "8.8.8.8", "2606:4700::1111"]) assert.ok(!isPrivateAddress(a), a);
});

test("a bare domain becomes https and a path is kept", async () => {
  assert.equal((await checkableUrl("sbeoc.com", publicDns)).href, "https://sbeoc.com/");
  assert.equal((await checkableUrl("sbeoc.com/pricing.", publicDns)).href, "https://sbeoc.com/pricing");
});

test("anything that isn't a public website is refused", async () => {
  for (const bad of ["ftp://sbeoc.com", "http://127.0.0.1", "http://localhost", "https://user:pw@sbeoc.com", "https://sbeoc.com:8080", "http://printer.local", "not a url at all"]) {
    await assert.rejects(checkableUrl(bad, publicDns), UrlRefused, bad);
  }
  await assert.rejects(checkableUrl("https://internal.example.com", privateDns), UrlRefused, "DNS pointing inside");
});
