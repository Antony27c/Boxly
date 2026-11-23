"""precio a cotizar: detalles_orden.precio_unitario nullable

Revision ID: a7c3e1f5b902
Revises: e9a4b2c6d801
Create Date: 2026-11-23 19:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a7c3e1f5b902'
down_revision: Union[str, Sequence[str], None] = 'e9a4b2c6d801'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('detalles_orden') as batch:
        batch.alter_column('precio_unitario', existing_type=sa.Numeric(12, 2), nullable=True)


def downgrade() -> None:
    op.execute("UPDATE detalles_orden SET precio_unitario = 0 WHERE precio_unitario IS NULL")
    with op.batch_alter_table('detalles_orden') as batch:
        batch.alter_column('precio_unitario', existing_type=sa.Numeric(12, 2), nullable=False)
