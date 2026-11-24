"""estado duplicado en pagos

Un cobro online aprobado que llega cuando la orden ya está paga (p. ej. el
cliente pagó en el local) se guarda como 'duplicado': la orden no se toca y la
plata queda visible para devolverla a mano (auditoría R2, bug 1).

Revision ID: e8b2d4f6a901
Revises: e4c8a2f6b1d9
Create Date: 2026-11-25 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = 'e8b2d4f6a901'
down_revision: Union[str, Sequence[str], None] = 'e4c8a2f6b1d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_ESTADOS_NUEVOS = "('pendiente', 'aprobado', 'rechazado', 'reembolsado', 'duplicado')"
_ESTADOS_VIEJOS = "('pendiente', 'aprobado', 'rechazado', 'reembolsado')"


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('pagos') as batch_op:
        batch_op.drop_constraint('ck_pagos_estado_valido', type_='check')
        batch_op.create_check_constraint(
            'ck_pagos_estado_valido',
            f'estado IN {_ESTADOS_NUEVOS}',
        )


def downgrade() -> None:
    """Downgrade schema."""
    # 'duplicado' no existe en el check viejo: se pasa a 'rechazado' para no
    # perder la fila (el pago igual queda para revisión manual).
    op.execute("UPDATE pagos SET estado = 'rechazado' WHERE estado = 'duplicado'")
    with op.batch_alter_table('pagos') as batch_op:
        batch_op.drop_constraint('ck_pagos_estado_valido', type_='check')
        batch_op.create_check_constraint(
            'ck_pagos_estado_valido',
            f'estado IN {_ESTADOS_VIEJOS}',
        )
