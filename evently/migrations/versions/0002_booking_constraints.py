"""booking constraints & idempotency unique index

Revision ID: 0002_booking_constraints
Revises: 0001_initial
Create Date: 2025-09-08 00:00:00
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0002_booking_constraints'
down_revision = '0001_initial'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # qty must be > 0
    op.create_check_constraint('ck_bookings_qty_positive', 'bookings', 'qty > 0')
    # unique idempotency key when not null (Postgres partial unique index)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes WHERE indexname = 'uq_bookings_idem_nonnull'
            ) THEN
                CREATE UNIQUE INDEX uq_bookings_idem_nonnull
                ON bookings (idempotency_key)
                WHERE idempotency_key IS NOT NULL;
            END IF;
        END
        $$;
    """)

def downgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_indexes WHERE indexname = 'uq_bookings_idem_nonnull'
            ) THEN
                DROP INDEX uq_bookings_idem_nonnull;
            END IF;
        END
        $$;
    """)
    op.drop_constraint('ck_bookings_qty_positive', 'bookings', type_='check')
