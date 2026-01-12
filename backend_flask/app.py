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