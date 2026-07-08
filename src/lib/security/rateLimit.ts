/* ------------------------------------------------------------------
   Lightweight in-memory rate limiter (fixed window).

   Defence-in-depth against abuse / runaway cost on the write and
   AI-backed endpoints (submissions, recompute, estimate, assistant).
   It is per-instance and best-effort — Cloud Run may run several
   instances — so it caps a single hot client, not a distributed flood.
   The multi-instance upgrade is a shared store (Firestore / Memorystore);
   this module is the seam. `now` is injectable for deterministic tests.
   ------------------------------------------------------------------ */

type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

export type RateResult = { ok: boolean; remaining: number; resetInMs: number };

/** Record a hit for `key` and report whether it's within `limit` per
 *  `windowMs`. The first hit in a window opens it; it resets after. */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): RateResult {
  const b = store.get(key);
  if (!b || now >= b.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: Math.max(0, limit - 1), resetInMs: windowMs };
  }
  b.count += 1;
  return {
    ok: b.count <= limit,
    remaining: Math.max(0, limit - b.count),
    resetInMs: b.resetAt - now,
  };
}

/** Best-effort client identity from proxy headers, namespaced by `scope`. */
export function clientKey(req: Request, scope: string): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const ip = xff.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  return `${scope}:${ip}`;
}

/** Test-only helper to reset the shared window store. */
export function __resetRateLimits(): void {
  store.clear();
}
