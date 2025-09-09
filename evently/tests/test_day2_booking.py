import os, tempfile, uuid, pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db import get_db
from app.models.base import Base
from app.models.user import User
from app.core.security import hash_password, create_access_token

@pytest.fixture(scope="session")
def test_db():
    fd, path = tempfile.mkstemp(prefix="evently_test_", suffix=".db")
    os.close(fd)
    url = f"sqlite:///{path}"
    engine = create_engine(url, future=True)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    try:
        yield (engine, TestingSessionLocal)
    finally:
        try: os.remove(path)
        except FileNotFoundError: pass

@pytest.fixture(autouse=True)
def override_db(test_db):
    engine, TestingSessionLocal = test_db
    def _get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()
    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides.clear()

def bootstrap_users(session):
    # normal user
    u1 = User(name="U1", email=f"u1_{uuid.uuid4().hex[:6]}@ex.com", password_hash=hash_password("pw"), role="user")
    # admin user
    a1 = User(name="A1", email=f"a1_{uuid.uuid4().hex[:6]}@ex.com", password_hash=hash_password("pw"), role="admin")
    session.add_all([u1,a1]); session.commit()
    session.refresh(u1); session.refresh(a1)
    return u1, a1, create_access_token(str(u1.id)), create_access_token(str(a1.id))

def test_booking_flow(test_db):
    _, TestingSessionLocal = test_db
    c = TestClient(app)

    # seed users
    with TestingSessionLocal() as s:
        user, admin, user_tok, admin_tok = bootstrap_users(s)

    # create event via admin
    r = c.post("/admin/events", headers={"Authorization": f"Bearer {admin_tok}"}, json={
        "name":"Tiny Show","venue":"Hall","start_time":"2030-01-01T19:00:00Z","end_time":"2030-01-01T22:00:00Z","capacity":2
    })
    assert r.status_code == 200, r.text
    eid = r.json()["id"]

    # book 1 with idempotency
    r1 = c.post(f"/events/{eid}/book", headers={"Authorization": f"Bearer {user_tok}", "Idempotency-Key":"abc-1"}, json={"qty":1})
    assert r1.status_code == 200, r1.text
    bid = r1.json()["id"]

    # repeat same idem -> same booking
    r2 = c.post(f"/events/{eid}/book", headers={"Authorization": f"Bearer {user_tok}", "Idempotency-Key":"abc-1"}, json={"qty":1})
    assert r2.status_code == 200
    assert r2.json()["id"] == bid

    # try exceed capacity (2 total) -> booking qty=2 should 409
    r3 = c.post(f"/events/{eid}/book", headers={"Authorization": f"Bearer {user_tok}"}, json={"qty":2})
    assert r3.status_code == 409

    # my bookings list
    r = c.get("/me/bookings", headers={"Authorization": f"Bearer {user_tok}"})
    assert r.status_code == 200 and len(r.json()) == 1

    # cancel
    r = c.delete(f"/bookings/{bid}", headers={"Authorization": f"Bearer {user_tok}"})
    assert r.status_code == 200 and r.json()["status"] == "CANCELLED"
