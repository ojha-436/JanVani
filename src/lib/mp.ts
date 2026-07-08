/* ------------------------------------------------------------------
   MP account allocation — shared types.

   An `mpAccounts` record is the source of truth binding one MP (by email)
   to exactly one constituency. Accounts are provisioned by an admin, who
   sends a one-time invite link; the MP never chooses their own
   constituency. This is the data model real Firebase Auth custom claims
   will later enforce cryptographically (see ARCHITECTURE §17).
   ------------------------------------------------------------------ */

export type MpStatus = "invited" | "active" | "revoked";

export type MpAllocation = {
  inviteToken: string;
  email: string;
  name: string;
  constituency: string;
  status: MpStatus;
  createdAt: string;
  activatedAt?: string | null;
  revokedAt?: string | null;
};

/** Path to the one-time activation link for an invite token. */
export function inviteLink(token: string): string {
  return `/mp-activate?token=${encodeURIComponent(token)}`;
}
