"""agregar checks de integridad e indices en FKs

Revision ID: b3f7a2c91e04
Revises: d88f9c4e6352
Create Date: 2026-11-17 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3f7a2c91e04'
down_revision: Union[str, Sequence[str], None] = 'd88f9c4e6352'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # CHECKs: batch_alter_table recrea la tabla en SQLite y en Postgres
    # emite el ALTER TABLE ... ADD CONSTRAINT equivalente.
    with op.batch_alter_table('repuestos') as batch_op:
        batch_op.create_check_constraint(
            'ck_repuestos_stock_no_negativo', 'stock >= 0'
        )
    with op.batch_alter_table('ordenes') as batch_op:
        batch_op.create_check_constraint(
            'ck_ordenes_estado_valido',
            "estado IN ('pendiente', 'ingresado', 'en_diagnostico', "
            "'esperando_repuestos', 'listo', 'entregado', 'cancelado')",
        )
    with op.batch_alter_table('turnos') as batch_op:
        batch_op.create_check_constraint(
            'ck_turnos_estado_valido',
            "estado IN ('pendiente', 'confirmado', 'en_taller', "
            "'completado', 'cancelado', 'asistio')",
        )
    with op.batch_alter_table('pagos') as batch_op:
        batch_op.create_check_constraint(
            'ck_pagos_estado_valido',
            "estado IN ('pendiente', 'aprobado', 'rechazado', 'reembolsado')",
        )

    # Indices en las FK y columnas más consultadas.
    op.create_index('ix_ordenes_cliente_id', 'ordenes', ['cliente_id'])
    op.create_index('ix_ordenes_vehiculo_id', 'ordenes', ['vehiculo_id'])
    op.create_index('ix_ordenes_mecanico_id', 'ordenes', ['mecanico_id'])
    op.create_index('ix_ordenes_estado', 'ordenes', ['estado'])
    op.create_index('ix_ordenes_fecha_ingreso', 'ordenes', ['fecha_ingreso'])
    op.create_index('ix_detalles_orden_orden_id', 'detalles_orden', ['orden_id'])
    op.create_index('ix_historial_estado_orden_id', 'historial_estado', ['orden_id'])
    op.create_index('ix_vehiculos_cliente_id', 'vehiculos', ['cliente_id'])
    op.create_index('ix_turnos_fecha_hora', 'turnos', ['fecha_hora'])
    op.create_index('ix_turnos_cliente_id', 'turnos', ['cliente_id'])
    op.create_index('ix_turnos_mecanico_id', 'turnos', ['mecanico_id'])

    # Indices únicos parciales.
    op.create_index(
        'uq_turnos_mecanico_fecha_hora', 'turnos', ['fecha_hora', 'mecanico_id'],
        unique=True,
        sqlite_where=sa.text("estado <> 'cancelado' AND mecanico_id IS NOT NULL"),
        postgresql_where=sa.text("estado <> 'cancelado' AND mecanico_id IS NOT NULL"),
    )
    op.create_index(
        'uq_pagos_payment_id', 'pagos', ['payment_id'],
        unique=True,
        sqlite_where=sa.text('payment_id IS NOT NULL'),
        postgresql_where=sa.text('payment_id IS NOT NULL'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('uq_pagos_payment_id', table_name='pagos')
    op.drop_index('uq_turnos_mecanico_fecha_hora', table_name='turnos')
    op.drop_index('ix_turnos_mecanico_id', table_name='turnos')
    op.drop_index('ix_turnos_cliente_id', table_name='turnos')
    op.drop_index('ix_turnos_fecha_hora', table_name='turnos')
    op.drop_index('ix_vehiculos_cliente_id', table_name='vehiculos')
    op.drop_index('ix_historial_estado_orden_id', table_name='historial_estado')
    op.drop_index('ix_detalles_orden_orden_id', table_name='detalles_orden')
    op.drop_index('ix_ordenes_fecha_ingreso', table_name='ordenes')
    op.drop_index('ix_ordenes_estado', table_name='ordenes')
    op.drop_index('ix_ordenes_mecanico_id', table_name='ordenes')
    op.drop_index('ix_ordenes_vehiculo_id', table_name='ordenes')
    op.drop_index('ix_ordenes_cliente_id', table_name='ordenes')

    with op.batch_alter_table('pagos') as batch_op:
        batch_op.drop_constraint('ck_pagos_estado_valido', type_='check')
    with op.batch_alter_table('turnos') as batch_op:
        batch_op.drop_constraint('ck_turnos_estado_valido', type_='check')
    with op.batch_alter_table('ordenes') as batch_op:
        batch_op.drop_constraint('ck_ordenes_estado_valido', type_='check')
    with op.batch_alter_table('repuestos') as batch_op:
        batch_op.drop_constraint('ck_repuestos_stock_no_negativo', type_='check')
