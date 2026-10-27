"""crear horarios de mecanicos y asignar mecanico a los turnos

Revision ID: d4e8a1c7b2f9
Revises: 294f285edb8a
Create Date: 2026-10-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e8a1c7b2f9'
down_revision: Union[str, Sequence[str], None] = '294f285edb8a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('horarios_mecanico',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('mecanico_id', sa.Integer(), nullable=False),
    sa.Column('dia_semana', sa.Integer(), nullable=False),
    sa.Column('hora_desde', sa.String(length=5), nullable=False),
    sa.Column('hora_hasta', sa.String(length=5), nullable=False),
    sa.ForeignKeyConstraint(['mecanico_id'], ['usuarios.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_horarios_mecanico_mecanico_id'), 'horarios_mecanico', ['mecanico_id'], unique=False)

    with op.batch_alter_table('turnos') as batch_op:
        batch_op.add_column(sa.Column('mecanico_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_turnos_mecanico_id_usuarios', 'usuarios', ['mecanico_id'], ['id']
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('turnos') as batch_op:
        batch_op.drop_constraint('fk_turnos_mecanico_id_usuarios', type_='foreignkey')
        batch_op.drop_column('mecanico_id')

    op.drop_index(op.f('ix_horarios_mecanico_mecanico_id'), table_name='horarios_mecanico')
    op.drop_table('horarios_mecanico')
