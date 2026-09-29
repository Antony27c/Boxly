from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración de la API. Valores sensibles vía variables de entorno / .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Boxly API"
    app_version: str = "0.1.0"
    debug: bool = False

    # Local: SQLite para probar auth sin DB. Pablo cambia a PostgreSQL (BE-02).
    # Ejemplo PG: postgresql+psycopg2://boxly:boxly@localhost:5432/boxly
    database_url: str = "sqlite:///./boxly.db"

    jwt_secret_key: str = "cambiar-en-produccion-boxly-sprint1"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
