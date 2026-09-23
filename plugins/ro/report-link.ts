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

/** "Report: https://…/r/sbeoc.com" and "Code: 114242" as their own lines, after the scores line. */
export function withReportLink(message: string, link: ReportLink | null): string {
  if (!link) return message;
  const lines = message.split("\n");
  lines.splice(Math.min(2, lines.length), 0, `Report: ${link.url}`, `Code: ${link.code}`);
  return lines.join("\n");
}
