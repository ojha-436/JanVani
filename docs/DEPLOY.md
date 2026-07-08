# JanVaani — Deployment & CI/CD

This app deploys to **Cloud Run** from source (Cloud Build reads the
`Dockerfile`). Two GitHub Actions workflows drive it:

- **`.github/workflows/ci.yml`** — lint + type-check + build on every PR and
  push to `main`. Keeps `main` always deployable.
- **`.github/workflows/deploy.yml`** — builds and deploys to Cloud Run on push
  to `main` (or manual `workflow_dispatch`). Auth is via **Workload Identity
  Federation** — no service-account JSON key in the repo.

---

## 0. Prerequisites (once)

```bash
export PROJECT_ID=vipasana-499205
export REGION=asia-south1
export REPO=ojha-436/JanVani                 # owner/repo on GitHub
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

gcloud config set project $PROJECT_ID
gcloud services enable \
  run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  aiplatform.googleapis.com speech.googleapis.com firestore.googleapis.com \
  storage.googleapis.com iamcredentials.googleapis.com
```

Create the uploads bucket (private) and a Firestore database if you haven't:

```bash
gsutil mb -l $REGION gs://janvaani-uploads || true
gcloud firestore databases create --location=$REGION || true   # Native mode
```

---

## 1. Runtime permissions (what the running app can do)

Cloud Run uses the project's **compute service account** by default:
`$PROJECT_NUMBER-compute@developer.gserviceaccount.com`. Grant it least
privilege for the services the backend calls:

```bash
RUNTIME=$PROJECT_NUMBER-compute@developer.gserviceaccount.com
for role in roles/aiplatform.user roles/datastore.user roles/storage.objectAdmin; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$RUNTIME" --role="$role"
done
```

- `aiplatform.user` → Vertex AI Gemini (extraction, photo, rationale)
- `datastore.user` → Firestore reads/writes
- `storage.objectAdmin` → voice/photo uploads
- **Speech-to-Text**: the default compute SA can usually call it already. If you
  see `403`, grant `roles/serviceusage.serviceUsageConsumer` and confirm
  `speech.googleapis.com` is enabled.

> With no credentials configured the backend degrades to **demo mode** (accepts
> submissions, keeps the citizen's own words, dashboard shows sample data) —
> it never crashes.

---

## 2. Deployer identity + Workload Identity Federation (for GitHub Actions)

```bash
# Deployer service account GitHub Actions impersonates
gcloud iam service-accounts create gh-deployer --display-name "GitHub Actions Deployer"
export DEPLOYER=gh-deployer@$PROJECT_ID.iam.gserviceaccount.com

for role in roles/run.admin roles/cloudbuild.builds.editor \
            roles/artifactregistry.admin roles/storage.admin \
            roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$DEPLOYER" --role="$role"
done

# Workload Identity pool + OIDC provider locked to this repo
gcloud iam workload-identity-pools create github --location=global --display-name="GitHub"
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global --workload-identity-pool=github \
  --display-name="GitHub provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='$REPO'" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Let the repo impersonate the deployer SA
gcloud iam service-accounts add-iam-policy-binding $DEPLOYER \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/$REPO"

# The WIF_PROVIDER secret value:
echo "projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/github-provider"
```

---

## 3. GitHub repository secrets & variables

**Secrets** (Settings → Secrets and variables → Actions → *Secrets*):

| Secret | Value |
|---|---|
| `WIF_PROVIDER` | the `projects/.../providers/github-provider` string from step 2 |
| `WIF_SERVICE_ACCOUNT` | `gh-deployer@vipasana-499205.iam.gserviceaccount.com` |
| `GCP_PROJECT` | `vipasana-499205` |
| `SUBMISSION_SALT` | any long random string (salts the citizen key) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | from Firebase console → web app config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | " |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | " |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | " |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | " |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | " |

**Variables** (*Variables* tab — non-secret, optional; defaults shown):

| Variable | Default |
|---|---|
| `GCP_REGION` | `asia-south1` |
| `VERTEX_LOCATION` | `us-central1` |
| `VERTEX_GEMINI_MODEL` | `gemini-2.5-flash` (must be accessible in your project/region) |
| `UPLOADS_BUCKET` | `janvaani-uploads` |

> The `NEXT_PUBLIC_*` keys are Firebase **web** keys — public by design and safe
> in the client bundle; access is enforced by Firestore/Storage rules. They are
> stored as secrets only to keep them out of the committed source.

---

## 4. Deploy

Push to `main` (or run the **Deploy to Cloud Run** workflow manually). To deploy
by hand from your machine instead:

```bash
gcloud run deploy janvaani --source . --region $REGION --allow-unauthenticated \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_CLOUD_LOCATION=us-central1,VERTEX_GEMINI_MODEL=gemini-2.5-flash,UPLOADS_BUCKET=janvaani-uploads,SUBMISSION_SALT=<random>"
```

Deploy the security rules (from step 1 of the app) with the Firebase CLI:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage --project $PROJECT_ID
```

---

## 5. Recompute the ranking (batch job)

The dashboard reads `rankings/latest`. Recompute it after new submissions:

```bash
curl -X POST https://<your-cloud-run-url>/api/recompute
```

In production this is a **Cloud Scheduler** job hitting the same endpoint
nightly / on a submission-count threshold (ARCHITECTURE.md §10):

```bash
gcloud scheduler jobs create http janvaani-recompute \
  --location=$REGION --schedule="0 */6 * * *" \
  --uri="https://<your-cloud-run-url>/api/recompute" --http-method=POST
```

---

## 6. Google Maps API key (optional — real map tiles)

The demand map works with no key (built-in SVG map). To render **real Google
Maps tiles**, add a free-tier browser key. Google Maps Platform includes a
recurring **US$200/month free credit** — the JavaScript Maps load ("dynamic
map") is ~US$7 per 1,000 loads, so a demo/pilot stays comfortably free.

**Create the key**
1. Go to **console.cloud.google.com** → project `vipasana-499205` → **APIs &
   Services → Library** → enable **"Maps JavaScript API"**.
2. **APIs & Services → Credentials → + Create credentials → API key.**
3. Copy the key. Click **Edit** on it and set:
   - **Application restrictions → Websites (HTTP referrers)** and add:
     - `https://janvaani-1044819117404.asia-south1.run.app/*`
     - `http://localhost:3000/*` (for local dev)
   - **API restrictions → Restrict key →** select **Maps JavaScript API** only.
4. (Recommended) In **Google Maps Platform → Billing**, set a budget alert.

> The key is a **browser key** and ships in the client bundle by design — that's
> why the HTTP-referrer restriction above is the real protection. Never use an
> unrestricted key.

**Activate it (build-time — a redeploy is required)**

`NEXT_PUBLIC_*` values are baked in at build time, so a runtime env update is not
enough — you must rebuild. Locally:

```bash
echo "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_KEY" >> .env.production
gcloud run deploy janvaani --source . --project vipasana-499205 \
  --region asia-south1 --allow-unauthenticated
```

Via CI/CD: add a repo secret **`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`** and push to
`main` — `deploy.yml` writes it into the build. When the key is present the
dashboard renders Google Maps; if it ever fails to load, it automatically falls
back to the SVG map.

---

## Pipeline summary

```
PR ──▶ ci.yml (lint · typecheck · build)
main ─▶ ci.yml  +  deploy.yml (WIF auth ─▶ Cloud Build ─▶ Cloud Run)
Cloud Scheduler ─▶ POST /api/recompute ─▶ rankings/latest ─▶ MP dashboard
```
