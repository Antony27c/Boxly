"""encuestas de fin de la demo

Tabla de la encuesta opcional que ve el administrador cuando vence la demo
(docs/Oferta.md, tarea C6). Es dato de la plataforma sobre el taller: sin
taller_id de contexto, una fila por taller.

Revision ID: d3e7b1a9c5f2
Revises: a9f2c7d1e4b8
Create Date: 2026-11-24 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = 'd3e7b1a9c5f2'
down_revision: Union[str, Sequence[str], None] = 'a9f2c7d1e4b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'encuestas_demo',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('taller_id', sa.Integer(), nullable=False),
        sa.Column('respondida_por_id', sa.Integer(), nullable=True),
        sa.Column('gusto', sa.String(length=1000), nullable=True),
        sa.Column('mejoras', sa.String(length=1000), nullable=True),
        sa.Column('sugerencias', sa.String(length=1000), nullable=True),
        sa.Column('puntaje', sa.Integer(), nullable=True),
        sa.Column('intencion', sa.String(length=20), nullable=True),
        sa.Column('salteada', sa.Boolean(), server_default='0', nullable=False),
        sa.Column('creado_en', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "intencion IS NULL OR intencion IN ('contratar', 'tal_vez', 'no')",
            name='ck_encuestas_demo_intencion',
        ),
        sa.CheckConstraint(
            'puntaje IS NULL OR puntaje BETWEEN 1 AND 5',
            name='ck_encuestas_demo_puntaje',
        ),
        sa.ForeignKeyConstraint(
            ['respondida_por_id'],
            ['usuarios.id'],
            name='fk_encuestas_demo_respondida_por_usuarios',
            ondelete='SET NULL',
        ),
        sa.ForeignKeyConstraint(
            ['taller_id'],
            ['talleres.id'],
            name='fk_encuestas_demo_taller_id_talleres',
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_encuestas_demo_taller_id', 'encuestas_demo', ['taller_id'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_encuestas_demo_taller_id', table_name='encuestas_demo')
    op.drop_table('encuestas_demo')
