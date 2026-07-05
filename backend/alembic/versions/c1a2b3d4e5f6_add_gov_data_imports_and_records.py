"""add gov_data_imports and gov_data_records tables

Revision ID: c1a2b3d4e5f6
Revises: 8f646de7425b
Create Date: 2026-07-04 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'c1a2b3d4e5f6'
down_revision = '8f646de7425b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'gov_data_imports',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('mp_id', sa.UUID(), nullable=True),
        sa.Column('source_type', sa.String(), nullable=False),
        sa.Column('source_label', sa.String(), nullable=False),
        sa.Column('detected_category', sa.String(), nullable=True),
        sa.Column('field_mapping', postgresql.JSONB(), nullable=True),
        sa.Column('confidence', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('row_count', sa.Integer(), nullable=False),
        sa.Column('issues', postgresql.JSONB(), nullable=True),
        sa.Column('explanation', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['mp_id'], ['mp_allowlist.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'gov_data_records',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('import_id', sa.UUID(), nullable=False),
        sa.Column('district', sa.String(), nullable=True),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('metrics', postgresql.JSONB(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['import_id'], ['gov_data_imports.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_gov_data_records_district'), 'gov_data_records', ['district'], unique=False)
    op.create_index(op.f('ix_gov_data_records_category'), 'gov_data_records', ['category'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_gov_data_records_category'), table_name='gov_data_records')
    op.drop_index(op.f('ix_gov_data_records_district'), table_name='gov_data_records')
    op.drop_table('gov_data_records')
    op.drop_table('gov_data_imports')
