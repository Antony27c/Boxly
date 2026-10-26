"""crear tabla pagos

Revision ID: c81e4a2d6f05
Revises: b52d1f7a9c3e
Create Date: 2026-10-25 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c81e4a2d6f05'
down_revision: Union[str, Sequence[str], None] = 'b52d1f7a9c3e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('pagos',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('orden_id', sa.Integer(), nullable=False),
    sa.Column('monto', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('estado', sa.String(length=20), nullable=False),
    sa.Column('preference_id', sa.String(length=100), nullable=True),
    sa.Column('payment_id', sa.String(length=50), nullable=True),
    sa.Column('creado_en', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.Column('fecha_pago', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['orden_id'], ['ordenes.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_pagos_orden_id'), 'pagos', ['orden_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_pagos_orden_id'), table_name='pagos')
    op.drop_table('pagos')
