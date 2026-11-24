"""planes: Esencial con 2 personas y descuento anual configurable

Decisión del dueño (empujar a los talleres hacia Pro y Profesional):
- `esencial.max_personal` pasa de 3 a 2, solo si sigue en 3: si el superadmin ya
  lo cambió, se respeta. Los talleres con más personal no pierden a nadie; el
  cupo solo bloquea altas y reactivaciones nuevas.
- Nueva columna `planes.descuento_anual_pct` (entero 0 a 100, NULL = sin
  descuento, sin default). Es solo informativa: el cobro anual no existe.

Revision ID: d8f1a3c5b7e2
Revises: b4e6d2f8a3c1
Create Date: 2026-11-24 17:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "d8f1a3c5b7e2"
down_revision: Union[str, Sequence[str], None] = "b4e6d2f8a3c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("planes") as batch:
        batch.add_column(sa.Column("descuento_anual_pct", sa.Integer(), nullable=True))
        batch.create_check_constraint(
            "ck_planes_descuento_anual_pct", "descuento_anual_pct BETWEEN 0 AND 100"
        )
    op.execute("UPDATE planes SET max_personal = 2 WHERE codigo = 'esencial' AND max_personal = 3")


def downgrade() -> None:
    # Simétrico: solo vuelve a 3 si quedó en el 2 de esta migración.
    op.execute("UPDATE planes SET max_personal = 3 WHERE codigo = 'esencial' AND max_personal = 2")
    with op.batch_alter_table("planes") as batch:
        batch.drop_constraint("ck_planes_descuento_anual_pct", type_="check")
        batch.drop_column("descuento_anual_pct")
