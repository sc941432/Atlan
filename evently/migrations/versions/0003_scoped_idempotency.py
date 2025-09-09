from alembic import op

revision = "0003_scoped_idempotency"
down_revision = "0002_booking_constraints"
branch_labels = None
depends_on = None

def upgrade():
    op.execute("DROP INDEX IF EXISTS uq_bookings_idem_nonnull;")
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_scoped_idem
        ON bookings (user_id, event_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL;
    """)

def downgrade():
    op.execute("DROP INDEX IF EXISTS uq_bookings_scoped_idem;")
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_idem_nonnull
        ON bookings (idempotency_key)
        WHERE idempotency_key IS NOT NULL;
    """)
