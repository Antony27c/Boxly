import logging
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL

logger = logging.getLogger(__name__)

UPLOADS_DIR = Path(__file__).resolve().parents[2] / "uploads"

# Valores de ejemplo que nunca deben usarse como JWT_SECRET_KEY en producción.
JWT_SECRET_PLACEHOLDERS = {
    "cambiar-en-produccion-boxly-sprint1",
    "cambiar-por-un-secreto-largo-y-aleatorio",
}
JWT_SECRET_MIN_LEN = 32
# Secreto de desarrollo: permite levantar la API en local sin configurar nada,
# pero es público y no sirve para producción.
DEV_JWT_SECRET = "boxly-dev-secret-inseguro-no-usar-en-prod"


class Settings(BaseSettings):
    """Configuración de la API. Valores sensibles vía variables de entorno / .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Boxly API"
    app_version: str = "0.1.0"
    environment: Literal["dev", "prod"] = "dev"
    debug: bool = False

    # Si DATABASE_URL está definida, tiene prioridad. Si no, se arma con POSTGRES_*.
    database_url_override: str | None = Field(default=None, validation_alias="DATABASE_URL")
    postgres_user: str = "postgres"
    postgres_password: str = ""
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "boxly"

    @property
    def database_url(self) -> str:
        if self.database_url_override:
            return self.database_url_override
        return URL.create(
            "postgresql+psycopg2",
            username=self.postgres_user,
            password=self.postgres_password or None,
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
        ).render_as_string(hide_password=False)

    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    mp_access_token: str | None = None
    mp_webhook_secret: str | None = None
    # Cuenta de Mercado Pago DE BOXLY (distinta de la de los talleres): cobra las
    # suscripciones mensuales de los talleres (docs/Suscripciones.md, tarea S2).
    boxly_mp_access_token: str | None = None
    boxly_mp_webhook_secret: str | None = None
    frontend_url: str = "http://localhost:5173"
    backend_public_url: str | None = None

    # Email (Gmail SMTP)
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_name: str = "Boxly Taller Mecánico"
    smtp_from_email: str = ""
    smtp_tls: bool = True

    # SOLO DEMO: la contraseña inicial de cada cliente es su DNI/CUIT y no hace falta el correo
    # de verificación. Es insegura (el DNI no es secreto): apagarla antes de uso real.
    cliente_password_dni: bool = False

    @property
    def es_produccion(self) -> bool:
        return self.environment == "prod"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @model_validator(mode="after")
    def _validar_secretos(self) -> "Settings":
        if self.es_produccion:
            if self.debug:
                raise ValueError(
                    "Configuración inválida para producción: DEBUG debe ser false "
                    "(DEBUG=false)."
                )
            secret = (self.jwt_secret_key or "").strip()
            if not secret:
                raise ValueError(
                    "JWT_SECRET_KEY es obligatorio en producción. Generá uno con: "
                    'python -c "import secrets; print(secrets.token_urlsafe(48))"'
                )
            if len(secret) < JWT_SECRET_MIN_LEN:
                raise ValueError(
                    f"JWT_SECRET_KEY debe tener al menos {JWT_SECRET_MIN_LEN} "
                    "caracteres en producción."
                )
            if secret in JWT_SECRET_PLACEHOLDERS:
                raise ValueError(
                    "JWT_SECRET_KEY sigue siendo un placeholder de ejemplo; "
                    "generá un secreto real en producción."
                )
            # Estas URLs viajan a Mercado Pago (back_urls, notification_url) y
            # el pagador vuelve por ellas: en producción, solo por TLS.
            for nombre, valor in (
                ("FRONTEND_URL", self.frontend_url),
                ("BACKEND_PUBLIC_URL", self.backend_public_url),
            ):
                if valor and not valor.startswith("https://"):
                    raise ValueError(
                        f"Configuración inválida para producción: {nombre} tiene "
                        "que usar https://."
                    )
        elif not (self.jwt_secret_key or "").strip():
            # Sin JWT_SECRET_KEY en desarrollo se usa un secreto inseguro solo
            # para poder levantar la API en local.
            self.jwt_secret_key = DEV_JWT_SECRET
            logger.warning(
                "JWT_SECRET_KEY no está definida: se usa un secreto de DESARROLLO "
                "inseguro. Definila antes de producción."
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
