"""aviso de stock mínimo: flag en repuestos y tabla de avisos internos

Aplica docs/Oferta.md (sección 4b, W3): cuando un movimiento de stock deja un
repuesto en `stock <= stock_minimo` se crea una notificación interna para el
administrador y recepción del taller, una sola vez por cruce del umbral.
Los repuestos que ya están bajo el mínimo quedan con el aviso "enviado" para
no alertar en falso; se rearma cuando el stock vuelve a superarlo.

Revision ID: c7d4e8f2a1b9
Revises: e8b2d4f6a901
Create Date: 2026-11-24 13:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = 'c7d4e8f2a1b9'
down_revision: Union[str, Sequence[str], None] = 'e8b2d4f6a901'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('repuestos') as batch:
        batch.add_column(
            sa.Column(
                'alerta_stock_enviada',
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )
    # Los que ya están bajo el mínimo se consideran avisados: el aviso saldrá
    # recién cuando el stock supere el mínimo y vuelva a cruzarlo.
    op.execute(
        "UPDATE repuestos SET alerta_stock_enviada = "
        "CASE WHEN stock <= stock_minimo THEN 1 ELSE 0 END"
    )

    op.create_table(
        'notificaciones_internas',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('taller_id', sa.Integer(), nullable=False),
        sa.Column('tipo', sa.String(length=30), nullable=False),
        sa.Column('repuesto_id', sa.Integer(), nullable=True),
        sa.Column('mensaje', sa.Text(), nullable=False),
        sa.Column('creado_en', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('leida_en', sa.DateTime(), nullable=True),
        sa.Column('leida_por_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ['leida_por_id'], ['usuarios.id'],
            name='fk_notificaciones_internas_leida_por_usuarios',
            ondelete='SET NULL',
        ),
        sa.ForeignKeyConstraint(
            ['repuesto_id'], ['repuestos.id'],
            name='fk_notificaciones_internas_repuesto_repuestos',
        ),
        sa.ForeignKeyConstraint(
            ['taller_id'], ['talleres.id'],
            name='fk_notificaciones_internas_taller_id_talleres',
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_notificaciones_internas_taller_id', 'notificaciones_internas', ['taller_id']
    )
    op.create_index(
        'ix_notificaciones_internas_repuesto_id', 'notificaciones_internas', ['repuesto_id']
    )


def downgrade() -> None:
    op.drop_index('ix_notificaciones_internas_repuesto_id', table_name='notificaciones_internas')
    op.drop_index('ix_notificaciones_internas_taller_id', table_name='notificaciones_internas')
    op.drop_table('notificaciones_internas')
    with op.batch_alter_table('repuestos') as batch:
        batch.drop_column('alerta_stock_enviada')
