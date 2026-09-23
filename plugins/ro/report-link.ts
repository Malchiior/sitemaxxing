// Publish a check's report to the Sitemaxxing site, so the text can carry a
// link and a code instead of only an attachment. Optional: with no
// REPORT_URL / REPORT_KEY in the environment, or when the site doesn't
// answer, the text goes out without the link and the files still attach.
//
// Contract (the site implements it):
//   PUT ${REPORT_URL}/api/reports   Authorization: Bearer ${REPORT_KEY}
//   body JSON: { host, kind: "page" | "pages", pages: number, summary: string,
//                files: [{ name, type, base64 }] }   (the PDF and FIX-PROMPT.md)
//   200 JSON: { url: "https://sitemaxxing.ai/r/sbeoc.com", code: "114242" }
import { readFileSync } from "node:fs";
import { basename } from "node:path";

export type ReportLink = { url: string; code: string };

export async function publishReport(input: { host: string; kind: string; pages: number; summary: string; pdf: string; fix: string }): Promise<ReportLink | null> {
  const base = process.env.REPORT_URL?.replace(/\/$/, "");
  const key = process.env.REPORT_KEY;
  if (!base || !key) return null;
  const file = (path: string, type: string) => ({ name: basename(path), type, base64: readFileSync(path).toString("base64") });
  const response = await fetch(`${base}/api/reports`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ host: input.host, kind: input.kind, pages: input.pages, summary: input.summary,
      files: [file(input.pdf, "application/pdf"), file(input.fix, "text/markdown")] }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`report upload HTTP ${response.status}`);
  const data = await response.json() as Partial<ReportLink>;
  if (!data.url || !data.code) throw new Error("report upload: no url/code in the reply");
  return { url: data.url, code: data.code };
}

/** "sbeoc.com fit check: 5 things to fix, … Report: sitemaxxing.ai/r/sbeoc.com, code 114242. Give the PDF or that link…" */
export function withReportLink(message: string, link: ReportLink | null): string {
  if (!link) return message;
  const shown = link.url.replace(/^https?:\/\//, "");
  const cut = message.indexOf(". ");
  const first = cut === -1 ? message : message.slice(0, cut + 1);
  const rest = cut === -1 ? "" : message.slice(cut + 2);
  return `${first} Report: ${shown}, code ${link.code}. ${rest.replace(/^Send the PDF to your coding agent as is; it has the fix list\./, "Give the PDF or that link to your coding agent as is.").replace(/^The PDF covers all (\d+) pages; send it to your coding agent as is\./, "The PDF covers all $1 pages; give it or that link to your coding agent as is.").replace(/^The PDF has what's left/, "The PDF or that link has what's left")}`.trim();
}
