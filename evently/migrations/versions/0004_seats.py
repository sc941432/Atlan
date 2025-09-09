from alembic import op
import sqlalchemy as sa

# Revision IDs
revision = "0005_seed_admin"
down_revision = "0004_seats"

# ---- helpers ---------------------------------------------------------------

def _hash_password(raw: str) -> str:
    """
    Try to use your app's hasher first, then fall back to passlib/bcrypt.
    This keeps the hash format consistent with your login flow.
    """
    # 1) Try your app's hasher (adjust import if needed)
    try:
        from app.core.security import get_password_hash  # common location
        return get_password_hash(raw)
    except Exception:
        pass
    try:
        from app.security import get_password_hash       # another common spot
        return get_password_hash(raw)
    except Exception:
        pass

    # 2) Fallback: passlib[bcrypt]
    try:
        from passlib.context import CryptContext
        ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        return ctx.hash(raw)
    except Exception:
        pass

    # 3) Fallback: python-bcrypt
    try:
        import bcrypt
        return bcrypt.hashpw(raw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    except Exception:
        raise RuntimeError(
            "No password hasher available. Ensure your app exposes get_password_hash "
            "or add passlib[bcrypt]/bcrypt to requirements."
        )

def _pick_password_column(columns: set[str]) -> str:
    for cand in ("password_hash", "hashed_password", "password", "password_digest"):
        if cand in columns:
            return cand
    raise RuntimeError("Could not find a password column on users table.")

def _role_update_fragment(cols: set[str]) -> tuple[str, dict]:
    """
    Returns (sql_fragment, params) to set admin role/flag depending on schema.
    - If 'role' exists, set role='admin'
    - elif 'is_admin' exists, set is_admin=true
    - else no-op
    """
    if "role" in cols:
        return "role = 'admin'", {}
    if "is_admin" in cols:
        return "is_admin = true", {}
    return "", {}

# ---- migration -------------------------------------------------------------

def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # Ensure users table exists
    if "users" not in insp.get_table_names():
        return

    meta = sa.MetaData()
    users = sa.Table("users", meta, autoload_with=bind)

    cols = set(c.name for c in users.columns)
    pwd_col = _pick_password_column(cols)
    role_set_sql, role_params = _role_update_fragment(cols)

    # Seed values (change if you want env-driven)
    name = "Sahil"
    email = "sahil@example.com"
    raw_password = "123456"
    hashed = _hash_password(raw_password)

    # Prepare column/value dict honoring existing columns only
    insert_values = { "email": email, pwd_col: hashed }
    if "name" in cols:
        insert_values["name"] = name
    if "role" in cols:
        insert_values["role"] = "admin"
    if "is_admin" in cols:
        insert_values["is_admin"] = True

    # Prefer a Postgres ON CONFLICT upsert on (email). If email is not unique,
    # this will throw; we fall back to SELECT/UPDATE/INSERT.
    params = insert_values | role_params

    def col_list(keys):         # e.g. "email, password_hash, role"
        return ", ".join(keys)
    def col_binds(keys):        # e.g. ":email, :password_hash, :role"
        return ", ".join(":"+k for k in keys)

    upsert_sql = f"""
    INSERT INTO users ({col_list(insert_values.keys())})
    VALUES ({col_binds(insert_values.keys())})
    ON CONFLICT (email) DO UPDATE SET
        {pwd_col} = EXCLUDED.{pwd_col}
        {("," + role_set_sql) if role_set_sql else ""}
    """
    try:
        bind.execute(sa.text(upsert_sql), params)
    except Exception:
        # Fallback: manual upsert without ON CONFLICT
        exists = bind.execute(
            sa.text("SELECT 1 FROM users WHERE email = :e"), {"e": email}
        ).first()
        if exists:
            # Update existing
            update_parts = [f"{pwd_col} = :p"]
            if role_set_sql:
                update_parts.append(role_set_sql)
            sql = f"UPDATE users SET {', '.join(update_parts)} WHERE email = :e"
            update_params = {"p": hashed, "e": email} | role_params
            bind.execute(sa.text(sql), update_params)
        else:
            # Insert new
            bind.execute(
                sa.text(
                    f"INSERT INTO users ({col_list(insert_values.keys())}) "
                    f"VALUES ({col_binds(insert_values.keys())})"
                ),
                insert_values,
            )

def downgrade():
    # Safe, reversible choice: remove only the seeded user.
    bind = op.get_bind()
    try:
        bind.execute(sa.text("DELETE FROM users WHERE email = :e"), {"e": "sahil@example.com"})
    except Exception:
        pass
