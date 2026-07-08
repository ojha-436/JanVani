"""Shared fixtures. Tests run with NO database and NO Google Cloud access:
the app imports lazily enough that TestClient + dependency overrides cover
endpoint validation, and the rule modules are pure functions.
"""

import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.database import get_db
from app.deps import get_current_mp, get_current_user
from app.main import app


@pytest.fixture
def fake_citizen():
    return SimpleNamespace(id=uuid.uuid4(), constituency="Test Constituency")


@pytest.fixture
def fake_mp():
    return SimpleNamespace(constituency="Test Constituency", district="Test District")


@pytest.fixture
def client(fake_citizen, fake_mp):
    """TestClient with auth dependencies stubbed and a MagicMock database.
    Tests that only exercise validation paths never touch the mock; a test
    that would reach the DB should configure `client.db_mock` explicitly."""
    db = MagicMock()
    app.dependency_overrides[get_current_user] = lambda: fake_citizen
    app.dependency_overrides[get_current_mp] = lambda: fake_mp
    app.dependency_overrides[get_db] = lambda: db
    test_client = TestClient(app, raise_server_exceptions=True)
    test_client.db_mock = db
    yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def anon_client():
    """No overrides — exercises the real auth guards (still no DB)."""
    return TestClient(app, raise_server_exceptions=False)
