import os
import traceback

from firebase_functions import https_fn
from firebase_functions.options import SecretParam, set_global_options
from flask import Response

db_password = SecretParam("DB_PASSWORD")

set_global_options(max_instances=10, region="asia-south1")

os.environ.setdefault("CLOUD_SQL_CONNECTION_NAME", "vipasana-499205:asia-south1:vipasana-499205-instance")

_wsgi_app = None


def _get_wsgi_app():
    global _wsgi_app
    if _wsgi_app is None:
        os.environ["CLOUD_SQL_PASSWORD"] = db_password.value

        from a2wsgi import ASGIMiddleware

        from app.main import app

        _wsgi_app = ASGIMiddleware(app)
    return _wsgi_app


@https_fn.on_request(secrets=["DB_PASSWORD"])
def api(req: https_fn.Request) -> https_fn.Response:
    try:
        return Response.from_app(_get_wsgi_app(), req.environ)
    except Exception:
        print(traceback.format_exc(), flush=True)
        raise
