from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://janvaani:janvaani@localhost:5432/janvaani"
    cors_origins: str = "http://localhost:3000,https://janvaani-1044819117404.asia-south1.run.app"
    gcp_credentials_path: str = "serviceAccountKey.json"

    # When set, database.py connects via the Cloud SQL Python Connector
    # instead of database_url (used in deployed Firebase Functions).
    cloud_sql_connection_name: str = ""
    cloud_sql_user: str = "janvaani"
    cloud_sql_password: str = ""
    cloud_sql_db: str = "janvaani"

    # Firebase Storage bucket holding citizen complaint media — used to mint
    # short-lived signed URLs server-side (see app/media.py) now that
    # storage.rules denies direct public read.
    firebase_storage_bucket: str = "vipasana-499205.firebasestorage.app"

    class Config:
        env_file = ".env"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
