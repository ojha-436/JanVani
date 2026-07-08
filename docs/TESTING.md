# Testing JanVaani

Both suites are designed to run on any machine — **no Postgres, no Google
Cloud credentials, no Maps key** — so they can gate every commit, including
on machines that can't reach the production Cloud SQL instance.

## Frontend (`npm test`)

Vitest + Testing Library + jsdom (`vitest.config.ts`, `vitest.setup.ts`).

- `src/lib/i18n.test.tsx` — **translation contract**: the Hindi dictionary
  must cover exactly the same keys as English (a missing key fails CI, not a
  user's screen); `useLocalStrings` per-key fallback behavior.
- `src/components/ui/ui.test.tsx` — StatusBadge label mapping (en + hi),
  EvidenceMeter accessibility (role=meter, clamped values, renders nothing
  without a backend score), StatusTimeline ordering/empty behavior.

`npm run test:watch` for watch mode.

## Backend (`venv\Scripts\python.exe -m pytest tests -q`)

Install dev deps once: `venv\Scripts\python.exe -m pip install -r requirements-dev.txt`

- `tests/test_classify.py` — the category-suggestion rulebook: bilingual
  matching, whole-word Latin matching (with naive plurals), determinism,
  alphabetical tie-breaks, never emits an unknown category.
- `tests/test_civic.py` — civic points/badges: the tests literally encode
  the published thresholds (10/100/300/750) and boundary behavior.
- `tests/test_evidence_helpers.py` — the gov-data corroboration bonus:
  fixed +15, and **zero** when no citizen complaints corroborate, however
  large the dataset (the core-rule guarantee).
- `tests/test_api_validation.py` — endpoint contracts via FastAPI
  `TestClient` with dependency overrides (fake auth, MagicMock DB):
  suggest-category responses, status/department validation, compare/alerts/
  nearby query validation, auth guards, and the `/complaints/mine` vs
  `/complaints/{uuid}` route-ordering regression test.

### What deliberately isn't tested here

Anything needing a real database (SQLAlchemy queries against Postgres) or
live Gemini/Maps. Those paths are exercised against the deployed stack;
keeping them out of the default suite is what lets it run anywhere. If a
local Postgres becomes available (Docker), an integration suite can point
`DATABASE_URL` at it and reuse the same app factory.
