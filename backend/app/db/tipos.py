"""Tipos de columna SQLAlchemy propios del proyecto."""
from datetime import datetime, timezone

from sqlalchemy import DateTime
from sqlalchemy.types import TypeDecorator


class FechaHoraUTC(TypeDecorator):
    """DateTime que siempre devuelve un ``datetime`` con ``tzinfo=UTC``.

    SQLite no guarda la zona horaria: la columna sigue siendo DATETIME y se
    almacena la hora UTC en formato naive (igual que antes, no hace falta
    migración). En Postgres la columna es ``timestamptz`` y guarda el instante.

    - Al guardar: un datetime con zona se pasa a UTC; uno naive se asume UTC.
    - Al leer: un naive se asume UTC; uno con zona se pasa a UTC.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None or not isinstance(value, datetime):
            return value
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        else:
            value = value.astimezone(timezone.utc)
        if dialect.name == "sqlite":
            # SQLite no guarda la zona: queda la hora UTC en formato naive.
            return value.replace(tzinfo=None)
        return value

    def process_result_value(self, value, dialect):
        if value is None or not isinstance(value, datetime):
            return value
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
