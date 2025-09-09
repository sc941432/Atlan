from pydantic import BaseModel
from typing import Optional

class SeatOut(BaseModel):
    id: int
    event_id: int
    label: str
    row_label: Optional[str] = None
    col_number: Optional[int] = None
    reserved: bool

    class Config:
        from_attributes = True
