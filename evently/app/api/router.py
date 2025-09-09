# app/api/router.py
from fastapi import APIRouter
from .routes import auth, events, admin, bookings, analytics, auth_me, admin_users

api_router = APIRouter()

# /auth/*
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])

api_router.include_router(auth_me.router, prefix="/auth", tags=["auth"])   

# /events/*  (events routes use "/" and "/{id}" internally)
api_router.include_router(events.router, prefix="/events", tags=["events"])

# bookings defines absolute paths like:
#   /events/{id}/book, /bookings/{id}, /me/bookings
api_router.include_router(bookings.router, tags=["bookings"])

# /admin/*
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])

# /admin/analytics/*
api_router.include_router(analytics.router, tags=["analytics"])
api_router.include_router(admin_users.router, tags=["admin"]) 
