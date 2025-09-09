from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.db import get_db
from app.api.deps import get_current_subject
from app.models.user import User
from app.schemas.user import UserOut
from app.schemas.admin_user import AdminCreateUser, AdminUpdateUserRole
from app.core.security import hash_password

router = APIRouter(prefix="/admin/users", tags=["admin"])

def require_admin(subject: str, db: Session) -> User:
    u = db.query(User).filter(User.id == int(subject)).first()
    if not u or u.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return u

@router.get("", response_model=list[UserOut])
def list_users(
    subject: str = Depends(get_current_subject),
    db: Session = Depends(get_db),
    role: Optional[str] = Query(None, pattern="^(user|admin)$"),
):
    require_admin(subject, db)
    qs = db.query(User)
    if role:
        qs = qs.filter(User.role == role)
    return qs.order_by(User.id.asc()).all()

@router.post("", response_model=UserOut, status_code=201)
def create_user_as_admin(
    payload: AdminCreateUser,
    subject: str = Depends(get_current_subject),
    db: Session = Depends(get_db),
):
    require_admin(subject, db)
    exists = db.query(User).filter(User.email == payload.email).first()
    if exists:
        raise HTTPException(status_code=400, detail="Email already registered")
    u = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u

@router.patch("/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: int,
    payload: AdminUpdateUserRole,
    subject: str = Depends(get_current_subject),
    db: Session = Depends(get_db),
):
    require_admin(subject, db)
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    u.role = payload.role
    db.commit()
    db.refresh(u)
    return u
