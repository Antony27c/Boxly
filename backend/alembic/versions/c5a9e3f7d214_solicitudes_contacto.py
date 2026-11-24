"""solicitudes de contacto de la landing pública

Tabla de prospectos de Boxly (dato de la plataforma, sin taller_id).

Revision ID: c5a9e3f7d214
Revises: b8d4f2a6c013
Create Date: 2026-11-23 21:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = 'c5a9e3f7d214'
down_revision: Union[str, Sequence[str], None] = 'b8d4f2a6c013'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'solicitudes_contacto',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('nombre', sa.String(length=100), nullable=False),
        sa.Column('taller', sa.String(length=120), nullable=False),
        sa.Column('email', sa.String(length=254), nullable=False),
        sa.Column('telefono', sa.String(length=30), nullable=True),
        sa.Column('ciudad', sa.String(length=80), nullable=True),
        sa.Column('mensaje', sa.Text(), nullable=True),
        sa.Column('estado', sa.String(length=20), nullable=False, server_default='nueva'),
        sa.Column('nota', sa.Text(), nullable=True),
        sa.Column('ip', sa.String(length=45), nullable=True),
        sa.Column('creado_en', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "estado IN ('nueva', 'contactada', 'convertida', 'descartada')",
            name='ck_solicitudes_contacto_estado',
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_solicitudes_contacto_estado', 'solicitudes_contacto', ['estado'])
    op.create_index('ix_solicitudes_contacto_ip_creado_en', 'solicitudes_contacto', ['ip', 'creado_en'])


def downgrade() -> None:
    op.drop_index('ix_solicitudes_contacto_ip_creado_en', table_name='solicitudes_contacto')
    op.drop_index('ix_solicitudes_contacto_estado', table_name='solicitudes_contacto')
    op.drop_table('solicitudes_contacto')
