# Ez a modul kezeli a SmartTable Flask API végpontjait és a frontend kiszolgálását.
import os
import re
import secrets
from datetime import datetime, timedelta, date, time
from decimal import Decimal
import bcrypt
from flask import Flask, jsonify, request, send_from_directory, redirect, abort, session
from dotenv import load_dotenv
from db import get_conn, init_db

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

init_db()

# Új publikus azonosítót generál a foglalások külső hivatkozásához.
def _new_public_token() -> str:
    return secrets.token_hex(16)

# Biztosítja, hogy a foglalás rendelkezzen egyedi publikus tokennel.
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

# Egységes HH:MM formátumra alakítja az időértékeket.
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

# A lejárt elfogadott foglalásokat automatikusan teljesítettre állítja.
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

# JSON-kompatibilis formára alakítja az adatbázisból kapott értékeket.
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

# Biztonságosan JSON választ ad vissza a konvertált adatokkal.
def jsonify_safe(payload, status=200):
    return jsonify(_jsonable(payload)), status

# Kinyeri a kérés JSON törzsét, és üres objektumot ad vissza hiány esetén.
def get_json():
    return request.get_json(silent=True) or {}

# Ellenőrzi, hogy van-e bejelentkezett felhasználó a sessionben.
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

# Ellenőrzi, hogy a bejelentkezett felhasználó admin jogosultságú-e.
def require_admin():
    u, err = require_user()
    if err:
        return None, err
    if (u.get("role") or "").lower() != "admin":
        return None, (jsonify({"error": "Nincs admin jogosultság"}), 403)
    return u, None

# Percek számára alakítja a különböző időformátumokat.
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

# A percértéket felfelé kerekíti a megadott idősáv méretére.
def _round_up_to_slot(mins: int, slot: int = 30) -> int:
    if mins < 0:
        return mins
    return ((mins + slot - 1) // slot) * slot

# A percben megadott időt HH:MM formára alakítja.
def _mins_to_hhmm(mins: int) -> str:
    h = (mins // 60) % 24
    m = mins % 60
    return f"{h:02d}:{m:02d}"

# A nyitási és zárási idő között létrehozza a foglalható idősávokat.
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

# Visszaadja a dátumhoz tartozó magyar nap-rövidítést.
def _weekday_token(date_iso: str) -> str:
    try:
        d = datetime.strptime(date_iso, "%Y-%m-%d").date()
        wd = d.weekday()
        return ["H", "K", "Sze", "Cs", "P", "Szo", "V"][wd]
    except Exception:
        return ""

# Kibővíti a napintervallumot az érintett napok listájára.
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

# Kinyeri a megadott naphoz tartozó nyitási és zárási időt.
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

# Egyszerű állapotellenőrző választ ad a backend működéséről.
@app.get("/api/health")
def health():
    return jsonify({"ok": True, "service": "smarttable-flask"}), 200

# Regisztrál egy új felhasználót és eltárolja a titkosított jelszót.
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

# Bejelentkezteti a felhasználót és létrehozza a sessiont.
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

# Kijelentkezteti a felhasználót és törli a session adatait.
@app.post("/api/auth/logout")
def logout_api():
    session.clear()
    return jsonify({"ok": True}), 200

# Visszaadja az aktuálisan bejelentkezett felhasználó adatait.
@app.get("/api/auth/me")
def me():
    u, err = require_user()
    if err:
        return err
    return jsonify({"id": u["id"], "name": u.get("name"), "email": u.get("email"), "role": u.get("role")}), 200

# Lekéri az éttermek listáját a fő adatokkal együtt.
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

# Lekéri a népszerű éttermek listáját a kezdőlaphoz.
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

# Lekéri a legjobbra értékelt éttermek listáját.
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

# Lekéri egy kiválasztott étterem részletes adatait.
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

# Lekéri az étterem szabad idősávjait a megadott napra és létszámra.
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

# Lekéri az adott étterem étlapját.
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

# Lekéri az adott étterem aktív ajánlatait.
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

# Lekéri az adott étterem értékeléseit és válaszait.
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
        
# Új értékelést ment az adott étteremhez.
@app.post("/api/restaurants/<int:rid>/reviews")
def add_restaurant_review(rid):
    user, err = require_user()
    if err:
        return err

    data = get_json()
    userId = int(user["id"])
    rating = data.get("rating")
    comment = (data.get("comment") or "").strip()

    if not rating:
        return jsonify({"error": "Hiányzó rating"}), 400

    try:
        rating_i = int(rating)
    except Exception:
        return jsonify({"error": "A rating legyen szám (1-5)."}), 400

    if rating_i < 1 or rating_i > 5:
        return jsonify({"error": "A rating csak 1 és 5 között lehet."}), 400

    if len(comment) < 3:
        return jsonify({"error": "A vélemény túl rövid (min. 3 karakter)."}), 400

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM restaurants WHERE id=%s", (rid,))
            if not cur.fetchone():
                return jsonify({"error": "Nincs ilyen étterem"}), 404

            cur.execute("SELECT id FROM users WHERE id=%s", (userId,))
            if not cur.fetchone():
                return jsonify({"error": "Nincs ilyen felhasználó"}), 404

            cur.execute(
                """
                INSERT INTO reviews (restaurantId, userId, rating, comment)
                VALUES (%s,%s,%s,%s)
                """,
                (rid, int(userId), rating_i, comment),
            )
            conn.commit()
            return jsonify({"ok": True}), 201
    finally:
        conn.close()

# Létrehozza vagy frissíti az admin válaszát egy értékeléshez.
@app.post("/api/reviews/<int:review_id>/response")
def upsert_review_response(review_id):
    admin_user, err = require_admin()
    if err:
        return err

    data = get_json()
    text = (data.get("responseText") or "").strip()
    if len(text) < 3:
        return jsonify({"error": "A válasz túl rövid (min. 3 karakter)."}), 400

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM reviews WHERE id=%s", (review_id,))
            if not cur.fetchone():
                return jsonify({"error": "Nincs ilyen vélemény"}), 404

            cur.execute(
                """
                INSERT INTO review_responses (reviewId, adminUserId, responseText)
                VALUES (%s,%s,%s)
                ON DUPLICATE KEY UPDATE
                    adminUserId=VALUES(adminUserId),
                    responseText=VALUES(responseText),
                    createdAt=CURRENT_TIMESTAMP
                """,
                (review_id, int(admin_user["id"]), text),
            )
            conn.commit()
            return jsonify({"ok": True}), 201
    finally:
        conn.close()

# Új foglalást hoz létre a megadott adatok alapján.
@app.post("/api/reservations")
def create_reservation():
    user, err = require_user()
    if err:
        return err

    data = get_json()
    restaurantId = data.get("restaurantId")
    userId = int(user["id"])
    date_str = data.get("date")
    time_str = data.get("time")
    peopleCount = data.get("peopleCount")

    if not restaurantId or not date_str or not time_str or not peopleCount:
        return jsonify({"error": "Hiányzó adatok a foglaláshoz"}), 400

    try:
        d_req = datetime.strptime(str(date_str), "%Y-%m-%d").date()
    except Exception:
        return jsonify({"error": "Hibás dátum formátum. Használd: YYYY-MM-DD"}), 400

    now = datetime.now()
    if d_req < now.date():
        return jsonify({"error": "A foglalás dátuma nem lehet a múltban."}), 400

    req_min = _time_to_minutes(str(time_str))
    if req_min < 0:
        return jsonify({"error": "Hibás idő formátum. Használd: HH:MM"}), 400

    if d_req == now.date():
        now_min = now.hour * 60 + now.minute
        if req_min < now_min:
            return jsonify({"error": "Erre az időpontra már nem lehet foglalni (múltbeli időpont)."}), 400

    try:
        pc = int(peopleCount)
    except Exception:
        return jsonify({"error": "A létszám hibás."}), 400
    if pc < 1:
        return jsonify({"error": "A létszám minimum 1."}), 400

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT opening_time, closing_time, capacity FROM restaurants WHERE id=%s", (restaurantId,))
            r = cur.fetchone()
            if not r:
                return jsonify({"error": "Nincs ilyen étterem"}), 404

            open_t = r.get("opening_time")
            close_t = r.get("closing_time")
            capacity = int(r.get("capacity") or 40)

            if not open_t or not close_t:
                return jsonify({"error": "Az étterem nyitvatartása nincs beállítva."}), 500

            o_min = _time_to_minutes(str(open_t))
            c_min = _time_to_minutes(str(close_t))
            if o_min < 0 or c_min < 0:
                return jsonify({"error": "Az étterem nyitvatartása hibás."}), 500

            if not (o_min <= req_min < c_min):
                return jsonify({"error": f"Az étterem ekkor zárva van. Nyitva: {open_t}–{close_t}."}), 400

            cur.execute(
                """
                SELECT IFNULL(SUM(peopleCount), 0) AS booked
                FROM reservations
                WHERE restaurantId=%s AND date=%s AND time=%s
                  AND status IN ('pending','accepted')
                """,
                (restaurantId, date_str, time_str),
            )
            booked = int((cur.fetchone() or {}).get("booked") or 0)
            remaining = max(0, capacity - booked)
            if pc > remaining:
                return jsonify({"error": f"Nincs elég szabad hely erre az időpontra. Szabad: {remaining} fő (kapacitás: {capacity})."}), 400

            cur.execute(
                """
                INSERT INTO reservations (restaurantId, userId, date, time, peopleCount, status)
                VALUES (%s,%s,%s,%s,%s,'pending')
                """,
                (restaurantId, userId, date_str, time_str, pc),
            )
            conn.commit()
            new_id = cur.lastrowid

            return jsonify({"id": new_id, "status": "pending"}), 201
    finally:
        conn.close()

# Lekéri egy felhasználó összes foglalását étteremadatokkal együtt.
@app.get("/api/reservations/user/<int:user_id>")
def reservations_by_user(user_id):
    user, err = require_user()
    if err:
        return err
    if user.get('role') != 'admin' and int(user.get('id')) != int(user_id):
        return jsonify({"error": "Nincs jogosultság."}), 403
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT r.*, rt.name as restaurantName, rt.city, rt.address
                FROM reservations r
                JOIN restaurants rt ON rt.id = r.restaurantId
                WHERE r.userId=%s
                ORDER BY r.id DESC
                """,
                (user_id,),
            )
            rows = cur.fetchall()
            return jsonify_safe(rows, 200)
    finally:
        conn.close()

# Lekéri a bejelentkezett felhasználó saját foglalásait.
@app.get("/api/reservations/me")
def reservations_me():
    user, err = require_user()
    if err:
        return err
    return reservations_by_user(int(user.get('id')))

# Ellenőrzi, hogy a felhasználó módosíthatja-e az adott foglalást.
def _reservation_permission(reservation_id: int):
    user, err = require_user()
    if err:
        return None, err

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, userId FROM reservations WHERE id=%s", (reservation_id,))
            row = cur.fetchone()
            if not row:
                return None, (jsonify({"error": "Nincs ilyen foglalás."}), 404)
            if int(row.get("userId")) != int(user.get("id")) and user.get("role") != "admin":
                return None, (jsonify({"error": "Nincs jogosultság."}), 403)
            return user, None
    finally:
        conn.close()

# Lekéri egy konkrét foglalás részletes adatait.
@app.get("/api/reservations/<int:reservation_id>")
def get_reservation_by_id(reservation_id):
    _, err = _reservation_permission(reservation_id)
    if err:
        return err

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT r.id, r.restaurantId, r.userId, r.date, r.time, r.peopleCount, r.status,
                       rt.name AS restaurantName, rt.opening_time, rt.closing_time
                FROM reservations r
                JOIN restaurants rt ON rt.id = r.restaurantId
                WHERE r.id=%s
                """,
                (reservation_id,),
            )
            row = cur.fetchone()
            if not row:
                return jsonify({"error": "Nincs ilyen foglalás."}), 404
            row["time"] = _fmt_hhmm(row.get("time"))
            return jsonify_safe(row, 200)
    finally:
        conn.close()

# Frissíti a foglalás adatait az üzleti szabályok figyelembevételével.
@app.put("/api/reservations/<int:reservation_id>")
def update_reservation(reservation_id):
    _, err = _reservation_permission(reservation_id)
    if err:
        return err

    data = get_json()
    date_str = data.get("date")
    time_str = data.get("time")
    peopleCount = data.get("peopleCount")

    if not date_str or not time_str or not peopleCount:
        return jsonify({"error": "Hiányzó adatok a módosításhoz."}), 400

    try:
        d_req = datetime.strptime(str(date_str), "%Y-%m-%d").date()
    except Exception:
        return jsonify({"error": "Hibás dátum formátum. Használd: YYYY-MM-DD"}), 400

    now = datetime.now()
    if d_req < now.date():
        return jsonify({"error": "A foglalás dátuma nem lehet a múltban."}), 400

    req_min = _time_to_minutes(str(time_str))
    if req_min < 0:
        return jsonify({"error": "Hibás idő formátum. Használd: HH:MM"}), 400
    if d_req == now.date():
        now_min = now.hour * 60 + now.minute
        if req_min < now_min:
            return jsonify({"error": "Erre az időpontra már nem lehet foglalni (múltbeli időpont)."}), 400

    try:
        pc = int(peopleCount)
    except Exception:
        return jsonify({"error": "A létszám hibás."}), 400
    if pc < 1:
        return jsonify({"error": "A létszám minimum 1."}), 400

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT restaurantId, status FROM reservations WHERE id=%s", (reservation_id,))
            res = cur.fetchone()
            if not res:
                return jsonify({"error": "Nincs ilyen foglalás."}), 404

            current_status = (res.get("status") or "pending").lower()
            if current_status not in {"pending", "accepted"}:
                return jsonify({"error": "Ezt a foglalást már nem lehet módosítani."}), 400

            restaurantId = int(res.get("restaurantId"))

            cur.execute("SELECT opening_time, closing_time, capacity FROM restaurants WHERE id=%s", (restaurantId,))
            r = cur.fetchone()
            if not r:
                return jsonify({"error": "Nincs ilyen étterem"}), 404

            open_t = r.get("opening_time")
            close_t = r.get("closing_time")
            capacity = int(r.get("capacity") or 40)
            if not open_t or not close_t:
                return jsonify({"error": "Az étterem nyitvatartása nincs beállítva."}), 500

            o_min = _time_to_minutes(str(open_t))
            c_min = _time_to_minutes(str(close_t))
            if not (o_min <= req_min < c_min):
                return jsonify({"error": f"Az étterem ekkor zárva van. Nyitva: {open_t}–{close_t}."}), 400

            cur.execute(
                """
                SELECT IFNULL(SUM(peopleCount), 0) AS booked
                FROM reservations
                WHERE restaurantId=%s AND date=%s AND time=%s
                  AND status IN ('pending','accepted')
                  AND id<>%s
                """,
                (restaurantId, date_str, time_str, reservation_id),
            )
            booked = int((cur.fetchone() or {}).get("booked") or 0)
            remaining = max(0, capacity - booked)
            if pc > remaining:
                return jsonify({"error": f"Nincs elég szabad hely erre az időpontra. Szabad: {remaining} fő (kapacitás: {capacity})."}), 400

            cur.execute(
                "UPDATE reservations SET date=%s, time=%s, peopleCount=%s WHERE id=%s",
                (date_str, time_str, pc, reservation_id),
            )
            conn.commit()
            return jsonify({"ok": True, "id": reservation_id}), 200
    finally:
        conn.close()

# Lekéri az admin felület összes kezelhető foglalását.
@app.get("/api/reservations")
def admin_get_all_reservations():
    admin, err = require_admin()
    if err:
        return err

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    r.id,
                    r.date,
                    r.time,
                    r.peopleCount,
                    r.status,
                    u.name AS userName,
                    u.email AS userEmail,
                    rt.name AS restaurantName
                FROM reservations r
                JOIN users u ON u.id = r.userId
                JOIN restaurants rt ON rt.id = r.restaurantId
                ORDER BY r.id DESC
                """
            )
            rows = cur.fetchall()
            return jsonify_safe(rows, 200)
    finally:
        conn.close()

# Módosítja egy foglalás státuszát admin oldalon.
@app.put("/api/reservations/<int:reservation_id>/status")
def admin_update_reservation_status(reservation_id):
    admin, err = require_admin()
    if err:
        return err

    data = get_json()
    status = (data.get("status") or "").strip().lower()
    if status == "canceled":
        status = "cancelled"

    allowed = {"pending", "accepted", "rejected", "cancelled", "completed"}
    if status not in allowed:
        return jsonify({"error": "Érvénytelen státusz."}), 400

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE reservations SET status=%s WHERE id=%s", (status, reservation_id))
            if cur.rowcount == 0:
                return jsonify({"error": "Nincs ilyen foglalás."}), 404

            conn.commit()
            return jsonify({"ok": True, "id": reservation_id, "status": status}), 200
    finally:
        conn.close()

# Lemondja a felhasználó saját foglalását.
@app.put("/api/reservations/<int:reservation_id>/cancel")
def user_cancel_reservation(reservation_id):
    user, err = require_user()
    if err:
        return err

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, userId, status FROM reservations WHERE id=%s", (reservation_id,))
            row = cur.fetchone()
            if not row:
                return jsonify({"error": "Nincs ilyen foglalás."}), 404

            if int(row.get("userId")) != int(user.get("id")) and user.get("role") != "admin":
                return jsonify({"error": "Nincs jogosultságod ehhez a foglaláshoz."}), 403

            current = (row.get("status") or "pending").lower()
            if current in {"cancelled", "rejected", "completed"}:
                return jsonify({"error": "Ezt a foglalást már nem lehet lemondani."}), 400

            cur.execute("UPDATE reservations SET status='cancelled' WHERE id=%s", (reservation_id,))
            conn.commit()
            return jsonify({"ok": True, "id": reservation_id, "status": "cancelled"}), 200
    finally:
        conn.close()

# Összesítő statisztikákat ad vissza az admin dashboard számára.
@app.get("/api/admin/dashboard")
def admin_dashboard():
    admin, err = require_admin()
    if err:
        return err

    today = date.today()
    now = datetime.now()
    next2 = now + timedelta(hours=2)

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COALESCE(SUM(capacity),0) AS totalCap FROM restaurants")
            total_cap = int((cur.fetchone() or {}).get("totalCap") or 0)

            cur.execute(
                """
                SELECT id, time, peopleCount, status
                FROM reservations
                WHERE date=%s AND LOWER(status) IN ('pending','accepted')
                """,
                (today,)
            )
            rows = cur.fetchall() or []

            today_count = len(rows)
            pending_count = sum(1 for r in rows if str(r.get("status", "")).lower() == "pending")

            next2_count = 0
            for r in rows:
                t = str(r.get("time") or "")
                if not t:
                    continue
                try:
                    hh, mm = t.split(":")[:2]
                    dt = datetime.combine(today, time(int(hh), int(mm)))
                except Exception:
                    continue
                if now <= dt <= next2:
                    next2_count += 1

            hourly = {}
            for r in rows:
                t = str(r.get("time") or "")
                if not t:
                    continue
                try:
                    hh = int(t.split(":")[0])
                except Exception:
                    continue
                hourly[hh] = hourly.get(hh, 0) + int(r.get("peopleCount") or 0)

            hourly_list = [{"hour": h, "people": hourly.get(h, 0)} for h in range(11, 24)]

            slot_people = {}
            for r in rows:
                t = str(r.get("time") or "")
                if not t:
                    continue
                slot_people[t] = slot_people.get(t, 0) + int(r.get("peopleCount") or 0)

            max_slot_people = max(slot_people.values()) if slot_people else 0
            occ = 0
            if total_cap > 0:
                occ = int(round((max_slot_people / total_cap) * 100))
                if occ > 100:
                    occ = 100

            alerts = []
            if total_cap > 0:
                for t, pc in sorted(slot_people.items()):
                    if pc > total_cap:
                        alerts.append({"type": "warning", "text": f"{t} Túlfoglalás"})
                        break

            cur.execute(
                """
                SELECT COUNT(*) AS c
                FROM reviews rv
                LEFT JOIN review_responses rr ON rr.reviewId = rv.id
                WHERE rr.id IS NULL
                """
            )
            unresp = int((cur.fetchone() or {}).get("c") or 0)
            if unresp > 0:
                alerts.append({"type": "info", "text": f"{unresp} új review válasz nélkül"})

            if pending_count > 0:
                alerts.append({"type": "success", "text": f"{pending_count} foglalás jóváhagyásra"})
            if not alerts:
                alerts.append({"type": "success", "text": "Nincs teendő"})

            cur.execute(
                """
                SELECT 'reservation' AS kind, rs.createdAt AS ts,
                       u.name AS userName, r.name AS restaurantName,
                       DATE_FORMAT(rs.date,'%Y-%m-%d') AS resDate,
                       rs.time AS resTime,
                       rs.peopleCount AS peopleCount,
                       rs.id AS refId
                FROM reservations rs
                JOIN users u ON u.id = rs.userId
                JOIN restaurants r ON r.id = rs.restaurantId
                ORDER BY rs.createdAt DESC
                LIMIT 8
                """
            )
            ev_res = cur.fetchall() or []

            cur.execute(
                """
                SELECT 'review' AS kind, rv.createdAt AS ts,
                       u.name AS userName, r.name AS restaurantName,
                       rv.rating AS rating,
                       rv.id AS refId
                FROM reviews rv
                JOIN users u ON u.id = rv.userId
                JOIN restaurants r ON r.id = rv.restaurantId
                ORDER BY rv.createdAt DESC
                LIMIT 8
                """
            )
            ev_rev = cur.fetchall() or []

            events = (ev_res + ev_rev)

            def _ts(v):
                t = v.get("ts")
                if isinstance(t, (datetime,)):
                    return t
                try:
                    return datetime.fromisoformat(str(t).replace(" ", "T"))
                except Exception:
                    return datetime(1970, 1, 1)

            events_sorted = sorted(events, key=_ts, reverse=True)[:10]
            recent_events = []
            for e in events_sorted:
                t = e.get("ts")
                if isinstance(t, datetime):
                    ts_iso = t.isoformat(sep=" ", timespec="seconds")
                else:
                    ts_iso = str(t)

                row = {
                    "kind": e.get("kind"),
                    "createdAt": ts_iso,
                    "userName": e.get("userName"),
                    "restaurantName": e.get("restaurantName"),
                    "refId": e.get("refId"),
                }
                if e.get("kind") == "reservation":
                    row.update({
                        "date": e.get("resDate"),
                        "time": _fmt_hhmm(e.get("resTime")),
                        "peopleCount": e.get("peopleCount"),
                    })
                else:
                    row.update({"rating": e.get("rating")})
                recent_events.append(row)

            return jsonify_safe(
                {
                    "todayReservations": today_count,
                    "pendingReservations": pending_count,
                    "next2Hours": next2_count,
                    "occupancyPercent": occ,
                    "totalCapacity": total_cap,
                    "hourlyLoad": hourly_list,
                    "alerts": alerts,
                    "recentEvents": recent_events,
                },
                200,
            )
    finally:
        conn.close()

# Lekéri az admin által kezelhető étlap elemeket.
@app.get("/api/admin/menu-items")
def admin_get_menu_items():
    admin, err = require_admin()
    if err:
        return err
    restaurant_id = request.args.get("restaurantId")
    if not restaurant_id:
        return jsonify({"error": "Hiányzó restaurantId"}), 400

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, restaurantId, category, name, description, priceHuf
                FROM menu_items
                WHERE restaurantId=%s
                ORDER BY category, name
                """,
                (restaurant_id,),
            )
            return jsonify_safe(cur.fetchall() or [], 200)
    finally:
        conn.close()

# Új étlap tételt hoz létre az admin felületről.
@app.post("/api/admin/menu-items")
def admin_create_menu_item():
    admin, err = require_admin()
    if err:
        return err
    data = get_json()
    restaurantId = data.get("restaurantId")
    category = (data.get("category") or "").strip()
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip() or None
    priceHuf = data.get("priceHuf")

    if not restaurantId or not category or not name or priceHuf is None:
        return jsonify({"error": "Hiányzó adatok"}), 400
    try:
        priceHuf = int(priceHuf)
    except Exception:
        return jsonify({"error": "Hibás ár"}), 400
    if priceHuf < 0:
        return jsonify({"error": "Az ár nem lehet negatív"}), 400

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO menu_items (restaurantId, category, name, description, priceHuf)
                VALUES (%s,%s,%s,%s,%s)
                """,
                (restaurantId, category, name, description, priceHuf),
            )
            conn.commit()
            return jsonify_safe({"id": cur.lastrowid}, 201)
    finally:
        conn.close()

# Frissíti egy meglévő étlap tétel adatait.
@app.put("/api/admin/menu-items/<int:item_id>")
def admin_update_menu_item(item_id):
    admin, err = require_admin()
    if err:
        return err
    data = get_json()
    category = (data.get("category") or "").strip()
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip() or None
    priceHuf = data.get("priceHuf")
    if not category or not name or priceHuf is None:
        return jsonify({"error": "Hiányzó adatok"}), 400
    try:
        priceHuf = int(priceHuf)
    except Exception:
        return jsonify({"error": "Hibás ár"}), 400
    if priceHuf < 0:
        return jsonify({"error": "Az ár nem lehet negatív"}), 400

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE menu_items
                SET category=%s, name=%s, description=%s, priceHuf=%s
                WHERE id=%s
                """,
                (category, name, description, priceHuf, item_id),
            )
            conn.commit()
            return jsonify_safe({"ok": True}, 200)
    finally:
        conn.close()

# Töröl egy étlap tételt az admin felületről.
@app.delete("/api/admin/menu-items/<int:item_id>")
def admin_delete_menu_item(item_id):
    admin, err = require_admin()
    if err:
        return err
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM menu_items WHERE id=%s", (item_id,))
            conn.commit()
            return jsonify_safe({"ok": True}, 200)
    finally:
        conn.close()

# Lekéri az admin által kezelhető akciókat.
@app.get("/api/admin/hot-deals")
def admin_get_hot_deals():
    admin, err = require_admin()
    if err:
        return err
    restaurant_id = request.args.get("restaurantId")
    if not restaurant_id:
        return jsonify({"error": "Hiányzó restaurantId"}), 400
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
                (restaurant_id,),
            )
            return jsonify_safe(cur.fetchall() or [], 200)
    finally:
        conn.close()

# Új akciót hoz létre az admin felületről.
@app.post("/api/admin/hot-deals")
def admin_create_hot_deal():
    admin, err = require_admin()
    if err:
        return err
    data = get_json()
    restaurantId = data.get("restaurantId")
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip() or None
    originalPriceHuf = data.get("originalPriceHuf")
    dealPriceHuf = data.get("dealPriceHuf")

    if not restaurantId or not name or originalPriceHuf is None or dealPriceHuf is None:
        return jsonify({"error": "Hiányzó adatok"}), 400
    try:
        originalPriceHuf = int(originalPriceHuf)
        dealPriceHuf = int(dealPriceHuf)
    except Exception:
        return jsonify({"error": "Hibás ár"}), 400
    if originalPriceHuf < 0 or dealPriceHuf < 0:
        return jsonify({"error": "Az ár nem lehet negatív"}), 400
    if dealPriceHuf > originalPriceHuf:
        return jsonify({"error": "Akciós ár nem lehet nagyobb, mint az eredeti"}), 400

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO hot_deals (restaurantId, name, description, originalPriceHuf, dealPriceHuf)
                VALUES (%s,%s,%s,%s,%s)
                """,
                (restaurantId, name, description, originalPriceHuf, dealPriceHuf),
            )
            conn.commit()
            return jsonify_safe({"id": cur.lastrowid}, 201)
    finally:
        conn.close()

# Frissíti egy meglévő akció adatait.
@app.put("/api/admin/hot-deals/<int:deal_id>")
def admin_update_hot_deal(deal_id):
    admin, err = require_admin()
    if err:
        return err
    data = get_json()
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip() or None
    originalPriceHuf = data.get("originalPriceHuf")
    dealPriceHuf = data.get("dealPriceHuf")
    if not name or originalPriceHuf is None or dealPriceHuf is None:
        return jsonify({"error": "Hiányzó adatok"}), 400
    try:
        originalPriceHuf = int(originalPriceHuf)
        dealPriceHuf = int(dealPriceHuf)
    except Exception:
        return jsonify({"error": "Hibás ár"}), 400
    if originalPriceHuf < 0 or dealPriceHuf < 0:
        return jsonify({"error": "Az ár nem lehet negatív"}), 400
    if dealPriceHuf > originalPriceHuf:
        return jsonify({"error": "Akciós ár nem lehet nagyobb, mint az eredeti"}), 400

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE hot_deals
                SET name=%s, description=%s, originalPriceHuf=%s, dealPriceHuf=%s
                WHERE id=%s
                """,
                (name, description, originalPriceHuf, dealPriceHuf, deal_id),
            )
            conn.commit()
            return jsonify_safe({"ok": True}, 200)
    finally:
        conn.close()

# Töröl egy akciót az admin felületről.
@app.delete("/api/admin/hot-deals/<int:deal_id>")
def admin_delete_hot_deal(deal_id):
    admin, err = require_admin()
    if err:
        return err
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM hot_deals WHERE id=%s", (deal_id,))
            conn.commit()
            return jsonify_safe({"ok": True}, 200)
    finally:
        conn.close()

# Lekéri az admin számára látható értékeléseket.
@app.get("/api/admin/reviews")
def admin_get_reviews():
    admin, err = require_admin()
    if err:
        return err

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    rv.id,
                    rv.rating,
                    rv.comment,
                    rv.createdAt,
                    u.name AS userName,
                    u.email AS userEmail,
                    rt.name AS restaurantName,
                    rr.responseText,
                    rr.createdAt AS responseCreatedAt,
                    au.name AS adminName
                FROM reviews rv
                JOIN users u ON u.id = rv.userId
                JOIN restaurants rt ON rt.id = rv.restaurantId
                LEFT JOIN review_responses rr ON rr.reviewId = rv.id
                LEFT JOIN users au ON au.id = rr.adminUserId
                ORDER BY rv.id DESC
                """
            )
            rows = cur.fetchall() or []
            return jsonify_safe(rows, 200)
    finally:
        conn.close()

# Lekéri a vendégek listáját alap statisztikákkal.
@app.get("/api/admin/guests")
def admin_get_guests():
    admin, err = require_admin()
    if err:
        return err

    include_admins = str(request.args.get("includeAdmins") or "0").strip() == "1"

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            where = "" if include_admins else "WHERE u.role='user'"
            cur.execute(
                f"""
                SELECT
                    u.id,
                    u.name,
                    u.email,
                    u.role,
                    (SELECT COUNT(*) FROM reservations rs WHERE rs.userId=u.id) AS reservationsCount,
                    (SELECT COUNT(*) FROM reviews rv WHERE rv.userId=u.id) AS reviewsCount,
                    GREATEST(
                        COALESCE((SELECT MAX(createdAt) FROM reservations rs2 WHERE rs2.userId=u.id), '1970-01-01'),
                        COALESCE((SELECT MAX(createdAt) FROM reviews rv2 WHERE rv2.userId=u.id), '1970-01-01')
                    ) AS lastActivity
                FROM users u
                {where}
                ORDER BY lastActivity DESC, u.id ASC
                """
            )
            rows = cur.fetchall() or []
            out = []
            for r in rows:
                la = r.get("lastActivity")
                if isinstance(la, datetime):
                    la_str = la.isoformat(sep=" ", timespec="seconds")
                else:
                    la_str = str(la) if la else ""
                out.append({
                    "id": r.get("id"),
                    "name": r.get("name"),
                    "email": r.get("email"),
                    "role": r.get("role"),
                    "reservationsCount": int(r.get("reservationsCount") or 0),
                    "reviewsCount": int(r.get("reviewsCount") or 0),
                    "lastActivity": la_str,
                })
            return jsonify_safe(out, 200)
    finally:
        conn.close()

# Kiszolgálja a frontend fájlokat és az alap útvonalat.
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if path.startswith("api"):
        abort(404)

    if path == "":
        return redirect("/index.html")

    file_path = os.path.join(FRONTEND_DIR, path)
    if os.path.isfile(file_path):
        return send_from_directory(FRONTEND_DIR, path)

    abort(404)

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)
        
