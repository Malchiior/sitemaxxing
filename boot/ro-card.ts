/**
 * A contact card (vCard 3.0) for this install's own line, so the person can
 * save it with one tap. `key` is the line's address from Plow's identity:
 * a phone number for iMessage/SMS lines, or an email address. `photoJpeg`,
 * if given, becomes the contact's photo.
 */
export function contactCard(name: string, key: string | undefined, photoJpeg?: Buffer): string | null {
  const esc = (value: string) => value.replace(/[\\,;]/g, c => `\\${c}`);
  const reach = key && /^\+\d{8,15}$/.test(key) ? `TEL;TYPE=CELL:${key}`
    : key && /^[^@\s]+@[^@\s]+$/.test(key) ? `EMAIL:${key}`
    : null;
  if (!reach) return null;
  const lines = [
    "BEGIN:VCARD", "VERSION:3.0",
    `N:;${esc(name)};;;`, `FN:${esc(name)}`, `ORG:${esc(name)}`,
    reach,
    `NOTE:${esc("Text me your website for a fit check: 9 screens, Google and AI readability.")}`,
    "URL:https://aiworthusing.com/agent-index/sitemaxxing",
  ];
  if (photoJpeg?.length) lines.push(`PHOTO;ENCODING=b;TYPE=JPEG:${photoJpeg.toString("base64")}`);
  lines.push("END:VCARD");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** vCard lines longer than 75 characters continue on the next line after a space. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) parts.push(" " + line.slice(i, i + 74));
  return parts.join("\r\n");
}
