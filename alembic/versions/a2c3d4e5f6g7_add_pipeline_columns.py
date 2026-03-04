"""Add pipeline tracking columns to videos table

Revision ID: a2c3d4e5f6g7
Revises: 1b979b188f9a
Create Date: 2026-03-04 21:19:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a2c3d4e5f6g7'
down_revision = '1b979b188f9a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('videos', sa.Column('pipeline_status', sa.String(length=30), server_default='idle'))
    op.add_column('videos', sa.Column('merged_s3_key', sa.String(length=500), nullable=True))
    op.add_column('videos', sa.Column('strimmed_s3_key', sa.String(length=500), nullable=True))
    op.add_column('videos', sa.Column('broll_s3_key', sa.String(length=500), nullable=True))
    op.add_column('videos', sa.Column('final_s3_key', sa.String(length=500), nullable=True))
    op.add_column('videos', sa.Column('pipeline_error', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('videos', 'pipeline_error')
    op.drop_column('videos', 'final_s3_key')
    op.drop_column('videos', 'broll_s3_key')
    op.drop_column('videos', 'strimmed_s3_key')
    op.drop_column('videos', 'merged_s3_key')
    op.drop_column('videos', 'pipeline_status')
