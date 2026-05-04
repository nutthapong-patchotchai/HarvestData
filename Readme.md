# HarvestData

<p align="center">
  <img src="frontend/public/landing/harvest-satellite-hero.png" alt="HarvestData orchard analytics hero preview" width="100%" />
</p>

<p align="center">
  <strong>ระบบจัดการข้อมูลสวนผลไม้ เกษตรกร แปลงปลูก ผลผลิต และรายได้ พร้อม dashboard วิเคราะห์แนวโน้มแบบใช้งานได้จริง</strong>
</p>

<p align="center">
  <img alt="Django" src="https://img.shields.io/badge/Django-5.1-0f5132?style=for-the-badge" />
  <img alt="Django REST Framework" src="https://img.shields.io/badge/DRF-3.15-8b1a1a?style=for-the-badge" />
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-111827?style=for-the-badge" />
  <img alt="React" src="https://img.shields.io/badge/React-18-2563eb?style=for-the-badge" />
  <img alt="SQLite" src="https://img.shields.io/badge/SQLite-local-2f5f98?style=for-the-badge" />
</p>

HarvestData คือ dashboard สำหรับบริหารข้อมูลผลผลิตสวนผลไม้ตั้งแต่ระดับเกษตรกรจนถึงภาพรวมรายปี ระบบนี้ประกอบด้วย Django REST Framework API และ Next.js dashboard ที่รองรับการดูภาพรวม, จัดการข้อมูลหลัก, บันทึกแปลงปลูก, บันทึกผลผลิต, วิเคราะห์รายได้, แผนที่จังหวัด และนำเข้า/ส่งออก CSV

## Gallery

| Dashboard | Light Mode |
| --- | --- |
| <img src="frontend/public/landing/dashboard-preview.png" alt="HarvestData dark dashboard preview" width="100%" /> | <img src="frontend/public/landing/dashboard-light-preview.png" alt="HarvestData light dashboard preview" width="100%" /> |

| Mobile Experience |
| --- |
| <img src="frontend/public/landing/dashboard-mobile-preview.png" alt="HarvestData mobile dashboard preview" width="320" /> |

## Highlights

- Dashboard สรุปจำนวนเกษตรกร แปลงปลูก รายการเก็บเกี่ยว ปริมาณผลผลิต รายได้ และราคาเฉลี่ย
- วิเคราะห์ผลผลิตตามปี ผลไม้ เกษตรกร และแนวโน้มรายบุคคล
- แผนที่ประเทศไทยสำหรับดูพื้นที่ปลูกตามจังหวัด/อำเภอ/ตำบล
- CRUD สำหรับเกษตรกร แปลงปลูก และรายการเก็บเกี่ยว
- Admin Center สำหรับจัดการปีเก็บเกี่ยวและ master data ผลไม้
- Import/Export CSV พร้อม template, preview, validation, error report และ ZIP export
- Session login พร้อมแยกสิทธิ์ผู้ใช้ทั่วไปและ admin
- Theme dark/light และ layout responsive สำหรับ desktop/mobile
- Frontend อ่านข้อมูลแบบ paginated ครบทุกหน้า ไม่ตัดข้อมูลที่เกิน page size
- Backend มี validation และ database constraints สำหรับข้อมูลซ้ำและค่าติดลบ

## System Map

```text
HarvestData
├── Backend: Django 5.1 + Django REST Framework
│   ├── Session authentication
│   ├── User-scoped farmer, planting, and harvest APIs
│   ├── Admin-only year and fruit master data APIs
│   ├── Dashboard aggregation API
│   └── CSV import/export APIs
│
├── Frontend: Next.js 16 + React 18
│   ├── Landing/Login
│   ├── User dashboard
│   ├── Admin center
│   ├── Thailand planting map
│   └── Import/export workflow
│
└── Local Database: SQLite
    ├── Demo user data
    ├── Harvest years
    ├── Fruit crops
    ├── Farmer profiles
    ├── Plantings
    └── Harvest records
```

## Data Model

| Model | Purpose |
| --- | --- |
| `HarvestYear` | ปีสำหรับผูกกับรายการเก็บเกี่ยว |
| `FruitCrop` | master data ผลไม้ หมวดหมู่ และสีประจำผลไม้ |
| `UserProfile` | โปรไฟล์ผู้ใช้งาน dashboard |
| `FarmerProfile` | ข้อมูลเกษตรกร เบอร์โทร หมู่บ้าน ที่อยู่ และรูป |
| `Planting` | แปลงปลูก ผลไม้ สายพันธุ์ พื้นที่ และตำแหน่ง |
| `HarvestRecord` | ผลผลิตต่อปี ปริมาณ ราคา วันที่เก็บเกี่ยว และรายได้ |

## Tech Stack

| Layer | Tools |
| --- | --- |
| Backend | Django 5.1, Django REST Framework, django-cors-headers |
| Frontend | Next.js 16, React 18, Tailwind CSS, custom CSS |
| Visualization | Recharts, D3, Thailand SVG map |
| Icons/UX | lucide-react, sonner toast |
| Database | SQLite for local development |
| Tests | Django TestCase, Node test runner, ESLint |

## Quick Start

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_harvest_demo
python manage.py runserver 8000
```

Backend API will be available at:

```text
http://localhost:8000/api/v1
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Demo Accounts

| Role | Username | Password | Destination |
| --- | --- | --- | --- |
| User | `demo` | `demo1234` | Dashboard |
| Admin | `admin` | `admin1234` | Admin Center |

## Environment

The frontend reads the API base URL from:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
```

Useful backend environment variables:

| Variable | Default |
| --- | --- |
| `DJANGO_SECRET_KEY` | `dev-only-harvest-data-secret-key` |
| `DJANGO_DEBUG` | `1` |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` |
| `DJANGO_CORS_ALLOWED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` |

## API Overview

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/v1/auth/login/` | Login with Django session |
| `POST` | `/api/v1/auth/logout/` | Logout current session |
| `GET/PATCH` | `/api/v1/auth/me/` | Current user and profile |
| `GET` | `/api/v1/dashboard/` | Aggregated dashboard metrics |
| `GET` | `/api/v1/years/` | Harvest year master data |
| `GET` | `/api/v1/fruits/` | Fruit crop master data |
| `GET/POST/PATCH/DELETE` | `/api/v1/farmers/` | Farmer profiles |
| `GET/POST/PATCH/DELETE` | `/api/v1/plantings/` | Planting records |
| `GET/POST/PATCH/DELETE` | `/api/v1/harvests/` | Harvest records |
| `GET` | `/api/v1/data-transfer/template/` | Download CSV template ZIP |
| `GET` | `/api/v1/data-transfer/export/` | Export CSV/ZIP |
| `POST` | `/api/v1/data-transfer/import/` | Preview or commit CSV import |

## Import/Export Workflow

HarvestData includes a practical data migration workflow for spreadsheet-heavy teams.

1. Download the import template ZIP from the dashboard.
2. Clean data in `farmers.csv`, `plantings.csv`, or `harvests.csv`.
3. Import in this order: farmers, plantings, harvests.
4. Preview errors before committing.
5. Download the error report CSV when rows fail validation.
6. Commit only valid rows.
7. Export filtered CSV or a full ZIP whenever needed.

Import limits:

| Limit | Value |
| --- | --- |
| Max file size | `2 MB` |
| Max rows per import | `1000` |
| Date format | `YYYY-MM-DD` |
| Number format | Plain numbers such as `1250.50` |

## Quality Checks

Run backend checks:

```bash
cd backend
source .venv/bin/activate
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test Farmer
```

Run frontend checks:

```bash
cd frontend
npm run lint
npm test
npm run build
```

Current coverage focuses on:

- Dashboard aggregation and user scoping
- Login-protected dashboard access
- Admin-only master data writes
- CSV template download
- Farmer, planting, and harvest import
- Import file size and row limits
- Export scoping
- Frontend API pagination helper

## Project Structure

```text
.
├── README.md
├── backend
│   ├── manage.py
│   ├── PlantData3
│   │   ├── settings.py
│   │   └── urls.py
│   └── Farmer
│       ├── models.py
│       ├── serializers.py
│       ├── views.py
│       ├── tests.py
│       ├── migrations
│       └── management/commands/seed_harvest_demo.py
└── frontend
    ├── app
    │   ├── api-client.mjs
    │   ├── page.js
    │   ├── login/page.js
    │   ├── admin/page.js
    │   └── globals.css
    ├── public/landing
    │   ├── harvest-satellite-hero.png
    │   ├── dashboard-preview.png
    │   ├── dashboard-light-preview.png
    │   └── dashboard-mobile-preview.png
    └── package.json
```

## Notes

- The dashboard requires the Django API and an authenticated session.
- Local demo data is created with `python manage.py seed_harvest_demo`.
- Regular users can read master data, while admin users can create/update/delete years and fruits.
- User-owned farmers, plantings, and harvest records are scoped by the logged-in user.
