import os
import json
import hmac
import hashlib
import sqlite3
import time
from urllib.parse import parse_qsl
from contextlib import closing

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

DB_PATH = os.getenv("DB_PATH", "jewels_jungle.sqlite3")
BOT_TOKEN = os.getenv("BOT_TOKEN", "")
OWNER_TELEGRAM_ID = os.getenv("OWNER_TELEGRAM_ID", "")

app = FastAPI(title="Jewels Jungle API")
origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "*").split(",") if x.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with closing(db()) as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS players (
            telegram_id TEXT PRIMARY KEY,
            username TEXT,
            first_name TEXT,
            first_seen INTEGER NOT NULL,
            last_seen INTEGER NOT NULL,
            launches INTEGER NOT NULL DEFAULT 0
        )""")
        conn.execute("""CREATE TABLE IF NOT EXISTS visits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id TEXT NOT NULL,
            visited_at INTEGER NOT NULL
        )""")
        conn.commit()

@app.on_event("startup")
def startup():
    init_db()

def verify_init_data(init_data: str):
    if not BOT_TOKEN:
        raise HTTPException(503, "BOT_TOKEN is not configured")
    if not init_data:
        raise HTTPException(401, "Telegram initData is required")
    try:
        pairs = dict(parse_qsl(init_data, keep_blank_values=True))
        received_hash = pairs.pop("hash", None)
        auth_date = int(pairs.get("auth_date", "0"))
        if not received_hash or int(time.time()) - auth_date > 86400 or auth_date > int(time.time()) + 60:
            raise ValueError("expired or missing hash")
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
        secret_key = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
        calculated = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(calculated, received_hash):
            raise ValueError("invalid signature")
        user = json.loads(pairs["user"])
        if not user.get("id"):
            raise ValueError("missing user id")
        return user
    except Exception:
        raise HTTPException(401, "Invalid Telegram initData")

class TrackPayload(BaseModel):
    initData: str

def record_visit(user):
    now = int(time.time())
    uid = str(user["id"])
    with closing(db()) as conn:
        conn.execute("""INSERT INTO players (telegram_id, username, first_name, first_seen, last_seen, launches)
            VALUES (?, ?, ?, ?, ?, 1)
            ON CONFLICT(telegram_id) DO UPDATE SET
              username=excluded.username, first_name=excluded.first_name,
              last_seen=excluded.last_seen, launches=players.launches+1""",
            (uid, user.get("username"), user.get("first_name"), now, now))
        conn.execute("INSERT INTO visits (telegram_id, visited_at) VALUES (?, ?)", (uid, now))
        conn.commit()

@app.get("/health")
def health():
    return {"ok": True, "service": "jewels-jungle"}

@app.post("/api/track/open")
def track_open(payload: TrackPayload):
    user = verify_init_data(payload.initData)
    record_visit(user)
    return {"ok": True}

@app.post("/api/track/heartbeat")
def heartbeat(payload: TrackPayload):
    user = verify_init_data(payload.initData)
    now = int(time.time())
    with closing(db()) as conn:
        conn.execute("UPDATE players SET last_seen=? WHERE telegram_id=?", (now, str(user["id"])))
        conn.commit()
    return {"ok": True}

@app.post("/api/admin/stats")
def admin_stats(payload: TrackPayload):
    user = verify_init_data(payload.initData)
    if not OWNER_TELEGRAM_ID or str(user["id"]) != str(OWNER_TELEGRAM_ID):
        raise HTTPException(403, "Owner access only")
    now = int(time.time())
    day_start = now - 86400
    with closing(db()) as conn:
        total = conn.execute("SELECT COUNT(*) n FROM players").fetchone()["n"]
        today = conn.execute("SELECT COUNT(DISTINCT telegram_id) n FROM visits WHERE visited_at >= ?", (day_start,)).fetchone()["n"]
        launches_today = conn.execute("SELECT COUNT(*) n FROM visits WHERE visited_at >= ?", (day_start,)).fetchone()["n"]
        online = conn.execute("SELECT COUNT(*) n FROM players WHERE last_seen >= ?", (now - 300,)).fetchone()["n"]
        returning = conn.execute("SELECT COUNT(*) n FROM players WHERE launches > 1").fetchone()["n"]
        recent = conn.execute("SELECT telegram_id, username, first_name, last_seen, launches FROM players ORDER BY last_seen DESC LIMIT 20").fetchall()
    return {
        "total_players": total, "unique_today": today, "launches_today": launches_today,
        "online_5m": online, "returning_players": returning,
        "recent_players": [dict(r) for r in recent],
        "generated_at": now
    }
