from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List  # <-- add

class BookingCreate(BaseModel):
    qty: int = Field(..., gt=0)
    waitlist: bool = False
    seat_ids: Optional[List[int]] = None   # <-- add (let users pick exact seats)

class BookingOut(BaseModel):
    id: int
    user_id: int
    event_id: int
    qty: int
    status: str
    created_at: datetime
    seat_labels: Optional[List[str]] = None   # <-- add (what seats were assigned)

    class Config:
        from_attributes = True
