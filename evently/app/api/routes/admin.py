# app/api/routes/admin.py
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.services.booking_service import _try_promote_waitlist  # <--- ADD

from app.db import get_db
from app.models.user import User
from app.models.event import Event
from app.models.booking import Booking
from app.schemas.event import EventCreate, EventOut, EventUpdate
from app.api.deps import get_current_subject
from app.core.cache import safe_delete
from app.core.limiter import limiter
from app.models.seat import Seat


router = APIRouter()

def require_admin(user_id: str, db: Session):
    u = db.query(User).filter(User.id == int(user_id)).first()
    if not u or u.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return u

@router.post("/events", response_model=EventOut)
@limiter.limit("20/minute")
def create_event(
    payload: EventCreate,
    request: Request,
    subject: str = Depends(get_current_subject),
    db: Session = Depends(get_db),
):
    require_admin(subject, db)
    e = Event(
        name=payload.name,
        venue=payload.venue,
        start_time=payload.start_time,
        end_time=payload.end_time,
        capacity=payload.capacity,
        booked_count=0,
        status="active",
        created_by=int(subject),
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    safe_delete("analytics:summary")
    return e

@router.patch("/events/{event_id}", response_model=EventOut)
@limiter.limit("30/minute")
def update_event(
    event_id: int,
    payload: EventUpdate,
    request: Request,
    subject: str = Depends(get_current_subject),
    db: Session = Depends(get_db),
):
    require_admin(subject, db)
    e = db.query(Event).filter(Event.id == event_id).first()
    if not e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    # Apply changes if provided
    if payload.name is not None:
        e.name = payload.name
    if payload.venue is not None:
        e.venue = payload.venue
    if payload.start_time is not None:
        e.start_time = payload.start_time
    if payload.end_time is not None:
        e.end_time = payload.end_time
    capacity_changed = False
    if payload.capacity is not None:
        if (e.booked_count or 0) > payload.capacity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"capacity {payload.capacity} < booked_count {e.booked_count}",
            )
        e.capacity = payload.capacity
        capacity_changed = True
    if payload.status is not None:
        if payload.status not in ("active", "inactive"):
            raise HTTPException(status_code=400, detail="Invalid status")
        e.status = payload.status

    db.commit()
    db.refresh(e)

    # ⬇️ NEW: sync seats to capacity when capacity was patched
    if capacity_changed:
        _sync_seats_to_capacity(db, e)

    safe_delete("analytics:summary")
    _try_promote_waitlist(db, e.id)
    return e


@router.post("/events/{event_id}/deactivate", response_model=EventOut)
@limiter.limit("30/minute")
def deactivate_event(
    event_id: int,
    request: Request,
    subject: str = Depends(get_current_subject),
    db: Session = Depends(get_db),
):
    require_admin(subject, db)
    e = db.query(Event).filter(Event.id == event_id).first()
    if not e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    if e.status != "inactive":
        e.status = "inactive"
        db.commit()
        db.refresh(e)
        safe_delete("analytics:summary")
    return e

@router.delete("/events/{event_id}", status_code=204)
@limiter.limit("10/minute")
def delete_event(
    event_id: int,
    request: Request,
    subject: str = Depends(get_current_subject),
    db: Session = Depends(get_db),
):
    require_admin(subject, db)
    e = db.query(Event).filter(Event.id == event_id).first()
    if not e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    # For safety: only allow delete if no bookings remain (any status)
    has_bookings = db.query(Booking.id).filter(Booking.event_id == event_id).first()
    if has_bookings:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete event with existing bookings; deactivate instead",
        )

    db.delete(e)
    db.commit()
    safe_delete("analytics:summary")
    return


from pydantic import BaseModel, Field
from app.models.seat import Seat

class SeatGridIn(BaseModel):
    rows: int = Field(..., ge=1, le=26)   # A..Z
    cols: int = Field(..., ge=1, le=200)  # 1..200

@router.post("/events/{event_id}/seats/generate")
@limiter.limit("10/minute")
def generate_seats(
    event_id: int,
    payload: SeatGridIn,
    request: Request,
    subject: str = Depends(get_current_subject),
    db: Session = Depends(get_db),
):
    require_admin(subject, db)
    e = db.query(Event).filter(Event.id == event_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Event not found")

    # don't regenerate if exists
    if db.query(Seat.id).filter(Seat.event_id == event_id).first():
        raise HTTPException(status_code=409, detail="Seats already exist for this event")

    seats = []
    for i in range(payload.rows):
        row_label = chr(ord("A") + i)
        for c in range(1, payload.cols + 1):
            seats.append(Seat(event_id=event_id, row_label=row_label, col_number=c, label=f"{row_label}-{c}"))
    db.bulk_save_objects(seats)

    # sync capacity with seats count
    e.capacity = payload.rows * payload.cols
    db.commit()
    safe_delete("analytics:summary")
    return {"created": len(seats), "capacity": e.capacity}

def _label_for_index(idx: int) -> tuple[str, int, str]:
    """
    1-indexed idx → (row_label, col_number, label).
    Uses 50 seats per row: A-1..A-50, B-1..B-50, ...
    """
    if idx <= 0:
        raise ValueError("idx must be >= 1")
    row_idx = (idx - 1) // 50          # 0-based row
    col = (idx - 1) % 50 + 1           # 1..50
    if row_idx > 25:                   # A..Z only
        # fall back to extra 'Z' rows if capacity > 26*50; still deterministic
        row_idx = 25
    row_label = chr(ord("A") + row_idx)
    return row_label, col, f"{row_label}-{col}"

def _sync_seats_to_capacity(db: Session, e: Event) -> None:
    """
    Ensure seats table count matches e.capacity:
      - If none exist: create exactly capacity seats.
      - If fewer exist: append more seats with deterministic labels.
      - If more exist: delete unreserved seats from the 'end' until it matches.
        If not enough unreserved seats, 409.
    """
    current = db.query(Seat).filter(Seat.event_id == e.id).count()
    target = e.capacity or 0
    if current == target:
        return

    if current == 0 and target > 0:
        # Create 1..target seats
        seats = []
        for i in range(1, target + 1):
            row_label, col, label = _label_for_index(i)
            seats.append(Seat(event_id=e.id, row_label=row_label, col_number=col, label=label))
        db.bulk_save_objects(seats)
        db.commit()
        return

    if current < target:
        # Append (target - current) seats
        seats = []
        for i in range(current + 1, target + 1):
            row_label, col, label = _label_for_index(i)
            seats.append(Seat(event_id=e.id, row_label=row_label, col_number=col, label=label))
        db.bulk_save_objects(seats)
        db.commit()
        return

    # current > target → try to delete extra unreserved seats from the tail
    extra = current - target
    tail = (
        db.query(Seat)
        .filter(Seat.event_id == e.id, Seat.reserved == False)
        .order_by(Seat.row_label.desc(), Seat.col_number.desc(), Seat.id.desc())
        .limit(extra)
        .all()
    )
    if len(tail) < extra:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Not enough free seats to shrink to new capacity; cancel some bookings first",
        )
    for s in tail:
        db.delete(s)
    db.commit()
