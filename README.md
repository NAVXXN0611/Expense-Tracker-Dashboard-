# FinTrack

A full-stack expense dashboard built with HTML, CSS, JavaScript, Python, Flask, and PostgreSQL.

## Backend

For production hosting, this project uses **PostgreSQL** through the `DATABASE_URL` environment variable. PostgreSQL is the right choice for customer accounts, persistent transactions, hosted backups, and real multi-user use.

For local development, the app automatically falls back to SQLite when `DATABASE_URL` is not set. That keeps local setup easy while keeping the hosted version production-ready.

## Features

- Public intro website for FinTrack
- Customer register/login page
- Protected internal dashboard after login
- User-specific transaction records
- Monthly budget goals
- Expense category donut chart
- Income vs expense trend graph with month selector
- Recent activity timeline
- Recurring expenses with one-click transaction posting
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
|-- app.py
|-- requirements.txt
|-- run_dashboard.bat
|-- vercel.json
|-- expenses.db
|-- static
|   |-- fintrack-graph.png
|   |-- script.js
|   `-- styles.css
`-- templates
    |-- auth.html
    |-- dashboard.html
    |-- index.html
    |-- login.html
    `-- register.html
```

`expenses.db` is created automatically only for local development when `DATABASE_URL` is not set.

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

4. Run the app locally with SQLite fallback:

```bash
python app.py
```

5. Open the website:

```text
http://127.0.0.1:5055
```

Login page:

```text
http://127.0.0.1:5055/login
```

Register page:

```text
http://127.0.0.1:5055/register
```

Internal dashboard after login:

```text
http://127.0.0.1:5055/dashboard
```

Health check:

```text
http://127.0.0.1:5055/health
```

## PostgreSQL Setup

For production, create a hosted PostgreSQL database with a provider such as Neon, Supabase, Railway, Render, or Vercel Marketplace integrations.

After creating the database, copy its PostgreSQL connection string. It usually looks like this:

```text
postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
```

Set it as an environment variable:

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
```

The app creates these tables automatically on startup:

- `users`
- `expenses`
- `budget_goals`
- `recurring_expenses`

## API Endpoints

The transaction API requires a logged-in customer session.

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

### Get monthly budget

```http
GET /api/budget?month=2026-06
```

### Save monthly budget

```http
POST /api/budget
Content-Type: application/json

{
  "month": "2026-06",
  "amount": 1000
}
```

### Get recurring expenses

```http
GET /api/recurring
```

### Create recurring expense

```http
POST /api/recurring
Content-Type: application/json

{
  "title": "Internet",
  "category": "Utilities",
  "amount": 59.99,
  "frequency": "monthly",
  "next_due_date": "2026-07-01",
  "note": "Fiber plan"
}
```

### Post recurring expense to transactions

```http
POST /api/recurring/1/apply
```

### Delete recurring expense

```http
DELETE /api/recurring/1
```

## Deploying on Vercel

This project includes `vercel.json`, so Vercel can run the Flask app through the Python runtime.

1. Push this repository to GitHub.
2. Open [Vercel](https://vercel.com/).
3. Choose **Add New Project**.
4. Import the GitHub repository:

```text
NAVXXN0611/Expense-Tracker-Dashboard-
```

5. Keep the default project settings.
6. Add these environment variables in Vercel:

```text
SECRET_KEY=replace-with-a-long-random-secret
DATABASE_URL=your-hosted-postgresql-connection-string
```

7. Deploy.

Important: Do not use SQLite for the Vercel production database. Use the hosted PostgreSQL `DATABASE_URL` so customer accounts and transactions persist correctly.

After deployment, open:

```text
https://your-vercel-domain.vercel.app/health
```

If `database_ready` is `false`, check that `SECRET_KEY` and `DATABASE_URL` are added to the correct Vercel environment and redeploy.
