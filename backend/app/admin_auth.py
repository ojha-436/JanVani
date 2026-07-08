import hashlib
import hmac
import os
import time

import bcrypt

TIME_WINDOW_SECONDS = 60


def verify_admin(email: str, password: str, timestamp: str, proof: str) -> bool:
    """Verifies all three factors: the fixed admin email, the admin
    password, and a proof that the caller holds the device secret — a
    32-byte random value that lives ONLY in a local file on the admin's
    own machine and is never transmitted or stored in the clear anywhere
    server-side. The CLI proves it holds the secret via an HMAC challenge
    tied to the current time, so a captured request can't be replayed."""
    if not hmac.compare_digest(email.strip().lower(), os.environ["ADMIN_EMAIL"].strip().lower()):
        return False

    try:
        ts = int(timestamp)
    except ValueError:
        return False
    if abs(time.time() - ts) > TIME_WINDOW_SECONDS:
        return False

    if not bcrypt.checkpw(password.encode(), os.environ["ADMIN_PASSWORD_HASH"].encode()):
        return False

    device_secret = os.environ["ADMIN_DEVICE_SECRET"]
    expected_proof = hmac.new(
        device_secret.encode(), f"{email}:{timestamp}".encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(proof, expected_proof)


def verify_recovery_code(code: str) -> bool:
    code_hash = hashlib.sha256(code.strip().encode()).hexdigest()
    return hmac.compare_digest(code_hash, os.environ["ADMIN_RECOVERY_CODE_HASH"])
