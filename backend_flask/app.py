import os
import re
import secrets
from datetime import datetime, timedelta, date, time
from decimal import Decimal
import bcrypt
from flask import Flask, jsonify, request, send_from_directory, redirect, abort, session
from dotenv import load_dotenv
from db import get_conn

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, '..', 'frontend_web'))
app = Flask(__name__)

app.secret_key = os.getenv('SECRET_KEY') or secrets.token_hex(32)
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=(os.getenv('SESSION_COOKIE_SECURE', '0').strip() == '1'),
)

def _new_public_token() -> str:
    return secrets.token_hex(16)

def _ensure_public_token(conn, reservation_id: int) -> str:
    with conn.cursor() as cur:
        cur.execute("SELECT publicToken FROM reservations WHERE id=%s", (reservation_id,))
        row = cur.fetchone() or {}
        tok = (row.get("publicToken") or "").strip()
        if tok:
            return tok

        tok = _new_public_token()
        for _ in range(5):
            try:
                cur.execute("UPDATE reservations SET publicToken=%s WHERE id=%s", (tok, reservation_id))
                conn.commit()
                return tok
            except Exception:
                tok = _new_public_token()
        return tok

def _fmt_hhmm(v):
    if v is None:
        return None
    if isinstance(v, timedelta):
        total = int(v.total_seconds())
        h = (total // 3600) % 24
        m = (total % 3600) // 60
        return f"{h:02d}:{m:02d}"
    if isinstance(v, time):
        return f"{v.hour:02d}:{v.minute:02d}"
    s = str(v)
    if len(s) >= 5:
        return s[:5]
    return s

def _auto_complete_reservations(cur):
    try:
        now = datetime.now()
        today = now.date()
        now_hhmm = now.strftime("%H:%M")
        cur.execute(
            """
            UPDATE reservations
            SET status='completed'
            WHERE LOWER(status)='accepted'
              AND (
                    date < %s
                    OR (date = %s AND STR_TO_DATE(SUBSTRING(time,1,5),'%H:%i') < STR_TO_DATE(%s,'%H:%i'))
                  )
            """,
            (today, today, now_hhmm),
        )
    except Exception:
        pass

def _jsonable(obj):
    if obj is None or isinstance(obj, (str, int, float, bool)):
        return obj

    if isinstance(obj, Decimal):
        return float(obj)

    if isinstance(obj, (timedelta, time)):
        return _fmt_hhmm(obj)

    if isinstance(obj, datetime):
        return obj.strftime('%Y-%m-%d %H:%M:%S')

    if isinstance(obj, date):
        return obj.strftime('%Y-%m-%d')

    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if k in ('opening_time', 'closing_time', 'time'):
                out[k] = _fmt_hhmm(v)
            else:
                out[k] = _jsonable(v)
        return out

    if isinstance(obj, (list, tuple)):
        return [_jsonable(x) for x in obj]

    return str(obj)

def jsonify_safe(payload, status=200):
    return jsonify(_jsonable(payload)), status

def get_json():
    return request.get_json(silent=True) or {}

def require_user():
    uid = session.get("user_id")
    if not uid:
        return None, (jsonify({"error": "Nem vagy bejelentkezve."}), 401)

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, role, name, email FROM users WHERE id=%s", (int(uid),))
            u = cur.fetchone()
            if not u:
                session.clear()
                return None, (jsonify({"error": "Nem vagy bejelentkezve."}), 401)
            return u, None
    finally:
        conn.close()

def require_admin():
    u, err = require_user()
    if err:
        return None, err
    if (u.get("role") or "").lower() != "admin":
        return None, (jsonify({"error": "Nincs admin jogosultság"}), 403)
    return u, None

def _time_to_minutes(t) -> int:
    if t is None:
        return -1

    if isinstance(t, timedelta):
        total = int(t.total_seconds())
        h = (total // 3600) % 24
        m = (total % 3600) // 60
        return h * 60 + m

    if isinstance(t, time):
        return t.hour * 60 + t.minute

    s = str(t).strip()
    try:
        dt = datetime.strptime(s, '%H:%M')
        return dt.hour * 60 + dt.minute
    except Exception:
        pass

    try:
        dt = datetime.strptime(s, '%H:%M:%S')
        return dt.hour * 60 + dt.minute
    except Exception:
        return -1

def _round_up_to_slot(mins: int, slot: int = 30) -> int:
    if mins < 0:
        return mins
    return ((mins + slot - 1) // slot) * slot

def _mins_to_hhmm(mins: int) -> str:
    h = (mins // 60) % 24
    m = mins % 60
    return f"{h:02d}:{m:02d}"

def _build_time_slots(open_min: int, close_min: int, slot: int = 30):
    if open_min < 0 or close_min < 0 or close_min <= open_min:
        return []
    start = _round_up_to_slot(open_min, slot)
    out = []
    t = start
    while t < close_min:
        out.append(_mins_to_hhmm(t))
        t += slot
    return out

def _weekday_token(date_iso: str) -> str:
    try:
        d = datetime.strptime(date_iso, "%Y-%m-%d").date()
        wd = d.weekday()
        return ["H", "K", "Sze", "Cs", "P", "Szo", "V"][wd]
    except Exception:
        return ""

def _expand_days(day_part: str):
    s = day_part.strip()
    s = s.replace(" ", "")
    s = s.replace("—", "–").replace("-", "–")
    tokens = ["H", "K", "Sze", "Cs", "P", "Szo", "V"]
    if "–" not in s:
        return [s] if s in tokens else []
    a, b = s.split("–", 1)
    if a not in tokens or b not in tokens:
        return []
    ai, bi = tokens.index(a), tokens.index(b)
    if ai <= bi:
        return tokens[ai: bi + 1]
    return tokens[ai:] + tokens[: bi + 1]

def parse_opening_hours(opening_str: str, date_iso: str):
    if not opening_str:
        return None, None

    day_token = _weekday_token(date_iso)
    if not day_token:
        return None, None

    parts = [p.strip() for p in opening_str.split("•") if p.strip()]
    for p in parts:
        m = re.match(r"^([^:]+):\s*([0-9]{1,2}:[0-9]{2})\s*[–-]\s*([0-9]{1,2}:[0-9]{2})$", p)
        if not m:
            continue
        days_raw, open_t, close_t = m.group(1).strip(), m.group(2), m.group(3)
        days = _expand_days(days_raw)
        if day_token in days:
            return open_t, close_t

    m2 = re.search(r"([0-9]{1,2}:[0-9]{2})\s*[–-]\s*([0-9]{1,2}:[0-9]{2})", opening_str)
    if m2:
        return m2.group(1), m2.group(2)
    return None, None

@app.get("/api/health")
def health():
    return jsonify({"ok": True, "service": "smarttable-flask"}), 200

@app.post("/api/auth/register")
def register():
    data = get_json()
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or not email or not password:
        return jsonify({"error": "Hiányzó adatok"}), 400

    pw_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE email=%s", (email,))
            exists = cur.fetchone()
            if exists:
                return jsonify({"error": "Ezzel az email címmel már létezik felhasználó"}), 400

            cur.execute(
                "INSERT INTO users (name, email, password_hash, role) VALUES (%s, %s, %s, 'user')",
                (name, email, pw_hash),
            )
            conn.commit()
            user_id = int(cur.lastrowid)

            session.clear()
            session["user_id"] = user_id
            session["role"] = "user"
            session["name"] = name
            session["email"] = email

            return jsonify({"id": user_id, "name": name, "email": email, "role": "user"}), 201
    finally:
        conn.close()

@app.post("/api/auth/login")
def login():
    data = get_json()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Hiányzó email vagy jelszó"}), 400

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, email, password_hash, role FROM users WHERE email=%s",
                (email,)
            )
            user = cur.fetchone()

            if not user:
                return jsonify({"error": "Hibás email vagy jelszó"}), 400

            ok = bcrypt.checkpw(password.encode("utf-8"), user["password_hash"].encode("utf-8"))
            if not ok:
                return jsonify({"error": "Hibás email vagy jelszó"}), 400

            session.clear()
            session['user_id'] = int(user['id'])
            session['role'] = user['role']
            session['name'] = user['name']
            session['email'] = user['email']

            return jsonify({
                'id': user['id'],
                'name': user['name'],
                'email': user['email'],
                'role': user['role']
            }), 200
    finally:
        conn.close()

@app.post("/api/auth/logout")
def logout_api():
    session.clear()
    return jsonify({"ok": True}), 200

@app.get("/api/auth/me")
def me():
    u, err = require_user()
    if err:
        return err
    return jsonify({"id": u["id"], "name": u.get("name"), "email": u.get("email"), "role": u.get("role")}), 200

@app.get("/api/restaurants")
def get_restaurants():
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    r.*,
                    IFNULL(AVG(rv.rating), 0) AS avgRating,
                    COUNT(DISTINCT rv.id) AS reviewCount,
                    COUNT(DISTINCT res.id) AS reservationCount
                FROM restaurants r
                LEFT JOIN reviews rv ON rv.restaurantId = r.id
                LEFT JOIN reservations res ON res.restaurantId = r.id
                GROUP BY r.id
                ORDER BY r.id DESC
                """
            )
            rows = cur.fetchall()
            return jsonify_safe(rows, 200)
    finally:
        conn.close()

@app.get("/api/restaurants/popular")
def get_popular_restaurants():
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    r.*,
                    IFNULL(AVG(rv.rating), 0) AS avgRating,
                    COUNT(DISTINCT rv.id) AS reviewCount,
                    COUNT(DISTINCT res.id) AS reservationCount
                FROM restaurants r
                LEFT JOIN reviews rv ON rv.restaurantId = r.id
                LEFT JOIN reservations res ON res.restaurantId = r.id
                GROUP BY r.id
                ORDER BY reservationCount DESC, avgRating DESC, reviewCount DESC
                LIMIT 8
                """
            )
            rows = cur.fetchall()
            return jsonify_safe(rows, 200)
    finally:
        conn.close()

@app.get("/api/restaurants/top")
def get_top_restaurants():
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    r.*,
                    IFNULL(AVG(rv.rating), 0) AS avgRating,
                    COUNT(DISTINCT rv.id) AS reviewCount,
                    COUNT(DISTINCT res.id) AS reservationCount
                FROM restaurants r
                LEFT JOIN reviews rv ON rv.restaurantId = r.id
                LEFT JOIN reservations res ON res.restaurantId = r.id
                GROUP BY r.id
                ORDER BY avgRating DESC, reviewCount DESC, reservationCount DESC, r.id ASC
                LIMIT 4
                """
            )
            rows = cur.fetchall()
            return jsonify_safe(rows, 200)
    finally:
        conn.close()

@app.get("/api/restaurants/<int:rid>")
def get_restaurant(rid):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    r.*,
                    IFNULL(AVG(rv.rating), 0) AS avgRating,
                    COUNT(DISTINCT rv.id) AS reviewCount,
                    COUNT(DISTINCT res.id) AS reservationCount
                FROM restaurants r
                LEFT JOIN reviews rv ON rv.restaurantId = r.id
                LEFT JOIN reservations res ON res.restaurantId = r.id
                WHERE r.id=%s
                GROUP BY r.id
                """,
                (rid,),
            )
            row = cur.fetchone()
            if not row:
                return jsonify({"error": "Nincs ilyen étterem"}), 404
            return jsonify_safe(row, 200)
    finally:
        conn.close()

@app.get("/api/restaurants/<int:rid>/time-slots")
def get_restaurant_time_slots(rid):
    date_str = (request.args.get("date") or "").strip()
    pc_raw = (request.args.get("peopleCount") or "1").strip()
    exclude_id = (request.args.get("excludeReservationId") or "").strip()

    if not date_str:
        return jsonify({"error": "Hiányzó dátum (date)."}), 400

    try:
        d_req = datetime.strptime(date_str, "%Y-%m-%d").date()
    except Exception:
        return jsonify({"error": "Hibás dátum formátum. Használd: YYYY-MM-DD"}), 400

    try:
        pc = int(pc_raw)
    except Exception:
        pc = 1
    if pc < 1:
        pc = 1

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT opening_time, closing_time, capacity FROM restaurants WHERE id=%s", (rid,))
            r = cur.fetchone()
            if not r:
                return jsonify({"error": "Nincs ilyen étterem"}), 404

            open_t = r.get("opening_time")
            close_t = r.get("closing_time")
            capacity = int(r.get("capacity") or 40)

            o_min = _time_to_minutes(str(open_t))
            c_min = _time_to_minutes(str(close_t))
            slots = _build_time_slots(o_min, c_min, 30)

            params = [rid, date_str]
            where_extra = ""
            if exclude_id.isdigit():
                where_extra = " AND id<>%s "
                params.append(int(exclude_id))

            cur.execute(
                f"""
                SELECT time, IFNULL(SUM(peopleCount), 0) AS booked
                FROM reservations
                WHERE restaurantId=%s AND date=%s AND status IN ('pending','accepted')
                {where_extra}
                GROUP BY time
                """,
                tuple(params),
            )
            booked_rows = cur.fetchall() or []
            booked_map = {str(row.get('time')): int(row.get('booked') or 0) for row in booked_rows}

            out_slots = []
            for t in slots:
                booked = int(booked_map.get(t, 0))
                remaining = max(0, capacity - booked)
                out_slots.append({"time": t, "available": remaining >= pc, "remaining": remaining})

            return jsonify_safe({
                "restaurantId": rid,
                "date": date_str,
                "openingTime": open_t,
                "closingTime": close_t,
                "capacity": capacity,
                "slotMinutes": 30,
                "peopleCount": pc,
                "slots": out_slots,
            }, 200)
    finally:
        conn.close()

@app.get("/api/restaurants/<int:rid>/menu")
def get_restaurant_menu(rid):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, restaurantId, category, name, description, priceHuf FROM menu_items WHERE restaurantId=%s ORDER BY category, name",
                (rid,)
            )
            items = cur.fetchall()
            return jsonify_safe(items, 200)
    finally:
        conn.close()

@app.get("/api/restaurants/<int:rid>/deals")
def get_restaurant_deals(rid):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, restaurantId, name, description, originalPriceHuf, dealPriceHuf
                FROM hot_deals
                WHERE restaurantId=%s
                ORDER BY id DESC
                """,
                (rid,),
            )
            rows = cur.fetchall()
            return jsonify_safe(rows, 200)
    finally:
        conn.close()

@app.get("/api/restaurants/<int:rid>/reviews")
def get_restaurant_reviews(rid):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    rv.id,
                    rv.restaurantId,
                    rv.userId,
                    rv.rating,
                    rv.comment,
                    DATE_FORMAT(rv.createdAt, '%%Y-%%m-%%d %%H:%%i') AS createdAt,
                    u.name AS userName,

                    rr.id AS responseId,
                    rr.responseText AS responseText,
                    DATE_FORMAT(rr.createdAt, '%%Y-%%m-%%d %%H:%%i') AS responseCreatedAt
                FROM reviews rv
                JOIN users u ON u.id = rv.userId
                LEFT JOIN review_responses rr ON rr.reviewId = rv.id
                WHERE rv.restaurantId=%s
                ORDER BY rv.id DESC
                LIMIT 200
                """,
                (rid,),
            )
            rows = cur.fetchall()
            return jsonify_safe(rows, 200)
    finally:
        conn.close()
