"""Add raw_s3_keys_json and overlays_json to videos table

Revision ID: b3d4e5f6g7h8
Revises: a2c3d4e5f6g7
Create Date: 2026-03-06 08:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b3d4e5f6g7h8'
down_revision = 'a2c3d4e5f6g7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('videos', sa.Column('raw_s3_keys_json', sa.Text(), nullable=True))
    op.add_column('videos', sa.Column('overlays_json', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('videos', 'overlays_json')
    op.drop_column('videos', 'raw_s3_keys_json')
