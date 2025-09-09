# app/api/routes/events.py
from __future__ import annotations
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.event import Event
from app.models.booking import Booking            # <-- NEW (for waitlist counts)
from app.models.seat import Seat
from app.schemas.event import EventOut, EventListResponse
from app.schemas.seat import SeatOut

router = APIRouter()

@router.get("", response_model=EventListResponse, name="list_events")  # final path: /events
def list_events(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    q: Optional[str] = Query(None, description="search in name/venue"),
    venue: Optional[str] = None,
    status: Optional[str] = Query(None, pattern="^(active|inactive)$"),
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    sort: str = Query("start_time", pattern="^(name|start_time|utilization)$"),
    order: str = Query("asc", pattern="^(asc|desc)$"),
):
    qs = db.query(Event)

    if q:
        ilike = f"%{q.lower()}%"
        qs = qs.filter(
            func.lower(Event.name).like(ilike) |
            func.lower(Event.venue).like(ilike)
        )
    if venue:
        qs = qs.filter(Event.venue == venue)
    if status:
        qs = qs.filter(Event.status == status)
    if date_from:
        qs = qs.filter(Event.start_time >= date_from)
    if date_to:
        qs = qs.filter(Event.start_time <= date_to)

    total = qs.count()

    # sorting
    if sort == "name":
        crit = Event.name
    elif sort == "utilization":
        crit = (Event.booked_count * 1.0) / func.nullif(Event.capacity, 0)
    else:
        crit = Event.start_time
    if order == "desc":
        crit = crit.desc()

    items = qs.order_by(crit).offset((page - 1) * page_size).limit(page_size).all()

    # ---- NEW: attach waitlisted_count for each event (for admin UI) ----
    event_ids = [e.id for e in items]
    if event_ids:
        rows = (
            db.query(Booking.event_id, func.count().label("cnt"))
              .filter(Booking.status == "WAITLISTED", Booking.event_id.in_(event_ids))
              .group_by(Booking.event_id)
              .all()
        )
        wl_map = {eid: cnt for (eid, cnt) in rows}
    else:
        wl_map = {}

    for e in items:
        # dynamic attr used by EventOut.waitlisted_count
        setattr(e, "waitlisted_count", wl_map.get(e.id, 0))

    return {
        "items": items,
        "meta": {"page": page, "page_size": page_size, "total": total},
    }

@router.get("/{event_id}", response_model=EventOut)  # final path: /events/{event_id}
def get_event(event_id: int, db: Session = Depends(get_db)):
    e = db.query(Event).filter(Event.id == event_id).first()
    if not e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    # ---- NEW: single-event waitlist count ----
    wl = (
        db.query(func.count())
          .select_from(Booking)
          .filter(Booking.event_id == event_id, Booking.status == "WAITLISTED")
          .scalar()
        or 0
    )
    setattr(e, "waitlisted_count", wl)

    return e

@router.get("/{event_id}/seats", response_model=list[SeatOut])
def list_event_seats(event_id: int, db: Session = Depends(get_db)):
    seats = (
        db.query(Seat)
        .filter(Seat.event_id == event_id)
        .order_by(Seat.row_label, Seat.col_number, Seat.label)
        .all()
    )
    return seats
