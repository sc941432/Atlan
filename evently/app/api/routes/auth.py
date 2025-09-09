from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserOut
from app.schemas.auth import Token
from app.core.security import hash_password, verify_password, create_access_token
from app.core.limiter import limiter  # rate limiting

router = APIRouter()

@router.post("/signup", response_model=UserOut)
# Optional: @limiter.limit("30/minute")  # if you enable, add "request: Request" to the signature
def signup(payload: UserCreate, db: Session = Depends(get_db)):
    exists = db.query(User).filter(User.email == payload.email).first()
    if exists:
        raise HTTPException(status_code=400, detail="Email already registered")
    u = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role="user",
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u

@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
def login(payload: UserLogin, request: Request, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.email == payload.email).first()
    if not u or not verify_password(payload.password, u.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    token = create_access_token(str(u.id))
    return Token(access_token=token)
