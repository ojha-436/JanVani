"""Resolves a stored Firebase Storage download URL into a Blob via the
Admin SDK — the only way in now that storage.rules denies direct public
read (see storage.rules). Used both to fetch raw bytes for AI analysis
(gemini_client's transcribe_audio / analyze_photo) and to mint short-lived
signed URLs for display (api/complaints.py), since Admin SDK access
authenticates as a privileged service account and bypasses Security Rules
entirely — the same mechanism that made the old public "download token"
URLs unnecessary."""

import re
from datetime import timedelta
from urllib.parse import unquote

from firebase_admin import storage as fb_storage

from app import firebase_admin as firebase_admin_module
from app.config import settings

_PATH_RE = re.compile(r"/o/([^?]+)")


def _get_blob(stored_url: str | None):
    if not stored_url:
        return None
    match = _PATH_RE.search(stored_url)
    if not match:
        return None

    blob_path = unquote(match.group(1))
    firebase_admin_module.ensure_initialized()
    bucket = fb_storage.bucket(settings.firebase_storage_bucket)
    return bucket.blob(blob_path)


def fetch_bytes(stored_url: str | None) -> tuple[bytes, str] | None:
    blob = _get_blob(stored_url)
    if blob is None:
        return None
    try:
        blob.reload()
        content_type = blob.content_type or "application/octet-stream"
        return blob.download_as_bytes(), content_type
    except Exception:
        return None


def signed_url(stored_url: str | None, expires_minutes: int = 60) -> str | None:
    if not stored_url:
        return None
    blob = _get_blob(stored_url)
    if blob is None:
        return stored_url  # not a recognizable Storage URL — pass through rather than break
    try:
        return blob.generate_signed_url(version="v4", expiration=timedelta(minutes=expires_minutes), method="GET")
    except Exception:
        return None
