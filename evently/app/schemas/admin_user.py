# app/schemas/admin_user.py
from typing import Literal
from pydantic import BaseModel, EmailStr, Field

class AdminCreateUser(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Literal["user", "admin"] = "user"

class AdminUpdateUserRole(BaseModel):
    role: Literal["user", "admin"]
