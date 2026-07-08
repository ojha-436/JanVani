"""add verification fields to complaints

Revision ID: d2e3f4a5b6c7
Revises: c1a2b3d4e5f6
Create Date: 2026-07-04 00:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'd2e3f4a5b6c7'
down_revision = 'c1a2b3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('complaints', sa.Column('verification_confidence', sa.Integer(), nullable=True))
    op.add_column('complaints', sa.Column('verification_status', sa.String(), nullable=True))
    op.add_column('complaints', sa.Column('verification_reasons', postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column('complaints', 'verification_reasons')
    op.drop_column('complaints', 'verification_status')
    op.drop_column('complaints', 'verification_confidence')
