"use client";

/* ------------------------------------------------------------------
   Session + Profile store.

   In this hackathon build there is no server session yet, so we keep a
   lightweight client store in localStorage — enough to demo the full
   flow (sign in → one-time onboarding → profile view/edit). In
   production the profile lives in Firestore keyed by the Firebase UID;
   this module is the single seam to swap for that.
   ------------------------------------------------------------------ */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Profile = {
  firstName: string;
  lastName: string;
  address: string;
  constituency: string;
  pincode: string;
  state: string;
  aadhaar?: string;
};

export type Session = {
  method: "phone" | "google" | "invite";
  role: "citizen" | "mp";
  phone?: string;
  email?: string;
  constituency?: string; // MP's allocated constituency (bound at activation/sign-in)
  at: string;
};

export const EMPTY_PROFILE: Profile = {
  firstName: "",
  lastName: "",
  address: "",
  constituency: "",
  pincode: "",
  state: "",
  aadhaar: "",
};

type SessionValue = {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  isOnboarded: boolean;
  signIn: (s: Session) => void;
  signOut: () => void;
  saveProfile: (p: Profile) => void;
};

const KEY_SESSION = "janvaani.session";
const KEY_PROFILE = "janvaani.profile";

const Ctx = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem(KEY_SESSION);
      const p = localStorage.getItem(KEY_PROFILE);
      if (s) setSession(JSON.parse(s) as Session);
      if (p) setProfile(JSON.parse(p) as Profile);
    } catch {
      /* corrupt storage — start fresh */
    }
    setReady(true);
  }, []);

  const signIn = useCallback((s: Session) => {
    setSession(s);
    localStorage.setItem(KEY_SESSION, JSON.stringify(s));
  }, []);

  // Sign out clears the session but keeps the (one-time) profile, so a
  // returning citizen isn't asked to onboard again.
  const signOut = useCallback(() => {
    setSession(null);
    localStorage.removeItem(KEY_SESSION);
  }, []);

  const saveProfile = useCallback((p: Profile) => {
    setProfile(p);
    localStorage.setItem(KEY_PROFILE, JSON.stringify(p));
  }, []);

  const isOnboarded = Boolean(profile && profile.firstName.trim() && profile.state.trim());

  return (
    <Ctx.Provider value={{ ready, session, profile, isOnboarded, signIn, signOut, saveProfile }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSession(): SessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be used within <SessionProvider>");
  return v;
}

/** Mask an Aadhaar number for display: keep only the last 4 digits. */
export function maskAadhaar(a?: string): string {
  const digits = (a ?? "").replace(/\D/g, "");
  if (digits.length < 4) return "";
  return `XXXX XXXX ${digits.slice(-4)}`;
}
