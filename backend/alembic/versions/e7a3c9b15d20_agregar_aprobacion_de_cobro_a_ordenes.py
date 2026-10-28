"""agregar aprobacion de cobro a las ordenes

Revision ID: e7a3c9b15d20
Revises: d4e8a1c7b2f9
Create Date: 2026-10-27 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7a3c9b15d20'
down_revision: Union[str, Sequence[str], None] = 'd4e8a1c7b2f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('ordenes') as batch_op:
        batch_op.add_column(sa.Column('cobro_estado', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('monto_propuesto', sa.Numeric(precision=12, scale=2), nullable=True))
        batch_op.add_column(sa.Column('cobro_propuesto_por_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('cobro_aprobado_por_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('cobro_aprobado_en', sa.DateTime(), nullable=True))
        batch_op.create_foreign_key(
            'fk_ordenes_cobro_propuesto_por_id_usuarios', 'usuarios', ['cobro_propuesto_por_id'], ['id']
        )
        batch_op.create_foreign_key(
            'fk_ordenes_cobro_aprobado_por_id_usuarios', 'usuarios', ['cobro_aprobado_por_id'], ['id']
        )

    op.execute("UPDATE ordenes SET cobro_estado = 'aprobado' WHERE costo_final IS NOT NULL AND costo_final > 0")


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('ordenes') as batch_op:
        batch_op.drop_constraint('fk_ordenes_cobro_aprobado_por_id_usuarios', type_='foreignkey')
        batch_op.drop_constraint('fk_ordenes_cobro_propuesto_por_id_usuarios', type_='foreignkey')
        batch_op.drop_column('cobro_aprobado_en')
        batch_op.drop_column('cobro_aprobado_por_id')
        batch_op.drop_column('cobro_propuesto_por_id')
        batch_op.drop_column('monto_propuesto')
        batch_op.drop_column('cobro_estado')
