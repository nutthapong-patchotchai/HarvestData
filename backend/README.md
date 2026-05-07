# HarvestData Backend

<p align="center">
  <strong>Django REST API สำหรับระบบจัดการข้อมูลสวนผลไม้ เกษตรกร แปลงปลูก ผลผลิต รายได้ และงานนำเข้า/ส่งออกข้อมูล</strong>
</p>

<p align="center">
  <img alt="Django" src="https://img.shields.io/badge/Django-5.1-0f5132?style=for-the-badge" />
  <img alt="Django REST Framework" src="https://img.shields.io/badge/DRF-3.15.2-8b1a1a?style=for-the-badge" />
  <img alt="SQLite" src="https://img.shields.io/badge/SQLite-local-2f5f98?style=for-the-badge" />
  <img alt="Timezone" src="https://img.shields.io/badge/TZ-Asia%2FBangkok-f59e0b?style=for-the-badge" />
</p>

HarvestData Backend คือหัวใจฝั่งข้อมูลของระบบ HarvestData ทำหน้าที่เก็บข้อมูล master data, โปรไฟล์เกษตรกร, แปลงปลูก, รายการเก็บเกี่ยว, dashboard aggregation, session authentication, สิทธิ์ admin และ data transfer workflow สำหรับทีมที่ยังทำงานกับ CSV/Spreadsheet เป็นหลัก

## Table of Contents

- [Backend at a Glance](#backend-at-a-glance)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Demo Accounts](#demo-accounts)
- [Environment Variables](#environment-variables)
- [Data Model](#data-model)
- [API Map](#api-map)
- [Import/Export Workflow](#importexport-workflow)
- [Validation & Permissions](#validation--permissions)
- [Quality Checks](#quality-checks)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)

## Backend at a Glance

| Area | Details |
| --- | --- |
| Framework | Django 5.1 + Django REST Framework |
| App | `Farmer` |
| Project config | `PlantData3` |
| Database | SQLite for local development |
| Auth | Django session auth + CSRF cookie |
| API prefix | `http://localhost:8000/api/v1` |
| Pagination | DRF page number pagination, page size `50` |
| Language/Timezone | `th`, `Asia/Bangkok` |
| Seed command | `python manage.py seed_harvest_demo` |

## Architecture

```text
Client Browser
    |
    |  session cookie + CSRF token
    v
Django REST Framework API
    |
    +-- auth/login, auth/logout, auth/me
    +-- dashboard aggregation
    +-- farmer / planting / harvest CRUD
    +-- harvest year / fruit master data
    +-- CSV template / export / import
    |
    v
SQLite Database
    |
    +-- user-owned operational data
    +-- admin-managed master data
    +-- demo harvest dataset
```

### Request Lifecycle

1. Frontend เรียก `/api/v1/auth/me/` เพื่อรับ CSRF cookie และเช็ก session
2. ผู้ใช้ login ผ่าน `/api/v1/auth/login/`
3. API ที่แก้ไขข้อมูลใช้ session cookie และ `X-CSRFToken`
4. รายการข้อมูลหลักถูกจำกัดตาม `request.user`
5. Dashboard API aggregate ข้อมูลเฉพาะบัญชีผู้ใช้ที่ล็อกอินอยู่

## Quick Start

### 1. Create Virtual Environment

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Prepare Database

```bash
python manage.py migrate
python manage.py seed_harvest_demo
```

### 4. Run API Server

```bash
python manage.py runserver 8000
```

API base URL:

```text
http://localhost:8000/api/v1
```

Django admin:

```text
http://localhost:8000/admin/
```

## Demo Accounts

Seed command จะสร้างบัญชีตัวอย่างให้พร้อมใช้งานทันที

| Role | Username | Password | Access |
| --- | --- | --- | --- |
| User | `demo` | `demo1234` | Dashboard, farmer/planting/harvest CRUD, import/export |
| Admin | `admin` | `admin1234` | Admin Center, harvest year master data, fruit master data |

## Environment Variables

Backend อ่านค่าจาก environment variables และมีค่า default สำหรับ local development

| Variable | Default | Purpose |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | `dev-only-harvest-data-secret-key` | Secret key สำหรับ dev |
| `DJANGO_DEBUG` | `1` | เปิด/ปิด debug mode |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Host ที่ Django รับ request |
| `DJANGO_CORS_ALLOWED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Frontend origins ที่แนบ cookie ได้ |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Origins ที่ผ่าน CSRF trusted check |

Example:

```bash
DJANGO_DEBUG=0 \
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,harvest.local \
python manage.py runserver 8000
```

## Data Model

```text
User
  |
  +-- UserProfile
  |
  +-- FarmerProfile
        |
        +-- Planting ---- FruitCrop
              |
              +-- HarvestRecord ---- HarvestYear
```

| Model | Purpose | Important Rules |
| --- | --- | --- |
| `HarvestYear` | ปีเก็บเกี่ยวที่ใช้เป็น master data | `year` unique |
| `FruitCrop` | master data ผลไม้ หมวดหมู่ และสี | `name` unique, `color` ต้องเป็น hex `#RRGGBB` |
| `UserProfile` | ข้อมูลเสริมของผู้ใช้ | avatar, phone, bio |
| `FarmerProfile` | ข้อมูลเกษตรกรในบัญชีผู้ใช้ | กันข้อมูลซ้ำด้วยชื่อ/นามสกุล/เบอร์/หมู่บ้าน |
| `Planting` | แปลงปลูกของเกษตรกร | พื้นที่ต้องไม่ติดลบ, ห้ามซ้ำ farmer + fruit + variety |
| `HarvestRecord` | ผลผลิตรายปีต่อแปลง | ปริมาณ/ราคาไม่ติดลบ, หนึ่งแปลงมีหนึ่ง record ต่อปี |

## API Map

All routes below are under:

```text
/api/v1
```

### Authentication

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/auth/login/` | Login ด้วย username/password และสร้าง session |
| `POST` | `/auth/logout/` | Logout session ปัจจุบัน |
| `GET` | `/auth/me/` | ข้อมูลผู้ใช้ปัจจุบัน, admin flag, profile, CSRF cookie |
| `PATCH` | `/auth/me/` | อัปเดตชื่อ อีเมล avatar phone bio |

### Dashboard

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/dashboard/` | totals, year trend, fruit breakdown, farmer trend, locations, recent harvests |
| `GET` | `/dashboard/?year=2026` | dashboard summary เฉพาะปี |

### Master Data

| Method | Route | Permission | Description |
| --- | --- | --- | --- |
| `GET` | `/years/` | Authenticated | อ่านปีเก็บเกี่ยว |
| `POST` | `/years/` | Admin only | เพิ่มปีเก็บเกี่ยว |
| `PATCH/DELETE` | `/years/{id}/` | Admin only | แก้ไข/ลบปีเก็บเกี่ยว |
| `GET` | `/fruits/` | Authenticated | อ่านข้อมูลผลไม้ |
| `POST` | `/fruits/` | Admin only | เพิ่มผลไม้ |
| `PATCH/DELETE` | `/fruits/{id}/` | Admin only | แก้ไข/ลบผลไม้ หมวดหมู่ สี |

### User-Scoped Records

| Method | Route | Description |
| --- | --- | --- |
| `GET/POST` | `/farmers/` | รายการ/เพิ่มเกษตรกรของผู้ใช้ |
| `GET/PATCH/DELETE` | `/farmers/{id}/` | อ่าน/แก้ไข/ลบเกษตรกร |
| `GET/POST` | `/plantings/` | รายการ/เพิ่มแปลงปลูก |
| `GET/PATCH/DELETE` | `/plantings/{id}/` | อ่าน/แก้ไข/ลบแปลงปลูก |
| `GET` | `/plantings/{id}/harvests/` | ผลผลิตทั้งหมดของแปลงนั้น |
| `GET/POST` | `/harvests/` | รายการ/เพิ่มผลผลิต |
| `GET/PATCH/DELETE` | `/harvests/{id}/` | อ่าน/แก้ไข/ลบผลผลิต |

Useful filters:

```text
/api/v1/plantings/?fruit=1
/api/v1/plantings/?farmer=12
/api/v1/plantings/?province=จันทบุรี
/api/v1/harvests/?year=2026
/api/v1/harvests/?fruit=1
/api/v1/harvests/?farmer=12
```

### Data Transfer

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/data-transfer/template/` | Download ZIP template: `README.txt`, `farmers.csv`, `plantings.csv`, `harvests.csv` |
| `GET` | `/data-transfer/export/?dataset=all` | Export ZIP รวมข้อมูลทั้งหมดของผู้ใช้ |
| `GET` | `/data-transfer/export/?dataset=farmers` | Export CSV เฉพาะเกษตรกร |
| `GET` | `/data-transfer/export/?dataset=plantings` | Export CSV เฉพาะแปลงปลูก |
| `GET` | `/data-transfer/export/?dataset=harvests` | Export CSV เฉพาะผลผลิต |
| `POST` | `/data-transfer/import/` | Preview หรือ commit CSV import |

## Import/Export Workflow

ระบบนี้ออกแบบให้ทำงานกับข้อมูลจาก spreadsheet ได้อย่างมีวินัย โดยทุก import จะ preview ก่อน commit ได้

### Import Order

```text
farmers.csv -> plantings.csv -> harvests.csv
```

### Import Limits

| Limit | Value |
| --- | --- |
| File size | `2 MB` |
| Rows per import | `1000` |
| Date format | `YYYY-MM-DD` |
| Number format | Plain number เช่น `1250.50` |

### Required CSV Headers

`farmers.csv`

```text
first_name,last_name,age,phone,village,address
```

`plantings.csv`

```text
farmer_first_name,farmer_last_name,farmer_phone,fruit_name,variety,area_rai,planted_at,province,district,subdistrict,note
```

`harvests.csv`

```text
farmer_first_name,farmer_last_name,farmer_phone,fruit_name,variety,year,quantity_kg,price_per_kg,harvested_at,note
```

### Multipart Import Example

Preview:

```bash
curl -X POST http://localhost:8000/api/v1/data-transfer/import/ \
  -b "sessionid=<session-id>; csrftoken=<csrf-token>" \
  -H "X-CSRFToken: <csrf-token>" \
  -F "dataset=farmers" \
  -F "commit=false" \
  -F "file=@farmers.csv"
```

Commit:

```bash
curl -X POST http://localhost:8000/api/v1/data-transfer/import/ \
  -b "sessionid=<session-id>; csrftoken=<csrf-token>" \
  -H "X-CSRFToken: <csrf-token>" \
  -F "dataset=farmers" \
  -F "commit=true" \
  -F "file=@farmers.csv"
```

## Validation & Permissions

### Permissions

| Resource | Regular User | Admin |
| --- | --- | --- |
| Dashboard | Read own data | Read own data |
| Farmers | CRUD own data | CRUD own data |
| Plantings | CRUD own data | CRUD own data |
| Harvests | CRUD own data | CRUD own data |
| Years | Read | CRUD |
| Fruits | Read | CRUD |
| Import/Export | Own data only | Own data only |

### Guardrails

- User-scoped viewsets filter data by `request.user`
- Planting cannot reference a farmer from another account
- Harvest cannot reference a planting from another account
- Regular user cannot write master data
- CSV export returns only data owned by the authenticated user
- CSV import validates headers, size, row count, required fields, numeric values, dates, ambiguous farmer matches, master data existence, and duplicates

## Quality Checks

Run Django checks:

```bash
cd backend
source .venv/bin/activate
python manage.py check
python manage.py makemigrations --check --dry-run
```

Run backend tests:

```bash
python manage.py test Farmer
```

Current test coverage focuses on:

- Dashboard aggregation
- Authentication requirement for dashboard
- User-scoped list APIs
- Admin-only master data writes
- Negative value validation
- Duplicate planting validation
- Import template ZIP
- Farmer, planting, and harvest CSV import
- Import file size and row limit
- Scoped harvest export

## Project Structure

```text
backend/
├── manage.py
├── requirements.txt
├── README.md
├── PlantData3/
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
└── Farmer/
    ├── models.py
    ├── serializers.py
    ├── views.py
    ├── tests.py
    ├── admin.py
    ├── forms.py
    ├── migrations/
    └── management/
        └── commands/
            └── seed_harvest_demo.py
```

## Troubleshooting

### Frontend login แล้วเด้งกลับหน้า login

เช็กว่า backend เปิดอยู่ที่ `http://localhost:8000` และ frontend ใช้ `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1`

### เจอ CSRF error ตอน POST/PATCH/DELETE

ให้เรียก `/api/v1/auth/me/` ก่อนเพื่อให้ Django set `csrftoken` แล้วแนบ header:

```text
X-CSRFToken: <csrftoken>
```

### Frontend ยิง API ไม่ผ่านเพราะ CORS

ตรวจ `DJANGO_CORS_ALLOWED_ORIGINS` และ `DJANGO_CSRF_TRUSTED_ORIGINS` ว่ามี origin ของ frontend เช่น `http://localhost:3000`

### ไม่มีข้อมูลใน dashboard

รัน seed demo:

```bash
python manage.py seed_harvest_demo
```

แล้ว login ด้วย:

```text
demo / demo1234
```

### Import CSV ไม่ผ่าน

เช็ก 5 จุดนี้ก่อน:

- ชื่อ columns ต้องตรง template
- import ตามลำดับ farmers -> plantings -> harvests
- `fruit_name` ต้องมีใน master data
- `year` ต้องมีใน master data
- date ต้องเป็น `YYYY-MM-DD`
