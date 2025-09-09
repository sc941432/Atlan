import json
import os
from typing import Any, Optional

_REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

_client = None
def _get_client():
    global _client
    if _client is not None:
        return _client
    try:
        import redis  # type: ignore
        _client = redis.Redis.from_url(_REDIS_URL, decode_responses=True)
        # Ping once; if it fails, treat as no cache
        try:
            _client.ping()
        except Exception:
            _client = None
    except Exception:
        _client = None
    return _client

def get_json(key: str) -> Optional[Any]:
    c = _get_client()
    if not c:
        return None
    try:
        val = c.get(key)
        return None if val is None else json.loads(val)
    except Exception:
        return None

def set_json(key: str, value: Any, ttl_seconds: int = 60) -> None:
    c = _get_client()
    if not c:
        return
    try:
        c.set(key, json.dumps(value, default=str), ex=ttl_seconds)
    except Exception:
        pass

def delete(key: str) -> None:
    c = _get_client()
    if not c:
        return
    try:
        c.delete(key)
    except Exception:
        pass

# convenient alias used by services/routes
safe_delete = delete
