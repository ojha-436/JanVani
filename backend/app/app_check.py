"""Firebase App Check — confirms a request came from our real web app, not
a script hitting the API directly. Enforcement is gated behind an env flag
rather than always-on, because it requires a registered reCAPTCHA site key
(Firebase console -> App Check) that isn't set up in every environment; the
dependency is safe to attach to any route regardless."""

import os

from fastapi import HTTPException, Request
from firebase_admin import app_check

from app import firebase_admin as firebase_admin_module

ENFORCE_APP_CHECK = os.environ.get("ENFORCE_APP_CHECK", "false").lower() == "true"


def verify_app_check(request: Request) -> None:
    if not ENFORCE_APP_CHECK:
        return

    token = request.headers.get("X-Firebase-AppCheck")
    if not token:
        raise HTTPException(status_code=401, detail="Missing App Check token")

    firebase_admin_module.ensure_initialized()
    try:
        app_check.verify_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid App Check token")
