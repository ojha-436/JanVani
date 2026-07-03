import os

import firebase_admin
from firebase_admin import credentials

from app.config import settings


def ensure_initialized() -> None:
    if firebase_admin._apps:
        return
    if os.path.exists(settings.gcp_credentials_path):
        firebase_admin.initialize_app(credentials.Certificate(settings.gcp_credentials_path))
    else:
        firebase_admin.initialize_app()
