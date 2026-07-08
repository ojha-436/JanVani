/* ------------------------------------------------------------------
   Admin authentication for the MP-provisioning API.

   Hardening over the previous inline check:
     • No hardcoded fallback key. The key comes ONLY from the
       MP_ADMIN_KEY env var and must be reasonably long, so an
       unconfigured deployment FAILS CLOSED (admin routes reject
       everything) instead of shipping a guessable default.
     • Constant-time comparison (hash → timingSafeEqual) so the key
       can't be recovered by timing the response.
     • Header-first transport (`x-admin-key`) so the secret stays out
       of URLs, browser history and access logs. A body field / query
       param is accepted as a legacy fallback.

   This is still a single shared admin secret — a pragmatic gate for the
   pilot. Production replaces it with a super-admin role on a verified
   Firebase Auth identity (custom claims). See docs/ARCHITECTURE.md.
   ------------------------------------------------------------------ */

import { createHash, timingSafeEqual } from "crypto";

/** Reject trivially weak / empty keys — an admin secret must be deliberate. */
export const MIN_ADMIN_KEY_LEN = 12;

/** The configured admin key, or null when unset/too weak (→ fail closed). */
export function getAdminKey(): string | null {
  const k = process.env.MP_ADMIN_KEY?.trim();
  return k && k.length >= MIN_ADMIN_KEY_LEN ? k : null;
}

/** Whether admin features are usable at all (a valid key is configured). */
export function adminConfigured(): boolean {
  return getAdminKey() !== null;
}

/** Constant-time compare. Hash to a fixed 32-byte digest first so buffer
 *  lengths always match and the input length never leaks. */
export function constantTimeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb);
}

/** Pull the presented admin key: `x-admin-key` header → body value → legacy
 *  `?adminKey=` query param. */
export function extractAdminKey(req: Request, bodyValue?: string | null): string | null {
  const header = req.headers.get("x-admin-key");
  if (header) return header;
  if (bodyValue) return bodyValue;
  try {
    const q = new URL(req.url).searchParams.get("adminKey");
    if (q) return q;
  } catch {
    /* non-absolute URL in tests — ignore */
  }
  return null;
}

/** True only when a key is configured AND the presented key matches it. */
export function isAdmin(provided: string | null | undefined): boolean {
  const expected = getAdminKey();
  if (!expected || !provided) return false; // fail closed
  return constantTimeEqual(provided, expected);
}

/** Extract + verify in one call for a request handler. */
export function requireAdmin(req: Request, bodyValue?: string | null): boolean {
  return isAdmin(extractAdminKey(req, bodyValue));
}
