"""agregar rol cliente y vincular usuarios con clientes

Revision ID: b52d1f7a9c3e
Revises: 3997508db1b0
Create Date: 2026-10-25 21:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b52d1f7a9c3e'
down_revision: Union[str, Sequence[str], None] = '3997508db1b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ROLES_ANTERIORES = ('administrador', 'recepcion', 'mecanico')
ROLES_NUEVOS = (*ROLES_ANTERIORES, 'cliente')


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('usuarios') as batch_op:
        batch_op.alter_column(
            'rol',
            existing_type=sa.Enum(*ROLES_ANTERIORES, name='rol_usuario', native_enum=False),
            type_=sa.Enum(*ROLES_NUEVOS, name='rol_usuario', native_enum=False),
            existing_nullable=False,
        )
        batch_op.add_column(sa.Column('cliente_id', sa.Integer(), nullable=True))
        batch_op.create_unique_constraint('uq_usuarios_cliente_id', ['cliente_id'])
        batch_op.create_foreign_key(
            'fk_usuarios_cliente_id_clientes', 'clientes', ['cliente_id'], ['id']
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DELETE FROM usuarios WHERE rol = 'cliente'")
    with op.batch_alter_table('usuarios') as batch_op:
        batch_op.drop_constraint('fk_usuarios_cliente_id_clientes', type_='foreignkey')
        batch_op.drop_constraint('uq_usuarios_cliente_id', type_='unique')
        batch_op.drop_column('cliente_id')
        batch_op.alter_column(
            'rol',
            existing_type=sa.Enum(*ROLES_NUEVOS, name='rol_usuario', native_enum=False),
            type_=sa.Enum(*ROLES_ANTERIORES, name='rol_usuario', native_enum=False),
            existing_nullable=False,
        )
