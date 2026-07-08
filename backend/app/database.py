from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

_engine = None
_SessionLocal = None


def _create_engine():
    if settings.cloud_sql_connection_name:
        from google.cloud.sql.connector import Connector

        connector = Connector()

        def getconn():
            return connector.connect(
                settings.cloud_sql_connection_name,
                "pg8000",
                user=settings.cloud_sql_user,
                password=settings.cloud_sql_password,
                db=settings.cloud_sql_db,
            )

        return create_engine("postgresql+pg8000://", creator=getconn)
    return create_engine(settings.database_url)


def _get_session_factory():
    global _engine, _SessionLocal
    if _SessionLocal is None:
        _engine = _create_engine()
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    return _SessionLocal


class Base(DeclarativeBase):
    pass


def get_db():
    db = _get_session_factory()()
    try:
        yield db
    finally:
        db.close()
