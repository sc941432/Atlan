from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List

from sqlalchemy.orm import Session
from sqlalchemy import func, select

from app.models.event import Event
from app.models.booking import Booking

def _utilization(booked: int, capacity: int) -> float:
    if not capacity:
        return 0.0
    return round(100.0 * float(booked) / float(capacity), 2)

def build_summary(db: Session) -> Dict[str, Any]:
    # Per-event rows
    events: List[Event] = db.query(Event).order_by(Event.start_time.asc()).all()
    rows = []
    total_capacity = 0
    total_booked = 0
    active_events = 0
    for ev in events:
        cap = ev.capacity or 0
        booked = ev.booked_count or 0
        total_capacity += cap
        total_booked += booked
        if ev.status == "active":
            active_events += 1
        rows.append({
            "id": ev.id,
            "name": ev.name,
            "venue": ev.venue,
            "start_time": ev.start_time,
            "end_time": ev.end_time,
            "capacity": cap,
            "booked_count": booked,
            "utilization_pct": _utilization(booked, cap),
            "status": ev.status,
        })

    # Top events by booked_count (limit 5)
    top_events = sorted(rows, key=lambda r: r["booked_count"], reverse=True)[:5]

    # 7-day timeseries (UTC)
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=6)  # inclusive window of 7 days
    # Postgres date_trunc; SQLite falls back to simple grouping on date string
    # Bookings created counts
    q_book = (
        db.query(func.date_trunc('day', Booking.created_at).label('day'), func.count().label('cnt'))
        .filter(Booking.created_at >= since)
        .filter(Booking.status == "CONFIRMED")
        .group_by(func.date_trunc('day', Booking.created_at))
        .order_by(func.date_trunc('day', Booking.created_at).asc())
    )
    # Cancellations counts (by the booking's created_at date window; alternatively use updated_at if you have it)
    q_cancel = (
        db.query(func.date_trunc('day', Booking.created_at).label('day'), func.count().label('cnt'))
        .filter(Booking.created_at >= since)
        .filter(Booking.status == "CANCELLED")
        .group_by(func.date_trunc('day', Booking.created_at))
        .order_by(func.date_trunc('day', Booking.created_at).asc())
    )

    # Execute and normalize to 7 buckets
    def normalize(rows_):
        m = { r[0].date().isoformat(): int(r[1]) for r in rows_ }
        out = []
        for i in range(7):
            d = (since + timedelta(days=i)).date().isoformat()
            out.append({"date": d, "count": m.get(d, 0)})
        return out

    book_rows = q_book.all()
    cancel_rows = q_cancel.all()

    summary = {
        "generated_at": now.isoformat(),
        "totals": {
            "events": len(events),
            "active_events": active_events,
            "capacity": total_capacity,
            "booked": total_booked,
            "utilization_pct": _utilization(total_booked, total_capacity),
        },
        "events": rows,
        "top_events": top_events,
        "timeseries_7d": {
            "bookings": normalize(book_rows),
            "cancellations": normalize(cancel_rows),
        },
    }
    return summary
