---
name: verify
description: Build, launch and drive JanVaani (Next.js + FastAPI) to verify changes end-to-end on this Windows machine.
---

# Verifying JanVaani

## Launch

- Frontend (prod build): `npm run build && npx next start -p 3200`
- Backend: `cd backend && ./venv/Scripts/python.exe -m uvicorn app.main:app --port 8010`
  (boots without DB; DB-touching endpoints fail at request time — auth
  guards still observable as 401s without a token)
- Free a stuck port: `powershell -Command "Get-NetTCPConnection -LocalPort 3200 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"`

## Drive (browser)

Playwright is a devDependency; use the installed Chrome — **no browser
download needed**: `chromium.launch({ channel: "chrome", headless: true })`.
A full 22-check suite pattern (theme, i18n, guide tabs, auth gates, 404
probe) lives in the session scratchpad as `verify.mjs` — copy the pattern.

Gotchas that produced false FAILs:
- **Never `waitUntil: "networkidle"` against the live site** — Firebase
  long-poll connections keep the network busy forever. Use
  `domcontentloaded` + explicit `waitForTimeout(3000)` for hydration.
- Clicks before React hydration are silent no-ops (theme toggle "did
  nothing" on live). Wait ~3s after load before interacting.
- Dark mode must be asserted via **computed colors**, not just
  `html[data-theme]` — the attribute can be set while the CSS was
  stripped at build time (LightningCSStoken-stripping incident; tokens
  are light-dark() pairs in globals.css for this reason).

## Auth-gated flows

No test credentials exist. Signed-in citizen/MP flows (submit chips,
my-complaints, dashboard data) can only be verified as redirect-to-sign-in
gates. Verify data flows against prod endpoints with real tokens only.

## Production

- Live smoke: new API routes on
  `https://asia-south1-vipasana-499205.cloudfunctions.net/api/<route>` —
  401 = route exists + guard holds; 404 = old code; timeout = check
  Cloud Run logs for OOM (memory is pinned to 512Mi in backend/main.py
  after the 256Mi crash-loop incident).
- Prod DB migrations (no firewall changes!):
  `cloud-sql-proxy --token "$(gcloud auth print-access-token)" --port 5433
  vipasana-499205:asia-south1:vipasana-499205-instance` then alembic with
  DATABASE_URL host swapped to `127.0.0.1:5433`.
