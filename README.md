# Expensive.io

A full-stack expense dashboard built with HTML, CSS, JavaScript, Python, and Flask.

## Backend Suggestion

For this project, **Flask + SQLite** is the easiest backend choice. SQLite stores data in a local `expenses.db` file, needs no separate database server, and is perfect for learning or small personal dashboards.

PostgreSQL is a good next step when you need multiple users, hosting, backups, stronger concurrency, or production database tooling. The app is structured so it can be migrated later, but SQLite keeps setup simple today.

## Features

- Customer register/login page
- Protected internal dashboard after login
- Add income and expense transactions
- Delete transactions
- Search transactions
- Filter by income or expense
- Summary cards for balance, income, expenses, and count
- Category spending chart
- Python REST API backend

## Project Structure

```text
.
├── app.py
├── requirements.txt
├── expenses.db
├── static
│   ├── script.js
│   └── styles.css
└── templates
    └── index.html
```

`expenses.db` is created automatically when the app starts.

## Setup

1. Create a virtual environment:

```bash
python -m venv .venv
```

2. Activate it on Windows PowerShell:

```bash
.\.venv\Scripts\Activate.ps1
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

4. Run the app:

```bash
python app.py
```

5. Open the dashboard:

```text
http://127.0.0.1:5055
```

Customer access page:

```text
http://127.0.0.1:5055/auth
```

Internal dashboard after login:

```text
http://127.0.0.1:5055/dashboard
```

## API Endpoints

### Get transactions

```http
GET /api/transactions
```

### Create transaction

```http
POST /api/transactions
Content-Type: application/json

{
  "title": "Groceries",
  "category": "Food",
  "amount": 45.5,
  "type": "expense",
  "transaction_date": "2026-06-17",
  "note": "Weekly shopping"
}
```

### Delete transaction

```http
DELETE /api/transactions/1
```

## PostgreSQL Upgrade Path

If you want PostgreSQL later:

1. Install PostgreSQL.
2. Install a Python PostgreSQL driver such as `psycopg2-binary`.
3. Replace the SQLite connection in `app.py` with a PostgreSQL connection.
4. Change SQL placeholders from `?` to `%s`.
5. Store the database URL in an environment variable such as `DATABASE_URL`.

For now, SQLite is the recommended backend because it is faster to set up and easier to run locally.
