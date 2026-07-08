"""add assigned_department to complaints

Revision ID: a1b2c3d4e5f7
Revises: d2e3f4a5b6c7
Create Date: 2026-07-07 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'a1b2c3d4e5f7'
down_revision = 'd2e3f4a5b6c7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('complaints', sa.Column('assigned_department', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('complaints', 'assigned_department')
