"""planes y suscripciones de los talleres

Crea planes (Básico, Pro, Taller+), pagos_suscripcion y los campos de suscripción
en talleres. Los talleres existentes quedan en Básico con 30 días de prueba.

Revision ID: b8d4f2a6c013
Revises: a7c3e1f5b902
Create Date: 2026-11-23 19:45:00.000000

"""
from datetime import date, timedelta
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b8d4f2a6c013'
down_revision: Union[str, Sequence[str], None] = 'a7c3e1f5b902'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    planes = op.create_table(
        'planes',
        sa.Column('codigo', sa.String(length=20), nullable=False),
        sa.Column('nombre', sa.String(length=60), nullable=False),
        sa.Column('precio_mensual', sa.Numeric(12, 2), nullable=False),
        sa.Column('max_personal', sa.Integer(), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.PrimaryKeyConstraint('codigo'),
    )
    op.bulk_insert(planes, [
        {'codigo': 'basico', 'nombre': 'Básico', 'precio_mensual': 15000, 'max_personal': 3, 'activo': True},
        {'codigo': 'pro', 'nombre': 'Pro', 'precio_mensual': 30000, 'max_personal': 10, 'activo': True},
        {'codigo': 'taller_plus', 'nombre': 'Taller+', 'precio_mensual': 50000, 'max_personal': None, 'activo': True},
    ])

    op.create_table(
        'pagos_suscripcion',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('taller_id', sa.Integer(), nullable=False),
        sa.Column('monto', sa.Numeric(12, 2), nullable=False),
        sa.Column('periodo_desde', sa.Date(), nullable=False),
        sa.Column('periodo_hasta', sa.Date(), nullable=False),
        sa.Column('medio', sa.String(length=20), nullable=False),
        sa.Column('estado', sa.String(length=20), nullable=False),
        sa.Column('referencia', sa.String(length=200), nullable=True),
        sa.Column('mp_payment_id', sa.String(length=60), nullable=True),
        sa.Column('registrado_por_id', sa.Integer(), nullable=True),
        sa.Column('creado_en', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("medio IN ('manual', 'mercadopago')", name='ck_pagos_suscripcion_medio'),
        sa.CheckConstraint("estado IN ('aprobado', 'pendiente', 'rechazado')", name='ck_pagos_suscripcion_estado'),
        sa.ForeignKeyConstraint(['taller_id'], ['talleres.id'], name='fk_pagos_suscripcion_taller_id_talleres'),
        sa.ForeignKeyConstraint(['registrado_por_id'], ['usuarios.id'],
                                name='fk_pagos_suscripcion_registrado_por_usuarios', ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('mp_payment_id', name='uq_pagos_suscripcion_mp_payment_id'),
    )
    op.create_index('ix_pagos_suscripcion_taller_id', 'pagos_suscripcion', ['taller_id'])

    with op.batch_alter_table('talleres') as batch:
        batch.add_column(sa.Column('plan_codigo', sa.String(length=20), nullable=False, server_default='basico'))
        batch.add_column(sa.Column('suscripcion_vence_en', sa.Date(), nullable=True))
        batch.add_column(sa.Column('cobro_automatico', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch.add_column(sa.Column('mp_preapproval_id', sa.String(length=60), nullable=True))
        batch.create_foreign_key('fk_talleres_plan_codigo_planes', 'planes', ['plan_codigo'], ['codigo'])
    op.get_bind().execute(
        sa.text("UPDATE talleres SET suscripcion_vence_en = :vence"),
        {"vence": date.today() + timedelta(days=30)},
    )


def downgrade() -> None:
    with op.batch_alter_table('talleres') as batch:
        batch.drop_constraint('fk_talleres_plan_codigo_planes', type_='foreignkey')
        batch.drop_column('mp_preapproval_id')
        batch.drop_column('cobro_automatico')
        batch.drop_column('suscripcion_vence_en')
        batch.drop_column('plan_codigo')
    op.drop_index('ix_pagos_suscripcion_taller_id', table_name='pagos_suscripcion')
    op.drop_table('pagos_suscripcion')
    op.drop_table('planes')
