"""crear tabla auditoria

Revision ID: b7d2f4a8c913
Revises: a1c5e9d3f701
Create Date: 2026-11-23 10:05:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = 'b7d2f4a8c913'
down_revision: Union[str, Sequence[str], None] = 'a1c5e9d3f701'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'auditoria',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('creado_en', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('usuario_id', sa.Integer(), nullable=True),
        sa.Column('usuario_email', sa.String(length=120), nullable=True),
        sa.Column('rol', sa.String(length=20), nullable=True),
        sa.Column('metodo', sa.String(length=8), nullable=False),
        sa.Column('ruta', sa.String(length=255), nullable=False),
        sa.Column('entidad', sa.String(length=50), nullable=True),
        sa.Column('entidad_id', sa.Integer(), nullable=True),
        sa.Column('estado_http', sa.Integer(), nullable=False),
        sa.Column('ip', sa.String(length=45), nullable=True),
        sa.Column('detalle', sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(
            ['usuario_id'], ['usuarios.id'],
            name='fk_auditoria_usuario_id_usuarios', ondelete='SET NULL',
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_auditoria_creado_en', 'auditoria', ['creado_en'])
    op.create_index('ix_auditoria_usuario_id', 'auditoria', ['usuario_id'])
    op.create_index('ix_auditoria_entidad', 'auditoria', ['entidad'])


def downgrade() -> None:
    op.drop_index('ix_auditoria_entidad', table_name='auditoria')
    op.drop_index('ix_auditoria_usuario_id', table_name='auditoria')
    op.drop_index('ix_auditoria_creado_en', table_name='auditoria')
    op.drop_table('auditoria')
