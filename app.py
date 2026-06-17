from datetime import datetime, timezone
from functools import wraps
import os
from pathlib import Path
import sqlite3
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from flask import Flask, jsonify, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash


BASE_DIR = Path(__file__).resolve().parent
SQLITE_DATABASE = BASE_DIR / "expenses.db"
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
USE_POSTGRES = DATABASE_URL.startswith(("postgres://", "postgresql://"))
IS_VERCEL = os.environ.get("VERCEL") == "1"
SECRET_KEY = os.environ.get("SECRET_KEY")

if IS_VERCEL and not SECRET_KEY:
    raise RuntimeError("SECRET_KEY must be set in Vercel environment variables.")

if IS_VERCEL and not USE_POSTGRES:
    raise RuntimeError("DATABASE_URL must be set to a PostgreSQL database on Vercel.")

app = Flask(__name__)
app.config["SECRET_KEY"] = SECRET_KEY or "dev-secret-change-before-production"
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = IS_VERCEL


def postgres_url():
    if not USE_POSTGRES:
        return ""

    parsed = urlparse(DATABASE_URL.replace("postgres://", "postgresql://", 1))
    query = dict(parse_qsl(parsed.query))
    query.setdefault("sslmode", "require")
    return urlunparse(parsed._replace(query=urlencode(query)))


def get_db():
    if USE_POSTGRES:
        import psycopg2
        import psycopg2.extras

        return psycopg2.connect(
            postgres_url(),
            cursor_factory=psycopg2.extras.RealDictCursor,
        )

    conn = sqlite3.connect(SQLITE_DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    if USE_POSTGRES:
        conn = get_db()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS users (
                        id SERIAL PRIMARY KEY,
                        name TEXT NOT NULL,
                        email TEXT NOT NULL UNIQUE,
                        password_hash TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    )
                    """
                )
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS expenses (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        title TEXT NOT NULL,
                        category TEXT NOT NULL,
                        amount NUMERIC(12, 2) NOT NULL,
                        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
                        transaction_date TEXT NOT NULL,
                        note TEXT DEFAULT '',
                        created_at TEXT NOT NULL
                    )
                    """
                )
                conn.commit()
        finally:
            conn.close()
        return

    conn = get_db()
    try:
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
        conn.commit()
    finally:
        conn.close()


def db_execute(query, params=(), fetchone=False, fetchall=False, commit=False):
    sql = query.replace("?", "%s") if USE_POSTGRES else query
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)

        result = None
        if fetchone:
            result = cursor.fetchone()
        elif fetchall:
            result = cursor.fetchall()

        if commit:
            conn.commit()

        cursor.close()
        return result
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def duplicate_email_error(error):
    if USE_POSTGRES:
        return getattr(error, "pgcode", "") == "23505"
    return isinstance(error, sqlite3.IntegrityError)


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
        "amount": float(row["amount"]),
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

    user = db_execute(
        "SELECT * FROM users WHERE email = ?",
        (email,),
        fetchone=True,
    )

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
    if len(password) < 8:
        return redirect(url_for("auth", error="Password must be at least 8 characters") + "#register")

    try:
        user = db_execute(
            """
            INSERT INTO users (name, email, password_hash, created_at)
            VALUES (?, ?, ?, ?)
            RETURNING id, name
            """,
            (
                name,
                email,
                generate_password_hash(password),
                datetime.now(timezone.utc).isoformat(timespec="seconds"),
            ),
            fetchone=True,
            commit=True,
        ) if USE_POSTGRES else None

        if not USE_POSTGRES:
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
                user = {"id": cursor.lastrowid, "name": name}
    except Exception as error:
        if duplicate_email_error(error):
            return redirect(url_for("auth", error="Email is already registered") + "#register")
        raise

    session.clear()
    session["user_id"] = user["id"]
    session["user_name"] = user["name"]
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
    rows = db_execute(
        """
        SELECT * FROM expenses
        WHERE user_id = ?
        ORDER BY transaction_date DESC, id DESC
        """,
        (session["user_id"],),
        fetchall=True,
    )
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

    if USE_POSTGRES:
        row = db_execute(
            """
            INSERT INTO expenses
                (user_id, title, category, amount, type, transaction_date, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING *
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
            fetchone=True,
            commit=True,
        )
    else:
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
    if USE_POSTGRES:
        deleted = db_execute(
            """
            DELETE FROM expenses
            WHERE id = ? AND user_id = ?
            RETURNING id
            """,
            (transaction_id, session["user_id"]),
            fetchone=True,
            commit=True,
        )
        if not deleted:
            return jsonify({"error": "Transaction not found"}), 404
    else:
        with get_db() as conn:
            cursor = conn.execute(
                "DELETE FROM expenses WHERE id = ? AND user_id = ?",
                (transaction_id, session["user_id"]),
            )
            if cursor.rowcount == 0:
                return jsonify({"error": "Transaction not found"}), 404
    return "", 204


init_db()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5055, debug=False)
