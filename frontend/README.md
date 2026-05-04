# HarvestData Frontend

Next.js dashboard for the HarvestData Django REST API.

```bash
npm install
npm run dev
```

The dashboard expects the API at `http://localhost:8000/api/v1`.
Override it with:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1 npm run dev
```

The dashboard requires the Django API and an authenticated session. If the API is offline, start the backend first and then sign in again.
