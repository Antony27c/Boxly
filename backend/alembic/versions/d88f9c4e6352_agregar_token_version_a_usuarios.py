"""agregar token_version a usuarios

Revision ID: d88f9c4e6352
Revises: f1b8d3a6c2e4
Create Date: 2026-11-17 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd88f9c4e6352'
down_revision: Union[str, Sequence[str], None] = 'f1b8d3a6c2e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('usuarios', sa.Column('token_version', sa.Integer(), server_default=sa.text('0'), nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('usuarios', 'token_version')
