"""crear tabla notificaciones

Revision ID: f1b8d3a6c2e4
Revises: e7a3c9b15d20
Create Date: 2026-11-03 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1b8d3a6c2e4'
down_revision: Union[str, Sequence[str], None] = 'e7a3c9b15d20'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('notificaciones',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('orden_id', sa.Integer(), nullable=False),
    sa.Column('tipo', sa.String(length=30), nullable=False),
    sa.Column('estado_orden', sa.String(length=30), nullable=False),
    sa.Column('destinatario', sa.String(length=120), nullable=False),
    sa.Column('asunto', sa.String(length=200), nullable=False),
    sa.Column('resultado', sa.String(length=20), nullable=False),
    sa.Column('error', sa.Text(), nullable=True),
    sa.Column('enviado_por_id', sa.Integer(), nullable=True),
    sa.Column('creado_en', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.ForeignKeyConstraint(['orden_id'], ['ordenes.id'], ),
    sa.ForeignKeyConstraint(['enviado_por_id'], ['usuarios.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_notificaciones_orden_id'), 'notificaciones', ['orden_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_notificaciones_orden_id'), table_name='notificaciones')
    op.drop_table('notificaciones')
