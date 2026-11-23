from pydantic import BaseModel


class PasswordTemporalResponse(BaseModel):
    """La contraseña temporal se muestra una sola vez: hay que guardarla."""

    password_temporal: str


class SesionesResponse(BaseModel):
    detail: str
