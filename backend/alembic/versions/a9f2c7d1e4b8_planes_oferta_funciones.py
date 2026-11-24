"""oferta: planes Esencial/Pro/Profesional, funciones, adicionales y tipo de acceso

Aplica docs/Oferta.md (tanda C, C0):
- planes: basico -> esencial y taller_plus -> profesional (pro queda); nombres,
  precios de referencia y max_personal nuevos; columna funciones (JSON).
- talleres.plan_codigo se actualiza antes de borrar los códigos viejos (la FK
  apunta a planes.codigo).
- Nueva tabla adicionales_taller (adicionales contratados encima del plan).
- Nueva columna talleres.tipo_acceso (pago|demo|piloto, default pago).

Los talleres existentes conservan su vencimiento: el cambio es solo de código
de plan (docs/Oferta.md, sección 3).

Revision ID: a9f2c7d1e4b8
Revises: c5a9e3f7d214
Create Date: 2026-11-24 10:00:00.000000

"""
import json
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = 'a9f2c7d1e4b8'
down_revision: Union[str, Sequence[str], None] = 'c5a9e3f7d214'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Funciones por plan (docs/Oferta.md, sección 4). Van literales: una migración
# es una foto histórica y no debe depender de constantes que puedan cambiar.
_FUNCIONES_ESENCIAL = ["gestion", "whatsapp_manual"]
_FUNCIONES_PRO = ["gestion", "whatsapp_manual", "whatsapp_automatico", "arca"]
_FUNCIONES_PROFESIONAL = [
    "gestion", "whatsapp_manual", "whatsapp_automatico", "arca",
    "recordatorios_service", "marca_propia",
]


def upgrade() -> None:
    with op.batch_alter_table('planes') as batch:
        batch.add_column(
            sa.Column('funciones', sa.JSON(), nullable=False, server_default='[]')
        )

    bind = op.get_bind()
    # Planes nuevos primero (la FK de talleres apunta a planes.codigo).
    bind.execute(
        sa.text(
            "INSERT INTO planes (codigo, nombre, precio_mensual, max_personal, funciones, activo) "
            "VALUES ('esencial', 'Esencial', 35000, 3, :f1, true), "
            "('profesional', 'Profesional', 169000, NULL, :f2, true)"
        ),
        {
            "f1": json.dumps(_FUNCIONES_ESENCIAL),
            "f2": json.dumps(_FUNCIONES_PROFESIONAL),
        },
    )
    bind.execute(
        sa.text(
            "UPDATE planes SET nombre = 'Pro', precio_mensual = 79000, "
            "max_personal = 10, funciones = :f, activo = true WHERE codigo = 'pro'"
        ),
        {"f": json.dumps(_FUNCIONES_PRO)},
    )
    # Los talleres existentes pasan a los códigos nuevos antes de borrar los viejos.
    bind.execute(sa.text("UPDATE talleres SET plan_codigo = 'esencial' WHERE plan_codigo = 'basico'"))
    bind.execute(
        sa.text("UPDATE talleres SET plan_codigo = 'profesional' WHERE plan_codigo = 'taller_plus'")
    )
    bind.execute(sa.text("DELETE FROM planes WHERE codigo IN ('basico', 'taller_plus')"))

    op.create_table(
        'adicionales_taller',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('taller_id', sa.Integer(), nullable=False),
        sa.Column('codigo', sa.String(length=40), nullable=False),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('desde', sa.Date(), nullable=True),
        sa.Column('hasta', sa.Date(), nullable=True),
        sa.Column('creado_en', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ['taller_id'], ['talleres.id'], name='fk_adicionales_taller_taller_id_talleres'
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_adicionales_taller_taller_id', 'adicionales_taller', ['taller_id'])

    with op.batch_alter_table('talleres') as batch:
        batch.add_column(
            sa.Column('tipo_acceso', sa.String(length=20), nullable=False, server_default='pago')
        )
        batch.create_check_constraint(
            'ck_talleres_tipo_acceso', "tipo_acceso IN ('pago', 'demo', 'piloto')"
        )


def downgrade() -> None:
    with op.batch_alter_table('talleres') as batch:
        batch.drop_constraint('ck_talleres_tipo_acceso', type_='check')
        batch.drop_column('tipo_acceso')

    op.drop_index('ix_adicionales_taller_taller_id', table_name='adicionales_taller')
    op.drop_table('adicionales_taller')

    with op.batch_alter_table('planes') as batch:
        batch.drop_column('funciones')

    bind = op.get_bind()
    bind.execute(
        sa.text(
            "UPDATE planes SET nombre = 'Pro', precio_mensual = 30000, max_personal = 10 "
            "WHERE codigo = 'pro'"
        )
    )
    # Planes viejos primero (la FK de talleres apunta a planes.codigo).
    planes = sa.table(
        'planes',
        sa.column('codigo', sa.String),
        sa.column('nombre', sa.String),
        sa.column('precio_mensual', sa.Numeric),
        sa.column('max_personal', sa.Integer),
        sa.column('activo', sa.Boolean),
    )
    op.bulk_insert(
        planes,
        [
            {'codigo': 'basico', 'nombre': 'Básico', 'precio_mensual': 15000, 'max_personal': 3,
             'activo': True},
            {'codigo': 'taller_plus', 'nombre': 'Taller+', 'precio_mensual': 50000, 'max_personal': None,
             'activo': True},
        ],
    )
    # Los talleres vuelven a los códigos viejos antes de borrar los nuevos.
    bind.execute(sa.text("UPDATE talleres SET plan_codigo = 'basico' WHERE plan_codigo = 'esencial'"))
    bind.execute(
        sa.text("UPDATE talleres SET plan_codigo = 'taller_plus' WHERE plan_codigo = 'profesional'")
    )
    bind.execute(sa.text("DELETE FROM planes WHERE codigo IN ('esencial', 'profesional')"))
