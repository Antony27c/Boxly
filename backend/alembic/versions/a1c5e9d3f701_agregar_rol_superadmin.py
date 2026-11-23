"""agregar rol superadmin

Revision ID: a1c5e9d3f701
Revises: f2a9c4e17b83
Create Date: 2026-11-23 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1c5e9d3f701'
down_revision: Union[str, Sequence[str], None] = 'f2a9c4e17b83'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ROLES_ANTERIORES = ('administrador', 'recepcion', 'mecanico', 'cliente')
ROLES_NUEVOS = ('superadmin', *ROLES_ANTERIORES)


def upgrade() -> None:
    with op.batch_alter_table('usuarios') as batch_op:
        batch_op.alter_column(
            'rol',
            existing_type=sa.Enum(*ROLES_ANTERIORES, name='rol_usuario', native_enum=False),
            type_=sa.Enum(*ROLES_NUEVOS, name='rol_usuario', native_enum=False),
            existing_nullable=False,
        )


def downgrade() -> None:
    # Los superadmin bajan a administrador para no perder el acceso.
    op.execute("UPDATE usuarios SET rol = 'administrador' WHERE rol = 'superadmin'")
    with op.batch_alter_table('usuarios') as batch_op:
        batch_op.alter_column(
            'rol',
            existing_type=sa.Enum(*ROLES_NUEVOS, name='rol_usuario', native_enum=False),
            type_=sa.Enum(*ROLES_ANTERIORES, name='rol_usuario', native_enum=False),
            existing_nullable=False,
        )
