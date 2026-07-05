/* ------------------------------------------------------------------
   Firebase client init. Safe to import anywhere: if env vars are not
   set (e.g. first local run before you create a project), it returns
   null instead of throwing, so the UI still renders for design work.
   ------------------------------------------------------------------ */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaV3Provider, getToken, type AppCheck } from "firebase/app-check";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let storage: FirebaseStorage | null = null;
let appCheck: AppCheck | null = null;

if (isFirebaseConfigured) {
  app = getApps().length ? getApps()[0] : initializeApp(config);
  auth = getAuth(app);
  storage = getStorage(app);

  // Only enabled once a reCAPTCHA v3 site key is set (Firebase console ->
  // App Check -> register this web app). Without it the app still works
  // exactly as before — App Check is enforced server-side only when the
  // backend's ENFORCE_APP_CHECK flag is on, so this is safe to leave off.
  const recaptchaKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (recaptchaKey) {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(recaptchaKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
}

// Returns headers to attach an App Check token to a fetch call, or an empty
// object when App Check isn't configured — callers never need to branch.
export async function appCheckHeaders(): Promise<Record<string, string>> {
  if (!appCheck) return {};
  try {
    const { token } = await getToken(appCheck, false);
    return { "X-Firebase-AppCheck": token };
  } catch {
    return {};
  }
}

export { app, auth, storage };
