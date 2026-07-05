import uuid

from sqlalchemy import DateTime, LargeBinary, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.crypto import decrypt_field, encrypt_field, hash_for_search
from app.database import Base


def _encrypted_property(field: str, hash_field: str | None = None):
    """Builds a plaintext-in, encrypted-at-rest property backed by
    `<field>_encrypted` (and optionally `<field>_hash` for equality search)."""

    def getter(self) -> str | None:
        encrypted = getattr(self, f"{field}_encrypted")
        return decrypt_field(encrypted) if encrypted else None

    def setter(self, value: str | None) -> None:
        if value:
            setattr(self, f"{field}_encrypted", encrypt_field(value))
            if hash_field:
                setattr(self, hash_field, hash_for_search(value))
        else:
            setattr(self, f"{field}_encrypted", None)
            if hash_field:
                setattr(self, hash_field, None)

    return property(getter, setter)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firebase_uid: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    provider: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Every PII field below is stored ONLY in encrypted form (Fernet, key in
    # Secret Manager). `*_hash` columns hold a one-way SHA-256 fingerprint
    # used purely for equality lookups (e.g. "does this email already exist")
    # — they cannot be reversed back to the original value.
    email_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    email_hash: Mapped[str | None] = mapped_column(String, nullable=True, index=True)

    phone_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    phone_hash: Mapped[str | None] = mapped_column(String, nullable=True, index=True)

    display_name_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    first_name_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    last_name_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    address_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    constituency_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    pincode_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    state_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)

    # Aadhaar: only the last 4 digits are ever stored, in the clear — the
    # full number is never persisted anywhere.
    aadhaar_last4: Mapped[str | None] = mapped_column(String(4), nullable=True)

    email = _encrypted_property("email", "email_hash")
    phone_number = _encrypted_property("phone", "phone_hash")
    display_name = _encrypted_property("display_name")
    first_name = _encrypted_property("first_name")
    last_name = _encrypted_property("last_name")
    address = _encrypted_property("address")
    constituency = _encrypted_property("constituency")
    pincode = _encrypted_property("pincode")
    state = _encrypted_property("state")
