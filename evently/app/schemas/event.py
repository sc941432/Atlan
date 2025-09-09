# app/schemas/event.py
from __future__ import annotations
from datetime import datetime
from typing import List, Optional, Literal
from pydantic import BaseModel, Field, ConfigDict

# ----- Requests -----

class EventCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    venue: str = Field(..., min_length=1, max_length=200)
    start_time: datetime
    end_time: datetime
    capacity: int = Field(..., ge=1)

class EventUpdate(BaseModel):
    # All fields optional for PATCH
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    venue: Optional[str] = Field(None, min_length=1, max_length=200)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    capacity: Optional[int] = Field(None, ge=1)
    status: Optional[Literal["active", "inactive"]] = None

# ----- Responses -----

class EventOut(BaseModel):
    id: int
    name: str
    venue: str
    start_time: datetime
    end_time: datetime
    capacity: int
    booked_count: int
    status: str
    waitlisted_count: int = 0   # <— add
    model_config = ConfigDict(from_attributes=True)

# (Optional for list endpoint)
class EventListMeta(BaseModel):
    page: int
    page_size: int
    total: int

class EventListResponse(BaseModel):
    items: List[EventOut]
    meta: EventListMeta
