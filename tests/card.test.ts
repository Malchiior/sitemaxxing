// Run: node --test tests/card.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { contactCard } from "../boot/ro-card.ts";

test("a phone line becomes a vCard with TEL", () => {
  const card = contactCard("Sitemaxxing", "+16503156335")!;
  assert.match(card, /^BEGIN:VCARD\r\nVERSION:3\.0\r\n/);
  assert.match(card, /\r\nFN:Sitemaxxing\r\n/);
  assert.match(card, /\r\nTEL;TYPE=CELL:\+16503156335\r\n/);
  assert.match(card, /END:VCARD\r\n$/);
});

test("an email line becomes EMAIL; anything else, no card", () => {
  assert.match(contactCard("Sitemaxxing", "agent@example.com")!, /\r\nEMAIL:agent@example\.com\r\n/);
  assert.equal(contactCard("Sitemaxxing", undefined), null);
  assert.equal(contactCard("Sitemaxxing", "not an address"), null);
});

test("commas and semicolons in text are escaped", () => {
  assert.match(contactCard("Acme, Inc; Web", "+15551234567")!, /FN:Acme\\, Inc\\; Web/);
});
