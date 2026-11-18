"""indice unico de pago pendiente por orden

Revision ID: f2a9c4e17b83
Revises: b3f7a2c91e04
Create Date: 2026-11-17 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2a9c4e17b83'
down_revision: Union[str, Sequence[str], None] = 'b3f7a2c91e04'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_index(
        'uq_pagos_orden_pendiente', 'pagos', ['orden_id'],
        unique=True,
        sqlite_where=sa.text("estado = 'pendiente'"),
        postgresql_where=sa.text("estado = 'pendiente'"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('uq_pagos_orden_pendiente', table_name='pagos')
