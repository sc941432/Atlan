from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, UniqueConstraint, Index
from .base import Base

class Seat(Base):
    __tablename__ = "seats"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)

    # Display / layout
    label = Column(String(50), nullable=False)      # e.g. "A-1"
    row_label = Column(String(10), nullable=True)   # e.g. "A"
    col_number = Column(Integer, nullable=True)     # e.g. 1

    # Reservation state
    reserved = Column(Boolean, nullable=False, default=False)
    reserved_booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True)

    __table_args__ = (
        UniqueConstraint("event_id", "label", name="uq_seats_event_label"),
        Index("ix_seats_event_reserved", "event_id", "reserved"),
    )
