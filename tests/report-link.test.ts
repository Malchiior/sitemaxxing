// Run: node --test tests/report-link.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { publishReport, withReportLink } from "../plugins/ro/report-link.ts";

const link = { url: "https://sitemaxxing.ai/r/sbeoc.com", code: "114242" };

test("the link and code go after the first sentence, and the handoff sentence mentions the link", () => {
  const text = withReportLink("sbeoc.com fit check attached: 5 things to fix, 75 on phones. Send the PDF to your coding agent as is; it has the fix list. Reply pages to check /about too, or text the URL again after you deploy.", link);
  assert.equal(text, "sbeoc.com fit check attached: 5 things to fix, 75 on phones. Report: sitemaxxing.ai/r/sbeoc.com, code 114242. Give the PDF or that link to your coding agent as is. Reply pages to check /about too, or text the URL again after you deploy.");
  assert.match(withReportLink("sbeoc.com, 4 more pages checked (/a 90): 8 things to fix. The PDF covers all 5 pages; send it to your coding agent as is. Text the URL again after you deploy.", link),
    /^sbeoc\.com, 4 more pages checked \(\/a 90\): 8 things to fix\. Report: sitemaxxing\.ai\/r\/sbeoc\.com, code 114242\. The PDF covers all 5 pages; give it or that link to your coding agent as is\. Text/);
  assert.match(withReportLink("sbeoc.com again (since Sep 22): fixed 2, still there 3, new 0. Phones went from 50 to 88. The PDF has what's left.", link), /new 0\. Report: sitemaxxing\.ai\/r\/sbeoc\.com, code 114242\. Phones went from 50 to 88\. The PDF has what's left\.$/);
});

test("no link, no change; no site configured, no upload", async () => {
  assert.equal(withReportLink("one line.", null), "one line.");
  delete process.env.REPORT_URL; delete process.env.REPORT_KEY;
  assert.equal(await publishReport({ host: "sbeoc.com", kind: "page", pages: 1, summary: "x", pdf: "/nope.pdf", fix: "/nope.md" }), null);
});
