from datetime import datetime, timezone
from functools import wraps
import os
from pathlib import Path
import sqlite3

from flask import Flask, jsonify, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash


BASE_DIR = Path(__file__).resolve().parent
DATABASE = BASE_DIR / "expenses.db"

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get(
    "SECRET_KEY", "dev-secret-change-before-production"
)


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                amount REAL NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
                transaction_date TEXT NOT NULL,
                note TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
            """
        )
        columns = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(expenses)").fetchall()
        }
        if "user_id" not in columns:
            conn.execute("ALTER TABLE expenses ADD COLUMN user_id INTEGER")


def login_required(view):
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        if "user_id" not in session:
            return redirect(url_for("auth"))
        return view(*args, **kwargs)

    return wrapped_view


def row_to_dict(row):
    return {
        "id": row["id"],
        "title": row["title"],
        "category": row["category"],
        "amount": row["amount"],
        "type": row["type"],
        "transaction_date": row["transaction_date"],
        "note": row["note"],
        "created_at": row["created_at"],
    }


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/login")
def login():
    return redirect(url_for("auth") + "#login")


@app.route("/register")
def register():
    return redirect(url_for("auth") + "#register")


@app.route("/auth")
def auth():
    return render_template("auth.html", error=request.args.get("error"))


@app.post("/auth/login")
def login_customer():
    email = request.form.get("email", "").strip().lower()
    password = request.form.get("password", "")

    with get_db() as conn:
        user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

    if not user or not check_password_hash(user["password_hash"], password):
        return redirect(url_for("auth", error="Invalid email or password") + "#login")

    session.clear()
    session["user_id"] = user["id"]
    session["user_name"] = user["name"]
    return redirect(url_for("dashboard"))


@app.post("/auth/register")
def register_customer():
    name = request.form.get("name", "").strip()
    email = request.form.get("email", "").strip().lower()
    password = request.form.get("password", "")

    if not name or not email or not password:
        return redirect(url_for("auth", error="Please fill all register fields") + "#register")

    try:
        with get_db() as conn:
            cursor = conn.execute(
                """
                INSERT INTO users (name, email, password_hash, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (
                    name,
                    email,
                    generate_password_hash(password),
                    datetime.now(timezone.utc).isoformat(timespec="seconds"),
                ),
            )
    except sqlite3.IntegrityError:
        return redirect(url_for("auth", error="Email is already registered") + "#register")

    session.clear()
    session["user_id"] = cursor.lastrowid
    session["user_name"] = name
    return redirect(url_for("dashboard"))


@app.route("/dashboard")
@login_required
def dashboard():
    return render_template("dashboard.html", user_name=session.get("user_name", "Customer"))


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("index"))


@app.get("/api/transactions")
@login_required
def list_transactions():
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT * FROM expenses
            WHERE user_id = ?
            ORDER BY transaction_date DESC, id DESC
            """,
            (session["user_id"],),
        ).fetchall()
    return jsonify([row_to_dict(row) for row in rows])


@app.post("/api/transactions")
@login_required
def create_transaction():
    payload = request.get_json(force=True)
    required = ["title", "category", "amount", "type", "transaction_date"]
    missing = [field for field in required if not payload.get(field)]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    try:
        amount = round(float(payload["amount"]), 2)
    except ValueError:
        return jsonify({"error": "Amount must be a number"}), 400

    if amount <= 0:
        return jsonify({"error": "Amount must be greater than zero"}), 400

    if payload["type"] not in {"income", "expense"}:
        return jsonify({"error": "Type must be income or expense"}), 400

    try:
        datetime.strptime(payload["transaction_date"], "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Date must use YYYY-MM-DD format"}), 400

    with get_db() as conn:
        cursor = conn.execute(
            """
            INSERT INTO expenses
                (user_id, title, category, amount, type, transaction_date, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                session["user_id"],
                payload["title"].strip(),
                payload["category"].strip(),
                amount,
                payload["type"],
                payload["transaction_date"],
                payload.get("note", "").strip(),
                datetime.now(timezone.utc).isoformat(timespec="seconds"),
            ),
        )
        row = conn.execute(
            "SELECT * FROM expenses WHERE id = ?", (cursor.lastrowid,)
        ).fetchone()

    return jsonify(row_to_dict(row)), 201


@app.delete("/api/transactions/<int:transaction_id>")
@login_required
def delete_transaction(transaction_id):
    with get_db() as conn:
        cursor = conn.execute(
            "DELETE FROM expenses WHERE id = ? AND user_id = ?",
            (transaction_id, session["user_id"]),
        )
        if cursor.rowcount == 0:
            return jsonify({"error": "Transaction not found"}), 404
    return "", 204


if __name__ == "__main__":
    init_db()
    app.run(host="127.0.0.1", port=5055, debug=False)
