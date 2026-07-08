import uuid
from datetime import datetime

from pydantic import BaseModel


class AdminAuthFields(BaseModel):
    email: str
    password: str
    timestamp: str
    proof: str


class AddMPRequest(AdminAuthFields):
    mp_email: str | None = None
    mp_phone: str | None = None
    label: str | None = None
    constituency: str | None = None
    district: str | None = None


class AddMPResponse(BaseModel):
    added: bool


class ListMPRequest(AdminAuthFields):
    pass


class MPAllowlistEntryOut(BaseModel):
    id: uuid.UUID
    label: str | None
    constituency: str | None
    district: str | None
    has_email: bool
    has_phone: bool
    created_at: datetime


class DeleteMPRequest(AdminAuthFields):
    mp_email: str | None = None
    mp_phone: str | None = None


class DeleteMPResponse(BaseModel):
    deleted: int


class CreateMPAccountRequest(AdminAuthFields):
    mp_email: str
    mp_password: str
    label: str | None = None
    constituency: str | None = None
    district: str | None = None


class CreateMPAccountResponse(BaseModel):
    created: bool
    firebase_uid: str
