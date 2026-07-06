/* ------------------------------------------------------------------
   Server-side Firebase Admin (Firestore + Cloud Storage).

   Uses Application Default Credentials — on Cloud Run these come from
   the attached service account (no key files in the container). Locally
   they come from `gcloud auth application-default login`.

   Guarded like the client init: if credentials/project are absent, the
   getters return null so every route degrades gracefully to demo mode
   instead of throwing at import time.
   ------------------------------------------------------------------ */

import { getApps, initializeApp, applicationDefault, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// GOOGLE_CLOUD_PROJECT is the single switch that turns the backend "live".
// Without it (or an explicit service account) we stay in demo mode and never
// touch a real project — so local runs can't accidentally write to prod.
const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;

const storageBucket =
  process.env.UPLOADS_BUCKET ||
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
  (projectId ? `${projectId}.firebasestorage.app` : undefined);

// Optional explicit service-account JSON (base64) for environments without
// ADC. On Cloud Run leave this unset and rely on the attached SA.
const saB64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;

let cached: { app: App; db: Firestore } | null = null;
let initTried = false;

function init(): { app: App; db: Firestore } | null {
  if (cached) return cached;
  if (initTried) return null; // don't retry a failed init on every request
  initTried = true;

  if (!projectId) return null;

  try {
    const app =
      getApps().length > 0
        ? getApps()[0]
        : initializeApp({
            credential: saB64
              ? cert(JSON.parse(Buffer.from(saB64, "base64").toString("utf8")))
              : applicationDefault(),
            projectId,
            storageBucket,
          });
    const db = getFirestore(app);
    // Ignore undefined props so partial submission records write cleanly.
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch {
      /* settings already applied */
    }
    cached = { app, db };
    return cached;
  } catch (err) {
    console.warn("[firebaseAdmin] init failed — running without server DB:", (err as Error).message);
    return null;
  }
}

/** True when a server-side Firestore/Storage connection is available. */
export function isAdminAvailable(): boolean {
  return init() !== null;
}

/** Firestore handle, or null in demo mode. */
export function getDb(): Firestore | null {
  return init()?.db ?? null;
}

/** Default Cloud Storage bucket handle, or null in demo mode. */
export function getBucket() {
  const app = init()?.app;
  if (!app || !storageBucket) return null;
  try {
    return getStorage(app).bucket(storageBucket);
  } catch {
    return null;
  }
}

export const ADMIN_PROJECT_ID = projectId;
export const ADMIN_BUCKET = storageBucket;
