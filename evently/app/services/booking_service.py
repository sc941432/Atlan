from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select
from fastapi import HTTPException, status
from app.core.cache import safe_delete

from app.models.event import Event
from app.models.booking import Booking
from app.models.seat import Seat


# ---------------- seat helpers ----------------

def _row_label_from_index(i: int) -> str:
    """0->A, 25->Z, 26->AA, ..."""
    s = ""
    while True:
        s = chr(ord("A") + (i % 26)) + s
        i = i // 26 - 1
        if i < 0:
            return s


def _seed_basic_grid(db: Session, event_id: int, capacity: int, per_row: int = 10) -> None:
    """
    Create seat rows A.. with <per_row> seats per row until 'capacity' seats exist.
    Idempotent: if seats already exist for the event, do nothing.
    Uses flush() so it stays in the same transaction as the caller.
    """
    if capacity <= 0:
        return
    if db.query(Seat.id).filter(Seat.event_id == event_id).first():
        return

    per_row = max(1, int(per_row))
    to_add = []
    row_idx, col = 0, 1

    for _ in range(capacity):
        row_label = _row_label_from_index(row_idx)
        label = f"{row_label}{col}"
        to_add.append(
            Seat(
                event_id=event_id,
                label=label,
                row_label=row_label,
                col_number=col,
                reserved=False,
                reserved_booking_id=None,
            )
        )
        col += 1
        if col > per_row:
            col = 1
            row_idx += 1

    db.bulk_save_objects(to_add)
    db.flush()


def _with_lock(query, db: Session):
    if db.bind and getattr(db.bind.dialect, "name", "") != "sqlite":
        return query.with_for_update()
    return query


def _has_seatmap(db: Session, event_id: int) -> bool:
    return db.query(Seat.id).filter(Seat.event_id == event_id).first() is not None


def _seat_labels_for_booking(db: Session, booking_id: int) -> List[str]:
    rows = (
        db.query(Seat.label)
        .filter(Seat.reserved_booking_id == booking_id)
        .order_by(Seat.row_label, Seat.col_number, Seat.label)
        .all()
    )
    return [r[0] for r in rows]


def _attach_seats_to_booking(db: Session, booking: Booking, seats: List[Seat]) -> None:
    for s in seats:
        s.reserved = True
        s.reserved_booking_id = booking.id


# ---------------- waitlist promotion ----------------

def _try_promote_waitlist(db: Session, event_id: int) -> None:
    """
    Promote WAITLISTED bookings into CONFIRMED while seats/capacity allow.
    For seat-mapped events, promotion requires a full set of seats for the waiter (FIFO).
    """
    q = db.query(Event).filter(Event.id == event_id)
    ev = _with_lock(q, db).first()
    if not ev or ev.status != "active":
        return

    if _has_seatmap(db, event_id):
        # Seat-map: only promote when we can assign a full set of seats to the next waiter
        while True:
            wl = (
                db.query(Booking)
                .filter(Booking.event_id == event_id, Booking.status == "WAITLISTED")
                .order_by(Booking.created_at.asc(), Booking.id.asc())
                .first()
            )
            if not wl:
                break

            avail = (
                _with_lock(
                    db.query(Seat).filter(Seat.event_id == event_id, Seat.reserved == False),
                    db
                )
                .order_by(Seat.row_label, Seat.col_number, Seat.label)
                .limit(wl.qty)
                .all()
            )
            if len(avail) < wl.qty:
                break  # not enough seats yet for this waiter

            wl.status = "CONFIRMED"
            _attach_seats_to_booking(db, wl, avail)
            ev.booked_count = (ev.booked_count or 0) + wl.qty
            db.commit()
    else:
        # Capacity-only flow
        free = ev.capacity - (ev.booked_count or 0)
        if free <= 0:
            return
        waiters = (
            db.query(Booking)
            .filter(Booking.event_id == event_id, Booking.status == "WAITLISTED")
            .order_by(Booking.created_at.asc(), Booking.id.asc())
            .all()
        )
        changed = False
        for w in waiters:
            if w.qty <= free:
                w.status = "CONFIRMED"
                ev.booked_count = (ev.booked_count or 0) + w.qty
                free -= w.qty
                changed = True
                if free <= 0:
                    break
        if changed:
            db.commit()

    safe_delete("analytics:summary")


# ---------------- create / cancel ----------------

def create_booking(
    db: Session,
    user_id: int,
    event_id: int,
    qty: int,
    idempotency_key: Optional[str],
    allow_waitlist: bool = False,
    seat_ids: Optional[List[int]] = None,
) -> Booking:
    # Idempotency (scoped to user+event)
    if idempotency_key:
        existing = db.execute(
            select(Booking).where(
                Booking.idempotency_key == idempotency_key,
                Booking.user_id == user_id,
                Booking.event_id == event_id,
            )
        ).scalars().first()
        if existing:
            # decorate with seat labels for response
            existing.seat_labels = _seat_labels_for_booking(db, existing.id)
            return existing

    # Load and validate event
    ev = _with_lock(db.query(Event).filter(Event.id == event_id), db).first()
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    if ev.status != "active":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Event not active")

    # If event has no seats yet, auto-seed a grid from its capacity (idempotent)
    if not _has_seatmap(db, ev.id) and (ev.capacity or 0) > 0:
        _seed_basic_grid(db, ev.id, ev.capacity, per_row=10)

    seatmap = _has_seatmap(db, event_id)

    # --- Seat-map flow ---
    if seatmap:
        # Only enforce qty==len(seat_ids) when seat_ids is provided and non-empty.
        if seat_ids is not None and len(seat_ids) > 0 and len(seat_ids) != qty:
            raise HTTPException(status_code=400, detail="qty must equal number of seat_ids")

        if seat_ids and len(seat_ids) > 0:
            # Explicit seat pick
            seats = _with_lock(
                db.query(Seat).filter(Seat.id.in_(seat_ids), Seat.event_id == event_id),
                db
            ).all()
            if len(seats) != len(seat_ids):
                raise HTTPException(status_code=404, detail="One or more seats not found")
            taken = [s.label for s in seats if s.reserved]
            if taken:
                if allow_waitlist:
                    bk = Booking(
                        user_id=user_id, event_id=event_id, qty=qty,
                        status="WAITLISTED", idempotency_key=idempotency_key,
                    )
                    db.add(bk); db.commit(); db.refresh(bk)
                    bk.seat_labels = []
                    safe_delete("analytics:summary")
                    return bk
                raise HTTPException(status_code=409, detail=f"Seat(s) not available: {', '.join(taken)}")
            chosen = seats
        else:
            # Auto-assign best available seats
            chosen = _with_lock(
                db.query(Seat).filter(Seat.event_id == event_id, Seat.reserved == False),
                db
            ).order_by(Seat.row_label, Seat.col_number, Seat.label).limit(qty).all()
            if len(chosen) < qty:
                if allow_waitlist:
                    bk = Booking(
                        user_id=user_id, event_id=event_id, qty=qty,
                        status="WAITLISTED", idempotency_key=idempotency_key,
                    )
                    db.add(bk); db.commit(); db.refresh(bk)
                    bk.seat_labels = []
                    safe_delete("analytics:summary")
                    return bk
                raise HTTPException(status_code=409, detail="Not enough seats available")

        # Create booking & reserve seats
        bk = Booking(
            user_id=user_id, event_id=event_id, qty=qty,
            status="CONFIRMED", idempotency_key=idempotency_key,
        )
        db.add(bk)
        db.flush()  # to have bk.id
        _attach_seats_to_booking(db, bk, chosen)
        ev.booked_count = (ev.booked_count or 0) + qty

        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            if idempotency_key:
                existing = db.execute(
                    select(Booking).where(
                        Booking.idempotency_key == idempotency_key,
                        Booking.user_id == user_id,
                        Booking.event_id == event_id,
                    )
                ).scalars().first()
                if existing:
                    existing.seat_labels = _seat_labels_for_booking(db, existing.id)
                    return existing
            raise

        db.refresh(bk)
        bk.seat_labels = [s.label for s in chosen]
        safe_delete("analytics:summary")
        return bk

    # --- Legacy capacity flow (no seat map) ---
    current = (ev.booked_count or 0)
    if current + qty > ev.capacity:
        if allow_waitlist:
            bk = Booking(
                user_id=user_id, event_id=event_id, qty=qty,
                status="WAITLISTED", idempotency_key=idempotency_key,
            )
            db.add(bk); db.commit(); db.refresh(bk)
            bk.seat_labels = []
            safe_delete("analytics:summary")
            return bk
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Capacity exceeded")

    bk = Booking(
        user_id=user_id, event_id=event_id, qty=qty,
        status="CONFIRMED", idempotency_key=idempotency_key,
    )
    db.add(bk)
    ev.booked_count = current + qty

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if idempotency_key:
            existing = db.execute(
                select(Booking).where(
                    Booking.idempotency_key == idempotency_key,
                    Booking.user_id == user_id,
                    Booking.event_id == event_id,
                )
            ).scalars().first()
            if existing:
                existing.seat_labels = _seat_labels_for_booking(db, existing.id)
                return existing
        raise

    db.refresh(bk)
    bk.seat_labels = []
    safe_delete("analytics:summary")
    return bk


def cancel_booking(db: Session, booking_id: int, user_id: int, is_admin: bool) -> Booking:
    bk = db.query(Booking).filter(Booking.id == booking_id).first()
    if not bk:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    if not is_admin and bk.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    ev = _with_lock(db.query(Event).filter(Event.id == bk.event_id), db).first()
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    if bk.status == "CONFIRMED":
        # Free seats if seat map exists
        if _has_seatmap(db, bk.event_id):
            seats = _with_lock(db.query(Seat).filter(Seat.reserved_booking_id == bk.id), db).all()
            for s in seats:
                s.reserved = False
                s.reserved_booking_id = None
        bk.status = "CANCELLED"
        ev.booked_count = max(0, (ev.booked_count or 0) - bk.qty)
        db.commit()
        db.refresh(bk)
        safe_delete("analytics:summary")
        # try promotions after freeing seats
        _try_promote_waitlist(db, bk.event_id)

    elif bk.status == "WAITLISTED":
        bk.status = "CANCELLED"
        db.commit()
        db.refresh(bk)
        safe_delete("analytics:summary")

    return bk
