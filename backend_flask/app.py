import os
import bcrypt
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from db import get_conn

load_dotenv()

app = Flask(__name__)

# CORS: frontend (http.server) + böngésző miatt kell
CORS(app)

def get_json():
    """Biztonságos JSON beolvasás (ne force=True)."""
    return request.get_json(silent=True) or {}

def require_admin():
    """
    Egyszerű admin védelem:
    - vár egy X-User-Id headert
    - DB-ben megnézi, admin-e
    """
    user_id = request.headers.get("X-User-Id", "").strip()
    if not user_id.isdigit():
        return None, (jsonify({"error": "Admin azonosító hiányzik (X-User-Id)"}), 401)

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, role FROM users WHERE id=%s", (int(user_id),))
            u = cur.fetchone()
            if not u or u.get("role") != "admin":
                return None, (jsonify({"error": "Nincs admin jogosultság"}), 403)
            return u, None
    finally:
        conn.close()


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
            user_id = cur.lastrowid
            return jsonify({
                "id": user_id,
                "name": name,
                "email": email,
                "role": "user"
            }), 201
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

            return jsonify({
                "id": user["id"],
                "name": user["name"],
                "email": user["email"],
                "role": user["role"]
            }), 200
    finally:
        conn.close()

@app.get("/api/restaurants")
def get_restaurants():
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM restaurants ORDER BY id DESC")
            rows = cur.fetchall()
            return jsonify(rows), 200
    finally:
        conn.close()

@app.get("/api/restaurants/<int:rid>")
def get_restaurant(rid):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM restaurants WHERE id=%s", (rid,))
            row = cur.fetchone()
            if not row:
                return jsonify({"error": "Nincs ilyen étterem"}), 404
            return jsonify(row), 200
    finally:
        conn.close()

@app.post("/api/reservations")
def create_reservation():
    data = get_json()
    restaurantId = data.get("restaurantId")
    userId = data.get("userId")
    date = data.get("date")
    time = data.get("time")
    peopleCount = data.get("peopleCount")

    if not restaurantId or not userId or not date or not time or not peopleCount:
        return jsonify({"error": "Hiányzó adatok a foglaláshoz"}), 400

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO reservations (restaurantId, userId, date, time, peopleCount, status)
                VALUES (%s,%s,%s,%s,%s,'pending')
                """,
                (restaurantId, userId, date, time, peopleCount),
            )
            conn.commit()
            res_id = cur.lastrowid
            return jsonify({"id": res_id, "status": "pending"}), 201
    finally:
        conn.close()

@app.get("/api/reservations/user/<int:user_id>")
def reservations_by_user(user_id):
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
            return jsonify(rows), 200
    finally:
        conn.close()

# =========================
# ✅ ADMIN VÉGPONTOK
# =========================

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
            return jsonify(rows), 200
    finally:
        conn.close()


@app.put("/api/reservations/<int:reservation_id>/status")
def admin_update_reservation_status(reservation_id):
    admin, err = require_admin()
    if err:
        return err

    data = get_json()
    status = (data.get("status") or "").strip().lower()

    allowed = {"pending", "accepted", "cancelled"}
    if status not in allowed:
        return jsonify({"error": "Érvénytelen státusz."}), 400

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE reservations SET status=%s WHERE id=%s",
                (status, reservation_id),
            )
            if cur.rowcount == 0:
                return jsonify({"error": "Nincs ilyen foglalás."}), 404

            conn.commit()
            return jsonify({"ok": True, "id": reservation_id, "status": status}), 200
    finally:
        conn.close()

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)