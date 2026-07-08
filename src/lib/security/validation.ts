/* ------------------------------------------------------------------
   Input validation & sanitisation for the API routes.

   Server-side defence: the browser is untrusted, so every free-text
   field is coerced, stripped of control characters and length-capped,
   and every upload is size-limited before it touches Storage / Gemini.
   Keeps stored data clean and bounds cost / abuse.
   ------------------------------------------------------------------ */

export const MAX_TEXT_LEN = 4000; // a citizen need / message
export const MAX_NOTE_LEN = 500; // a status note
export const MAX_NAME_LEN = 120; // a person / MP name
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB per voice note / photo

// Code points we keep among the C0 range: tab(9), newline(10),
// carriage-return(13). Everything below 32 (except those) and DEL(127)
// is a control character and is dropped.
function isPrintable(cp: number): boolean {
  if (cp === 9 || cp === 10 || cp === 13) return true;
  if (cp === 127) return false;
  return cp >= 32;
}

/** Coerce to string, strip control chars, trim, and cap length. */
export function sanitizeText(input: unknown, maxLen: number = MAX_TEXT_LEN): string {
  const raw = input == null ? "" : String(input);
  let out = "";
  for (const ch of raw) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined && isPrintable(cp)) out += ch;
  }
  out = out.trim();
  return out.length > maxLen ? out.slice(0, maxLen) : out;
}

/** A single-line field (no line breaks) - for names, areas, locations. */
export function sanitizeLine(input: unknown, maxLen: number = MAX_NAME_LEN): string {
  const oneLine = String(input ?? "").replace(/[\r\n\t]+/g, " ");
  return sanitizeText(oneLine, maxLen).replace(/\s{2,}/g, " ");
}

/** True when a file size is a finite, non-negative number within the cap. */
export function withinUploadLimit(bytes: number, max: number = MAX_UPLOAD_BYTES): boolean {
  return Number.isFinite(bytes) && bytes >= 0 && bytes <= max;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** RFC-pragmatic email check + length bound. */
export function isValidEmail(email: string): boolean {
  return typeof email === "string" && email.length <= 254 && EMAIL_RE.test(email);
}
