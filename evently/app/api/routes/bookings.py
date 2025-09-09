# app/api/routes/bookings.py
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.api.deps import get_current_subject
from app.models.user import User
from app.models.booking import Booking
from app.schemas.booking import BookingCreate, BookingOut
from app.services.booking_service import create_booking, cancel_booking
from app.core.limiter import limiter  # rate limiting

# ✅ define router BEFORE using it in decorators
router = APIRouter()

def _get_user(db: Session, subject: str) -> User:
    u = db.query(User).filter(User.id == int(subject)).first()
    if not u:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown user")
    return u

@router.post("/events/{event_id}/book", response_model=BookingOut)
@limiter.limit("10/minute")  # SlowAPI requires the request arg in the function
def book_event(
    event_id: int,
    payload: BookingCreate,
    request: Request,
    subject: str = Depends(get_current_subject),
    db: Session = Depends(get_db),
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
):
    u = _get_user(db, subject)
    bk = create_booking(
        db,
        user_id=u.id,
        event_id=event_id,
        qty=payload.qty,
        idempotency_key=idempotency_key,
        allow_waitlist=payload.waitlist,  # supports waitlist
        seat_ids=payload.seat_ids,  
    )
    return bk

@router.delete("/bookings/{booking_id}", response_model=BookingOut)
def cancel(
    booking_id: int,
    subject: str = Depends(get_current_subject),
    db: Session = Depends(get_db),
):
    u = _get_user(db, subject)
    is_admin = (u.role == "admin")
    bk = cancel_booking(db, booking_id=booking_id, user_id=u.id, is_admin=is_admin)
    return bk

@router.get("/me/bookings", response_model=list[BookingOut])
def my_bookings(subject: str = Depends(get_current_subject), db: Session = Depends(get_db)):
    u = _get_user(db, subject)
    rows = (
        db.query(Booking)
        .filter(Booking.user_id == u.id)
        .order_by(Booking.created_at.desc())
        .all()
    )
    return rows
