"use client";

/* ------------------------------------------------------------------
   Session + Profile. Wraps Firebase Auth's own state (onAuthStateChanged)
   and keeps it in sync with our backend's Postgres-backed profile
   (GET/PUT /users/me) — this is the single source of truth for "am I
   signed in" and "what does JanVaani know about me" across the app.
   ------------------------------------------------------------------ */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, type User as FirebaseUser } from "firebase/auth";
import { auth, isFirebaseConfigured } from "./firebase";
import {
  syncUser,
  getMyProfile,
  updateMyProfile,
  type ProfileOut,
  type ProfileUpdateInput,
} from "@/services/api";

export type Role = "citizen" | "mp";

type SessionValue = {
  ready: boolean;
  firebaseUser: FirebaseUser | null;
  profile: ProfileOut | null;
  isOnboarded: boolean;
  isMp: boolean;
  role: Role;
  setRole: (r: Role) => void;
  refreshProfile: () => Promise<void>;
  saveProfile: (data: ProfileUpdateInput) => Promise<void>;
  signOut: () => Promise<void>;
};

const ROLE_KEY = "janvaani.role";

const Ctx = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<ProfileOut | null>(null);
  const [isMp, setIsMp] = useState(false);
  const [role, setRoleState] = useState<Role>("citizen");

  useEffect(() => {
    const saved = localStorage.getItem(ROLE_KEY);
    if (saved === "mp" || saved === "citizen") setRoleState(saved);
  }, []);

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    localStorage.setItem(ROLE_KEY, r);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!auth?.currentUser) {
      setProfile(null);
      return;
    }
    try {
      const idToken = await auth.currentUser.getIdToken();
      setProfile(await getMyProfile(idToken));
    } catch (e) {
      console.error("Failed to load profile", e);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setReady(true);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setFirebaseUser(u);
      if (u) {
        try {
          const idToken = await u.getIdToken();
          await syncUser(idToken);
          // syncUser may have just granted/revoked the "mp" custom claim —
          // force a token refresh so we read the current value, not a cached one.
          const tokenResult = await u.getIdTokenResult(true);
          setIsMp(tokenResult.claims.role === "mp");
          await refreshProfile();
        } catch (e) {
          console.error("Failed to sync session with backend", e);
        }
      } else {
        setProfile(null);
        setIsMp(false);
      }
      setReady(true);
    });
    return unsubscribe;
  }, [refreshProfile]);

  const saveProfile = useCallback(async (data: ProfileUpdateInput) => {
    if (!auth?.currentUser) throw new Error("Not signed in");
    const idToken = await auth.currentUser.getIdToken();
    setProfile(await updateMyProfile(idToken, data));
  }, []);

  const signOut = useCallback(async () => {
    if (auth) await firebaseSignOut(auth);
    setProfile(null);
  }, []);

  const isOnboarded = Boolean(profile?.is_onboarded);

  return (
    <Ctx.Provider
      value={{ ready, firebaseUser, profile, isOnboarded, isMp, role, setRole, refreshProfile, saveProfile, signOut }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession must be used within <SessionProvider>");
  return ctx;
}
