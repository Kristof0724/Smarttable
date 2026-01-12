import os
import bcrypt
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from db import get_conn

load_dotenv()

app = Flask(__name__)
CORS(app)

@app.get("/api/health")
def health():
    return jsonify({"ok": True, "service": "smarttable-flask"})

@app.post("/api/auth/register")
def register():
    data = request.get_json(force=True)
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
    data = request.get_json(force=True)
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Hiányzó email vagy jelszó"}), 400

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, name, email, password_hash, role FROM users WHERE email=%s", (email,))
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
            })
    finally:
        conn.close()

@app.get("/api/restaurants")
def get_restaurants():
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM restaurants ORDER BY id DESC")
            rows = cur.fetchall()
            return jsonify(rows)
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
            return jsonify(row)
    finally:
        conn.close()

@app.post("/api/reservations")
def create_reservation():
    data = request.get_json(force=True)
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
                "INSERT INTO reservations (restaurantId, userId, date, time, peopleCount, status) VALUES (%s,%s,%s,%s,%s,'pending')",
                (restaurantId, userId, date, time, peopleCount),
            )
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
            return jsonify(rows)
    finally:
        conn.close()

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)