import hashlib
import os
from functools import lru_cache

from cryptography.fernet import Fernet


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    key = os.environ["FIELD_ENCRYPTION_KEY"]
    return Fernet(key.encode())


def encrypt_field(plain: str) -> bytes:
    return _fernet().encrypt(plain.encode())


def decrypt_field(encrypted: bytes) -> str:
    return _fernet().decrypt(encrypted).decode()


def hash_for_search(value: str) -> str:
    """Deterministic, non-reversible fingerprint used only for equality lookups
    (e.g. finding a user by email/phone) — never used to recover the original value."""
    return hashlib.sha256(value.strip().lower().encode()).hexdigest()
