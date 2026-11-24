"""medio de pago y referencia en pagos

Aplica docs/Oferta.md (sección 4b, W2): el pago de una orden puede ser online
(Mercado Pago) o registrado en el local (efectivo, tarjeta, transferencia u
otro). Los pagos existentes son todos de Mercado Pago.

Revision ID: e4c8a2f6b1d9
Revises: d3e7b1a9c5f2
Create Date: 2026-11-24 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = 'e4c8a2f6b1d9'
down_revision: Union[str, Sequence[str], None] = 'd3e7b1a9c5f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('pagos') as batch:
        batch.add_column(
            sa.Column('medio', sa.String(length=20), nullable=False, server_default='mercadopago')
        )
        batch.add_column(sa.Column('referencia', sa.String(length=100), nullable=True))
        batch.create_check_constraint(
            'ck_pagos_medio_valido',
            "medio IN ('mercadopago', 'efectivo', 'tarjeta', 'transferencia', 'otro')",
        )


def downgrade() -> None:
    with op.batch_alter_table('pagos') as batch:
        batch.drop_constraint('ck_pagos_medio_valido', type_='check')
        batch.drop_column('referencia')
        batch.drop_column('medio')
