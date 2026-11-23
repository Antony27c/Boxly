"""multi-taller: talleres, accesos de soporte y taller_id en los datos

Todo lo que había pasa al taller 1 ("Taller principal", con el nombre de la
configuración si existía). El superadmin queda sin taller. Los DNI, patentes y
códigos pasan a ser únicos dentro de cada taller.

Revision ID: e9a4b2c6d801
Revises: c3e8a6b1d527
Create Date: 2026-11-23 18:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e9a4b2c6d801'
down_revision: Union[str, Sequence[str], None] = 'c3e8a6b1d527'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLAS_TALLER = (
    'clientes', 'vehiculos', 'ordenes', 'repuestos', 'turnos',
    'horarios_mecanico', 'pagos', 'notificaciones',
)
# (tabla, columna): índice único global viejo -> único por taller.
UNICOS = (
    ('clientes', 'dni', 'uq_clientes_taller_dni'),
    ('vehiculos', 'patente', 'uq_vehiculos_taller_patente'),
    ('ordenes', 'codigo', 'uq_ordenes_taller_codigo'),
    ('repuestos', 'codigo', 'uq_repuestos_taller_codigo'),
)


def upgrade() -> None:
    op.create_table(
        'talleres',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('nombre', sa.String(length=120), nullable=False),
        sa.Column('estado', sa.String(length=20), nullable=False, server_default='activo'),
        sa.Column('creado_en', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('suspendido_en', sa.DateTime(timezone=True), nullable=True),
        sa.Column('terminos_version', sa.String(length=20), nullable=True),
        sa.Column('terminos_aceptados_en', sa.DateTime(timezone=True), nullable=True),
        sa.Column('terminos_aceptados_por_id', sa.Integer(), nullable=True),
        sa.CheckConstraint("estado IN ('activo', 'suspendido')", name='ck_talleres_estado_valido'),
        sa.ForeignKeyConstraint(['terminos_aceptados_por_id'], ['usuarios.id'],
                                name='fk_talleres_terminos_por_usuarios', ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    conn = op.get_bind()
    nombre = conn.execute(sa.text("SELECT nombre FROM configuracion_taller ORDER BY id LIMIT 1")).scalar()
    conn.execute(
        sa.text("INSERT INTO talleres (id, nombre, estado) VALUES (1, :nombre, 'activo')"),
        {"nombre": nombre or "Taller principal"},
    )

    op.create_table(
        'accesos_soporte',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('taller_id', sa.Integer(), nullable=False),
        sa.Column('otorgado_por_id', sa.Integer(), nullable=True),
        sa.Column('motivo', sa.String(length=300), nullable=True),
        sa.Column('desde', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('hasta', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revocado_en', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revocado_por_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['taller_id'], ['talleres.id'], name='fk_accesos_soporte_taller_id_talleres'),
        sa.ForeignKeyConstraint(['otorgado_por_id'], ['usuarios.id'],
                                name='fk_accesos_soporte_otorgado_por_usuarios', ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['revocado_por_id'], ['usuarios.id'],
                                name='fk_accesos_soporte_revocado_por_usuarios', ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_accesos_soporte_taller_id', 'accesos_soporte', ['taller_id'])

    for tabla in TABLAS_TALLER:
        op.add_column(tabla, sa.Column('taller_id', sa.Integer(), nullable=True))
        op.execute(f"UPDATE {tabla} SET taller_id = 1")
        with op.batch_alter_table(tabla) as batch:
            batch.alter_column('taller_id', existing_type=sa.Integer(), nullable=False)
            batch.create_foreign_key(f'fk_{tabla}_taller_id_talleres', 'talleres', ['taller_id'], ['id'])
        op.create_index(f'ix_{tabla}_taller_id', tabla, ['taller_id'])

    for tabla, columna, nombre_uq in UNICOS:
        op.drop_index(f'ix_{tabla}_{columna}', table_name=tabla)
        op.create_index(f'ix_{tabla}_{columna}', tabla, [columna])
        with op.batch_alter_table(tabla) as batch:
            batch.create_unique_constraint(nombre_uq, ['taller_id', columna])

    # Usuarios y auditoría: taller nullable (superadmin y acciones de plataforma).
    with op.batch_alter_table('usuarios') as batch:
        batch.add_column(sa.Column('taller_id', sa.Integer(), nullable=True))
        batch.create_foreign_key('fk_usuarios_taller_id_talleres', 'talleres', ['taller_id'], ['id'])
    op.execute("UPDATE usuarios SET taller_id = 1 WHERE rol <> 'superadmin'")
    op.create_index('ix_usuarios_taller_id', 'usuarios', ['taller_id'])

    with op.batch_alter_table('auditoria') as batch:
        batch.add_column(sa.Column('taller_id', sa.Integer(), nullable=True))
        batch.add_column(sa.Column('soporte', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch.create_foreign_key('fk_auditoria_taller_id_talleres', 'talleres', ['taller_id'], ['id'])
    op.execute(
        "UPDATE auditoria SET taller_id = 1 WHERE usuario_id IN "
        "(SELECT id FROM usuarios WHERE taller_id = 1)"
    )
    op.create_index('ix_auditoria_taller_id', 'auditoria', ['taller_id'])

    # Configuración: una fila por taller.
    op.add_column('configuracion_taller', sa.Column('taller_id', sa.Integer(), nullable=True))
    op.execute("UPDATE configuracion_taller SET taller_id = 1")
    op.execute("DELETE FROM configuracion_taller WHERE id <> (SELECT MIN(id) FROM configuracion_taller)")
    with op.batch_alter_table('configuracion_taller') as batch:
        batch.alter_column('taller_id', existing_type=sa.Integer(), nullable=False)
        batch.create_foreign_key('fk_configuracion_taller_taller_id_talleres', 'talleres',
                                 ['taller_id'], ['id'])
        batch.create_unique_constraint('uq_configuracion_taller_taller_id', ['taller_id'])


def downgrade() -> None:
    # Vuelve a un solo taller: se conservan solo los datos del taller 1.
    for tabla in ('notificaciones', 'pagos', 'turnos', 'horarios_mecanico'):
        op.execute(f"DELETE FROM {tabla} WHERE taller_id <> 1")
    op.execute("DELETE FROM historial_estado WHERE orden_id IN (SELECT id FROM ordenes WHERE taller_id <> 1)")
    op.execute("DELETE FROM detalles_orden WHERE orden_id IN (SELECT id FROM ordenes WHERE taller_id <> 1)")
    op.execute("DELETE FROM imagenes_orden WHERE orden_id IN (SELECT id FROM ordenes WHERE taller_id <> 1)")
    for tabla in ('ordenes', 'vehiculos', 'repuestos'):
        op.execute(f"DELETE FROM {tabla} WHERE taller_id <> 1")
    op.execute("UPDATE usuarios SET cliente_id = NULL WHERE taller_id IS NOT NULL AND taller_id <> 1")
    op.execute("DELETE FROM usuarios WHERE taller_id IS NOT NULL AND taller_id <> 1")
    op.execute("DELETE FROM clientes WHERE taller_id <> 1")
    op.execute("DELETE FROM configuracion_taller WHERE taller_id <> 1")

    with op.batch_alter_table('configuracion_taller') as batch:
        batch.drop_constraint('uq_configuracion_taller_taller_id', type_='unique')
        batch.drop_constraint('fk_configuracion_taller_taller_id_talleres', type_='foreignkey')
        batch.drop_column('taller_id')

    op.drop_index('ix_auditoria_taller_id', table_name='auditoria')
    with op.batch_alter_table('auditoria') as batch:
        batch.drop_constraint('fk_auditoria_taller_id_talleres', type_='foreignkey')
        batch.drop_column('soporte')
        batch.drop_column('taller_id')

    op.drop_index('ix_usuarios_taller_id', table_name='usuarios')
    with op.batch_alter_table('usuarios') as batch:
        batch.drop_constraint('fk_usuarios_taller_id_talleres', type_='foreignkey')
        batch.drop_column('taller_id')

    for tabla, columna, nombre_uq in UNICOS:
        with op.batch_alter_table(tabla) as batch:
            batch.drop_constraint(nombre_uq, type_='unique')
        op.drop_index(f'ix_{tabla}_{columna}', table_name=tabla)
        op.create_index(f'ix_{tabla}_{columna}', tabla, [columna], unique=True)

    for tabla in TABLAS_TALLER:
        op.drop_index(f'ix_{tabla}_taller_id', table_name=tabla)
        with op.batch_alter_table(tabla) as batch:
            batch.drop_constraint(f'fk_{tabla}_taller_id_talleres', type_='foreignkey')
            batch.drop_column('taller_id')

    op.drop_index('ix_accesos_soporte_taller_id', table_name='accesos_soporte')
    op.drop_table('accesos_soporte')
    op.drop_table('talleres')
