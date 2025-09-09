from alembic import op
import sqlalchemy as sa

revision = "0004_seats"
down_revision = "0003_scoped_idempotency"

def upgrade():
    op.create_table(
        "seats",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_id", sa.Integer(), sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("label", sa.String(length=50), nullable=False),
        sa.Column("row_label", sa.String(length=10), nullable=True),
        sa.Column("col_number", sa.Integer(), nullable=True),
        sa.Column("reserved", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("reserved_booking_id", sa.Integer(), sa.ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_unique_constraint("uq_seats_event_label", "seats", ["event_id", "label"])
    op.create_index("ix_seats_event_reserved", "seats", ["event_id", "reserved"])

def downgrade():
    op.drop_index("ix_seats_event_reserved", table_name="seats")
    op.drop_constraint("uq_seats_event_label", "seats", type_="unique")
    op.drop_table("seats")
