from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.api.deps import get_current_subject
from app.models.user import User
from app.core import cache
from app.services.analytics_service import build_summary

router = APIRouter(prefix="/admin/analytics", tags=["admin", "analytics"])

def _get_admin(db: Session, subject: str) -> User:
    u = db.query(User).filter(User.id == int(subject)).first()
    if not u:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown user")
    if u.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin required")
    return u

@router.get("/summary")
def analytics_summary(
    refresh: bool = Query(default=False, description="Force bypass cache"),
    subject: str = Depends(get_current_subject),
    db: Session = Depends(get_db),
):
    _get_admin(db, subject)
    key = "analytics:summary"
    if not refresh:
        cached = cache.get_json(key)
        if cached is not None:
            return cached
    data = build_summary(db)
    cache.set_json(key, data, ttl_seconds=60)  # adjust TTL as needed
    return data
