"""planes: telegram_automatico en Pro y Profesional y cupo de facturas ARCA

Aplica docs/Oferta.md (secciones 1 y 4, decisiones del 2026-11-23):
- Pro y Profesional suman la función `telegram_automatico` (avisos automáticos
  por Telegram). Solo se agrega el código a la lista que ya tiene cada plan: el
  resto de lo que haya editado el superadmin queda igual.
- Nueva columna `planes.cupo_facturas_arca` (entero, NULL = cupo pendiente, sin
  default numérico: los cupos todavía no están definidos).

Revision ID: b4e6d2f8a3c1
Revises: c7d4e8f2a1b9
Create Date: 2026-11-24 15:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "b4e6d2f8a3c1"
down_revision: Union[str, Sequence[str], None] = "c7d4e8f2a1b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Literales: una migración es una foto histórica y no depende de constantes.
_TELEGRAM = "telegram_automatico"
_PLANES_CON_TELEGRAM = ("pro", "profesional")
# Va justo después de los avisos automáticos por WhatsApp, como en PLANES_INICIALES.
_DESPUES_DE = "whatsapp_automatico"

# Tabla liviana con el tipo JSON de SQLAlchemy: lee y escribe la lista igual en
# PostgreSQL y en SQLite.
_planes = sa.table(
    "planes",
    sa.column("codigo", sa.String),
    sa.column("funciones", sa.JSON),
)


def _con_telegram(funciones: list[str]) -> list[str]:
    if _TELEGRAM in funciones:
        return funciones
    if _DESPUES_DE in funciones:
        posicion = funciones.index(_DESPUES_DE) + 1
        return [*funciones[:posicion], _TELEGRAM, *funciones[posicion:]]
    return [*funciones, _TELEGRAM]


def _actualizar_funciones(codigos, transformar) -> None:
    bind = op.get_bind()
    filas = bind.execute(
        sa.select(_planes.c.codigo, _planes.c.funciones).where(_planes.c.codigo.in_(codigos))
    ).all()
    for codigo, funciones in filas:
        actuales = list(funciones or [])
        nuevas = transformar(actuales)
        if nuevas != actuales:
            bind.execute(_planes.update().where(_planes.c.codigo == codigo).values(funciones=nuevas))


def upgrade() -> None:
    with op.batch_alter_table("planes") as batch:
        batch.add_column(sa.Column("cupo_facturas_arca", sa.Integer(), nullable=True))
    _actualizar_funciones(_PLANES_CON_TELEGRAM, _con_telegram)


def downgrade() -> None:
    # El código sale de todos los planes: antes de esta migración no existía.
    bind = op.get_bind()
    todos = [c for (c,) in bind.execute(sa.select(_planes.c.codigo)).all()]
    _actualizar_funciones(todos, lambda fs: [f for f in fs if f != _TELEGRAM])
    with op.batch_alter_table("planes") as batch:
        batch.drop_column("cupo_facturas_arca")
