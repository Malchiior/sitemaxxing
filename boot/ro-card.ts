/**
 * A contact card (vCard 3.0) for this install's own line, so the person can
 * save it with one tap. `key` is the line's address from Plow's identity:
 * a phone number for iMessage/SMS lines, or an email address.
 */
export function contactCard(name: string, key: string | undefined): string | null {
  const esc = (value: string) => value.replace(/[\\,;]/g, c => `\\${c}`);
  const reach = key && /^\+\d{8,15}$/.test(key) ? `TEL;TYPE=CELL:${key}`
    : key && /^[^@\s]+@[^@\s]+$/.test(key) ? `EMAIL:${key}`
    : null;
  if (!reach) return null;
  return [
    "BEGIN:VCARD", "VERSION:3.0",
    `N:;${esc(name)};;;`, `FN:${esc(name)}`, `ORG:${esc(name)}`,
    reach,
    `NOTE:${esc("Text me your website for a fit check: 9 screens, Google and AI readability.")}`,
    "URL:https://aiworthusing.com/agent-index/sitemaxxing",
    "END:VCARD", "",
  ].join("\r\n");
}
