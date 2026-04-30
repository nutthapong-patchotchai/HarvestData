# HarvestData

HarvestData is a modern fruit-harvest management app. The backend is a Django REST Framework API and the frontend is a Next.js dashboard with a natural orchard-inspired interface.

## What It Manages

- Farmers and orchard contact details
- Fruit crops and varieties
- Planting areas in rai
- Yearly harvest records, quantity, price, and revenue
- Dashboard summaries by year, fruit, and farmer

## Stack

- Backend: Django 5.1, Django REST Framework, SQLite for local development
- Frontend: Next.js 16, React 18, Tailwind CSS, custom CSS charts

## Backend Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_harvest_demo
python manage.py runserver 8000
```

Demo login:

```text
username: demo
password: demo1234
```

Main API routes:

- `GET /api/v1/dashboard/`
- `GET /api/v1/farmers/`
- `GET /api/v1/fruits/`
- `GET /api/v1/plantings/`
- `GET /api/v1/harvests/`
- `POST /api/v1/auth/login/`

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

The frontend reads `NEXT_PUBLIC_API_BASE_URL`; by default it uses:

```text
http://localhost:8000/api/v1
```

If the API is not running, the dashboard falls back to demo harvest data so the interface can still be reviewed.
