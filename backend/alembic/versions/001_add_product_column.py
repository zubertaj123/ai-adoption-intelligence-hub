"""Add product column to tools table

Revision ID: 001_add_product
Revises:
Create Date: 2026-04-03 15:00:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001_add_product'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Add product column to tools table
    op.add_column('tools', sa.Column('product', sa.String(50), nullable=True))


def downgrade():
    # Remove product column from tools table
    op.drop_column('tools', 'product')