import os
import traceback

from firebase_functions import https_fn
from firebase_functions.options import SecretParam, set_global_options
from flask import Response

db_password = SecretParam("DB_PASSWORD")
field_key = SecretParam("FIELD_ENCRYPTION_KEY")
admin_email = SecretParam("ADMIN_EMAIL")
admin_password_hash = SecretParam("ADMIN_PASSWORD_HASH")
admin_device_secret = SecretParam("ADMIN_DEVICE_SECRET")
admin_recovery_code_hash = SecretParam("ADMIN_RECOVERY_CODE_HASH")
gov_data_api_key = SecretParam("GOV_DATA_API_KEY")

set_global_options(max_instances=10, region="asia-south1")

os.environ.setdefault("CLOUD_SQL_CONNECTION_NAME", "vipasana-499205:asia-south1:vipasana-499205-instance")

_wsgi_app = None

_ADMIN_SECRETS = [
    "DB_PASSWORD",
    "FIELD_ENCRYPTION_KEY",
    "ADMIN_EMAIL",
    "ADMIN_PASSWORD_HASH",
    "ADMIN_DEVICE_SECRET",
    "ADMIN_RECOVERY_CODE_HASH",
    "GOV_DATA_API_KEY",
]


def _get_wsgi_app():
    global _wsgi_app
    if _wsgi_app is None:
        os.environ["CLOUD_SQL_PASSWORD"] = db_password.value
        os.environ["FIELD_ENCRYPTION_KEY"] = field_key.value
        os.environ["ADMIN_EMAIL"] = admin_email.value
        os.environ["ADMIN_PASSWORD_HASH"] = admin_password_hash.value
        os.environ["ADMIN_DEVICE_SECRET"] = admin_device_secret.value
        os.environ["ADMIN_RECOVERY_CODE_HASH"] = admin_recovery_code_hash.value
        os.environ["GOV_DATA_API_KEY"] = gov_data_api_key.value

        from a2wsgi import ASGIMiddleware

        from app.main import app

        _wsgi_app = ASGIMiddleware(app)
    return _wsgi_app


# memory: the default 256Mi OOM-crash-looped in production on 2026-07-08
# (FastAPI + firebase_admin + SQLAlchemy sit at ~260-270Mi at startup).
# Keep this in code so a redeploy never silently resets the limit.
@https_fn.on_request(secrets=_ADMIN_SECRETS, memory=512)
def api(req: https_fn.Request) -> https_fn.Response:
    try:
        return Response.from_app(_get_wsgi_app(), req.environ)
    except Exception:
        print(traceback.format_exc(), flush=True)
        raise
