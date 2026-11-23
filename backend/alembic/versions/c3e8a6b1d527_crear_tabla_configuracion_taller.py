"""crear tabla configuracion_taller

Revision ID: c3e8a6b1d527
Revises: b7d2f4a8c913
Create Date: 2026-11-23 10:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3e8a6b1d527'
down_revision: Union[str, Sequence[str], None] = 'b7d2f4a8c913'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'configuracion_taller',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('nombre', sa.String(length=120), nullable=False),
        sa.Column('razon_social', sa.String(length=120), nullable=True),
        sa.Column('cuit', sa.String(length=13), nullable=True),
        sa.Column('direccion', sa.String(length=200), nullable=True),
        sa.Column('telefono', sa.String(length=30), nullable=True),
        sa.Column('email', sa.String(length=120), nullable=True),
        sa.Column('sitio_web', sa.String(length=200), nullable=True),
        sa.Column('hora_apertura', sa.String(length=5), nullable=False),
        sa.Column('hora_cierre', sa.String(length=5), nullable=False),
        sa.Column('mensaje_portal', sa.String(length=500), nullable=True),
        sa.Column('pie_ticket', sa.String(length=300), nullable=True),
        sa.Column('dias_garantia', sa.Integer(), nullable=False),
        sa.Column('actualizado_en', sa.DateTime(timezone=True), nullable=True),
        sa.Column('actualizado_por_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ['actualizado_por_id'], ['usuarios.id'],
            name='fk_configuracion_taller_actualizado_por_id_usuarios', ondelete='SET NULL',
        ),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('configuracion_taller')
