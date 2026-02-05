"""script_py_template

Revision ID: 1b979b188f9a
Revises: None
Create Date: 2026-02-05 15:18:10.212615

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '1b979b188f9a'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create videos table
    op.create_table(
        'videos',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('original_filename', sa.String(length=255), nullable=False),
        sa.Column('s3_key', sa.String(length=500), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='uploading', nullable=True),
        sa.Column('file_size_bytes', sa.BigInteger(), nullable=True),
        sa.Column('duration_sec', sa.Float(), nullable=True),
        sa.Column('thumbnail_url', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('videos')
