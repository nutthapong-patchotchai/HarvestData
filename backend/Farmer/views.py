import csv
import io
import json
import zipfile
from datetime import date
from decimal import Decimal
from decimal import InvalidOperation

from django.contrib.auth import authenticate, login, logout
from django.db import transaction
from django.db.models import Avg, Count, DecimalField, ExpressionWrapper, F, Sum, Value
from django.db.models.functions import Coalesce
from django.http import HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import renderers, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import SAFE_METHODS, AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from Farmer.models import FarmerProfile, FruitCrop, HarvestRecord, HarvestYear, Planting, UserProfile
from Farmer.serializers import (
    FarmerProfileSerializer,
    FruitCropSerializer,
    HarvestRecordSerializer,
    HarvestYearSerializer,
    PlantingSerializer,
)


def decimal_to_float(value):
    return float(value or 0)


class FileDownloadRenderer(renderers.BaseRenderer):
    media_type = "*/*"
    format = "download"
    charset = None

    def render(self, data, accepted_media_type=None, renderer_context=None):
        if data is None:
            return b""
        if isinstance(data, bytes):
            return data
        return json.dumps(data, ensure_ascii=False).encode("utf-8")


FARMER_HEADERS = ["first_name", "last_name", "age", "phone", "village", "address"]
PLANTING_HEADERS = [
    "farmer_first_name",
    "farmer_last_name",
    "farmer_phone",
    "fruit_name",
    "variety",
    "area_rai",
    "planted_at",
    "province",
    "district",
    "subdistrict",
    "note",
]
HARVEST_HEADERS = [
    "farmer_first_name",
    "farmer_last_name",
    "farmer_phone",
    "fruit_name",
    "variety",
    "year",
    "quantity_kg",
    "price_per_kg",
    "harvested_at",
    "note",
]
DATASET_HEADERS = {
    "farmers": FARMER_HEADERS,
    "plantings": PLANTING_HEADERS,
    "harvests": HARVEST_HEADERS,
}
MAX_IMPORT_FILE_SIZE = 2 * 1024 * 1024
MAX_IMPORT_ROWS = 1000
IMPORT_README = """HarvestData import template

Workflow:
1. Clean data in farmers.csv, plantings.csv, or harvests.csv before import.
2. Import farmers first, then plantings, then harvests.
3. Upload one CSV at a time in the dashboard import/export page.
4. Preview errors before committing. Rows with errors will be skipped.

Required cleanup rules:
- Keep column names exactly as provided in this template.
- Dates must use YYYY-MM-DD, for example 2026-05-03.
- Numeric fields must be plain numbers without units, for example 1250.50.
- fruit_name must already exist in master data.
- harvest year must already exist in master data.
- plantings and harvests match farmers by first name, last name, and phone.
- To avoid ambiguous matches, include farmer_phone when possible.
- For harvests, one planting can have only one harvest record per year.

Recommended import order:
farmers.csv -> plantings.csv -> harvests.csv
"""


def clean_cell(row, field):
    return str(row.get(field) or "").strip()


def import_limits_payload():
    return {
        "max_file_size_bytes": MAX_IMPORT_FILE_SIZE,
        "max_file_size_mb": round(MAX_IMPORT_FILE_SIZE / 1024 / 1024, 1),
        "max_rows": MAX_IMPORT_ROWS,
    }


def parse_decimal(value, field_label, errors, required=False, min_value=None):
    text = str(value or "").strip().replace(",", "")
    if not text:
        if required:
            errors.append(f"{field_label} จำเป็นต้องมีค่า")
        return None
    try:
        number = Decimal(text)
    except InvalidOperation:
        errors.append(f"{field_label} ต้องเป็นตัวเลข")
        return None
    if min_value is not None and number < Decimal(str(min_value)):
        errors.append(f"{field_label} ต้องไม่น้อยกว่า {min_value}")
    return number


def parse_int(value, field_label, errors, required=False, min_value=None):
    text = str(value or "").strip()
    if not text:
        if required:
            errors.append(f"{field_label} จำเป็นต้องมีค่า")
        return None
    try:
        number = int(text)
    except ValueError:
        errors.append(f"{field_label} ต้องเป็นตัวเลขจำนวนเต็ม")
        return None
    if min_value is not None and number < min_value:
        errors.append(f"{field_label} ต้องไม่น้อยกว่า {min_value}")
    return number


def parse_date(value, field_label, errors):
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text)
    except ValueError:
        errors.append(f"{field_label} ต้องเป็นรูปแบบ YYYY-MM-DD")
        return None


def csv_text(headers, rows):
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=headers, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    return output.getvalue()


def csv_http_response(filename, headers, rows):
    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    response.write("\ufeff")
    response.write(csv_text(headers, rows))
    return response


def zip_http_response(filename, files):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for path, content in files.items():
            archive.writestr(path, content)
    response = HttpResponse(buffer.getvalue(), content_type="application/zip")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def decode_csv_upload(upload):
    raw = upload.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("utf-8-sig", errors="replace")
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    return reader


def find_farmer(user, first_name, last_name="", phone="", village=""):
    queryset = FarmerProfile.objects.filter(user=user, first_name__iexact=first_name)
    if last_name:
        queryset = queryset.filter(last_name__iexact=last_name)
    if phone:
        queryset = queryset.filter(phone=phone)
    elif village:
        queryset = queryset.filter(village__iexact=village)
    return queryset.first()


def resolve_farmer(user, row, errors):
    first_name = clean_cell(row, "farmer_first_name")
    last_name = clean_cell(row, "farmer_last_name")
    phone = clean_cell(row, "farmer_phone")

    if not first_name:
        errors.append("farmer_first_name จำเป็นต้องมีค่า")
        return None

    queryset = FarmerProfile.objects.filter(user=user, first_name__iexact=first_name)
    if last_name:
        queryset = queryset.filter(last_name__iexact=last_name)
    if phone:
        queryset = queryset.filter(phone=phone)

    count = queryset.count()
    if count == 0:
        errors.append("ไม่พบเกษตรกรที่ตรงกับ first_name/last_name/phone")
        return None
    if count > 1:
        errors.append("พบเกษตรกรมากกว่า 1 รายการ กรุณาใส่ farmer_phone ให้ระบุชัด")
        return None
    return queryset.first()


def row_status(row_number, dataset, errors, action, data=None):
    return {
        "row": row_number,
        "dataset": dataset,
        "status": "error" if errors else "valid",
        "action": "" if errors else action,
        "errors": errors,
        "data": data or {},
    }


def validate_farmer_import(user, row, row_number, commit=False):
    errors = []
    first_name = clean_cell(row, "first_name")
    last_name = clean_cell(row, "last_name")
    phone = clean_cell(row, "phone")
    village = clean_cell(row, "village")
    data = {
        "first_name": first_name,
        "last_name": last_name,
        "age": parse_int(clean_cell(row, "age"), "age", errors, min_value=0),
        "phone": phone,
        "village": village,
        "address": clean_cell(row, "address"),
    }
    if not first_name:
        errors.append("first_name จำเป็นต้องมีค่า")

    existing = None if errors else find_farmer(user, first_name, last_name, phone, village)
    action_name = "update" if existing else "create"

    if commit and not errors:
        farmer = existing or FarmerProfile(user=user)
        for field, value in data.items():
            setattr(farmer, field, value if value is not None else None)
        farmer.save()

    return row_status(row_number, "farmers", errors, action_name, data)


def validate_planting_import(user, row, row_number, commit=False):
    errors = []
    farmer = resolve_farmer(user, row, errors)
    fruit_name = clean_cell(row, "fruit_name")
    fruit = None
    if not fruit_name:
        errors.append("fruit_name จำเป็นต้องมีค่า")
    else:
        fruit = FruitCrop.objects.filter(name__iexact=fruit_name).first()
        if not fruit:
            errors.append("ไม่พบ fruit_name ใน master data")

    variety = clean_cell(row, "variety")
    data = {
        "variety": variety,
        "area_rai": parse_decimal(clean_cell(row, "area_rai"), "area_rai", errors, min_value=0) or Decimal("0.00"),
        "planted_at": parse_date(clean_cell(row, "planted_at"), "planted_at", errors),
        "province": clean_cell(row, "province"),
        "district": clean_cell(row, "district"),
        "subdistrict": clean_cell(row, "subdistrict"),
        "note": clean_cell(row, "note"),
    }

    existing = None
    if not errors:
        existing = Planting.objects.filter(user=user, farmer=farmer, fruit=fruit, variety=variety).first()
    action_name = "update" if existing else "create"

    if commit and not errors:
        planting = existing or Planting(user=user, farmer=farmer, fruit=fruit)
        for field, value in data.items():
            setattr(planting, field, value)
        planting.save()

    preview = {
        "farmer": farmer.full_name if farmer else "",
        "fruit": fruit.name if fruit else fruit_name,
        **data,
    }
    return row_status(row_number, "plantings", errors, action_name, preview)


def validate_harvest_import(user, row, row_number, commit=False):
    errors = []
    farmer = resolve_farmer(user, row, errors)
    fruit_name = clean_cell(row, "fruit_name")
    fruit = FruitCrop.objects.filter(name__iexact=fruit_name).first() if fruit_name else None
    if not fruit_name:
        errors.append("fruit_name จำเป็นต้องมีค่า")
    elif not fruit:
        errors.append("ไม่พบ fruit_name ใน master data")

    variety = clean_cell(row, "variety")
    planting = None
    if farmer and fruit:
        plantings = Planting.objects.filter(user=user, farmer=farmer, fruit=fruit, variety=variety)
        if plantings.count() == 0:
            errors.append("ไม่พบแปลงปลูกที่ตรงกับเกษตรกร/ผลไม้/สายพันธุ์")
        elif plantings.count() > 1:
            errors.append("พบแปลงปลูกซ้ำ กรุณาทำข้อมูลแปลงให้ไม่กำกวมก่อนนำเข้า")
        else:
            planting = plantings.first()

    year_value = parse_int(clean_cell(row, "year"), "year", errors, required=True, min_value=1900)
    harvest_year = None
    if year_value:
        harvest_year = HarvestYear.objects.filter(year=year_value).first()
        if not harvest_year:
            errors.append("ไม่พบ year ใน master data")

    data = {
        "quantity_kg": parse_decimal(clean_cell(row, "quantity_kg"), "quantity_kg", errors, required=True, min_value=0),
        "price_per_kg": parse_decimal(clean_cell(row, "price_per_kg"), "price_per_kg", errors, required=True, min_value=0),
        "harvested_at": parse_date(clean_cell(row, "harvested_at"), "harvested_at", errors),
        "note": clean_cell(row, "note"),
    }

    existing = None
    if not errors:
        existing = HarvestRecord.objects.filter(user=user, planting=planting, harvest_year=harvest_year).first()
    action_name = "update" if existing else "create"

    if commit and not errors:
        harvest = existing or HarvestRecord(user=user, planting=planting, harvest_year=harvest_year)
        for field, value in data.items():
            setattr(harvest, field, value)
        harvest.save()

    preview = {
        "farmer": farmer.full_name if farmer else "",
        "fruit": fruit.name if fruit else fruit_name,
        "variety": variety,
        "year": year_value,
        **data,
    }
    return row_status(row_number, "harvests", errors, action_name, preview)


def is_admin_user(user):
    return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser))


def get_user_profile(user):
    profile, _ = UserProfile.objects.get_or_create(user=user)
    return profile


def user_payload(user):
    profile = get_user_profile(user)
    return {
        "is_authenticated": True,
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "name": user.get_full_name() or user.username,
        "is_admin": is_admin_user(user),
        "avatar": profile.avatar,
        "phone": profile.phone,
        "bio": profile.bio,
    }


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return is_admin_user(request.user)


class SessionLoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username") or request.data.get("email")
        password = request.data.get("password")
        user = authenticate(request, username=username, password=password)

        if user is None:
            return Response(
                {"detail": "Invalid username or password."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        login(request, user)
        return Response(user_payload(user))


class SessionLogoutView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CurrentUserView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        if not request.user.is_authenticated:
            return Response({"is_authenticated": False})

        return Response(user_payload(request.user))

    def patch(self, request):
        if not request.user.is_authenticated:
            return Response({"detail": "Authentication credentials were not provided."}, status=status.HTTP_403_FORBIDDEN)

        user = request.user
        profile = get_user_profile(user)

        for field in ["first_name", "last_name", "email"]:
            if field in request.data:
                setattr(user, field, request.data.get(field) or "")
        user.save(update_fields=["first_name", "last_name", "email"])

        for field in ["avatar", "phone", "bio"]:
            if field in request.data:
                setattr(profile, field, request.data.get(field) or "")
        profile.save()

        return Response(user_payload(user))


class UserScopedViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        return queryset.filter(user=user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class HarvestYearViewSet(viewsets.ModelViewSet):
    queryset = HarvestYear.objects.all()
    serializer_class = HarvestYearSerializer
    permission_classes = [IsAdminOrReadOnly]
    search_fields = ["year"]


class FruitCropViewSet(viewsets.ModelViewSet):
    queryset = FruitCrop.objects.all()
    serializer_class = FruitCropSerializer
    permission_classes = [IsAdminOrReadOnly]
    search_fields = ["name", "category"]


class FarmerProfileViewSet(UserScopedViewSet):
    queryset = FarmerProfile.objects.select_related("user").all()
    serializer_class = FarmerProfileSerializer
    search_fields = ["first_name", "last_name", "phone", "village"]


class PlantingViewSet(UserScopedViewSet):
    queryset = Planting.objects.select_related("farmer", "fruit", "user").all()
    serializer_class = PlantingSerializer
    search_fields = [
        "variety",
        "farmer__first_name",
        "farmer__last_name",
        "fruit__name",
        "province",
        "district",
        "subdistrict",
    ]

    def get_queryset(self):
        queryset = super().get_queryset()
        fruit = self.request.query_params.get("fruit")
        farmer = self.request.query_params.get("farmer")
        province = self.request.query_params.get("province")

        if fruit:
            queryset = queryset.filter(fruit_id=fruit)
        if farmer:
            queryset = queryset.filter(farmer_id=farmer)
        if province:
            queryset = queryset.filter(province=province)

        return queryset

    @action(detail=True, methods=["get"])
    def harvests(self, request, pk=None):
        planting = self.get_object()
        harvests = planting.harvests.select_related(
            "harvest_year",
            "planting__farmer",
            "planting__fruit",
        )
        serializer = HarvestRecordSerializer(harvests, many=True, context={"request": request})
        return Response(serializer.data)


class HarvestRecordViewSet(UserScopedViewSet):
    queryset = HarvestRecord.objects.select_related(
        "harvest_year",
        "planting",
        "planting__farmer",
        "planting__fruit",
        "user",
    ).all()
    serializer_class = HarvestRecordSerializer
    search_fields = ["planting__farmer__first_name", "planting__fruit__name", "planting__variety"]

    def get_queryset(self):
        queryset = super().get_queryset()
        year = self.request.query_params.get("year")
        fruit = self.request.query_params.get("fruit")
        farmer = self.request.query_params.get("farmer")

        if year:
            queryset = queryset.filter(harvest_year__year=year)
        if fruit:
            queryset = queryset.filter(planting__fruit_id=fruit)
        if farmer:
            queryset = queryset.filter(planting__farmer_id=farmer)

        return queryset


class DataTransferTemplateView(APIView):
    permission_classes = [IsAuthenticated]
    renderer_classes = [renderers.JSONRenderer, renderers.BrowsableAPIRenderer, FileDownloadRenderer]

    def get(self, request):
        files = {
            "README.txt": IMPORT_README,
            "farmers.csv": csv_text(
                FARMER_HEADERS,
                [
                    {
                        "first_name": "มาลี",
                        "last_name": "ใจดี",
                        "age": "42",
                        "phone": "0812345678",
                        "village": "บ้านสวนเหนือ",
                        "address": "ต.เมือง อ.เมือง จ.เชียงใหม่",
                    }
                ],
            ),
            "plantings.csv": csv_text(
                PLANTING_HEADERS,
                [
                    {
                        "farmer_first_name": "มาลี",
                        "farmer_last_name": "ใจดี",
                        "farmer_phone": "0812345678",
                        "fruit_name": "มะม่วง",
                        "variety": "น้ำดอกไม้",
                        "area_rai": "4.50",
                        "planted_at": "2023-06-01",
                        "province": "เชียงใหม่",
                        "district": "เมืองเชียงใหม่",
                        "subdistrict": "สุเทพ",
                        "note": "ตัวอย่างแปลงปลูก",
                    }
                ],
            ),
            "harvests.csv": csv_text(
                HARVEST_HEADERS,
                [
                    {
                        "farmer_first_name": "มาลี",
                        "farmer_last_name": "ใจดี",
                        "farmer_phone": "0812345678",
                        "fruit_name": "มะม่วง",
                        "variety": "น้ำดอกไม้",
                        "year": "2026",
                        "quantity_kg": "1200.50",
                        "price_per_kg": "32.50",
                        "harvested_at": "2026-04-20",
                        "note": "ตัวอย่างผลผลิต",
                    }
                ],
            ),
        }
        return zip_http_response("harvestdata-import-template.zip", files)


class DataTransferExportView(APIView):
    permission_classes = [IsAuthenticated]
    renderer_classes = [renderers.JSONRenderer, renderers.BrowsableAPIRenderer, FileDownloadRenderer]

    def farmer_rows(self, request):
        farmers = FarmerProfile.objects.filter(user=request.user).order_by("first_name", "last_name")
        return [
            {
                "first_name": farmer.first_name,
                "last_name": farmer.last_name,
                "age": farmer.age or "",
                "phone": farmer.phone,
                "village": farmer.village,
                "address": farmer.address,
            }
            for farmer in farmers
        ]

    def planting_rows(self, request):
        plantings = Planting.objects.select_related("farmer", "fruit").filter(user=request.user)
        fruit = request.query_params.get("fruit")
        farmer = request.query_params.get("farmer")
        if fruit:
            plantings = plantings.filter(fruit_id=fruit)
        if farmer:
            plantings = plantings.filter(farmer_id=farmer)
        plantings = plantings.order_by("farmer__first_name", "fruit__name", "variety")
        return [
            {
                "farmer_first_name": planting.farmer.first_name,
                "farmer_last_name": planting.farmer.last_name,
                "farmer_phone": planting.farmer.phone,
                "fruit_name": planting.fruit.name,
                "variety": planting.variety,
                "area_rai": planting.area_rai,
                "planted_at": planting.planted_at.isoformat() if planting.planted_at else "",
                "province": planting.province,
                "district": planting.district,
                "subdistrict": planting.subdistrict,
                "note": planting.note,
            }
            for planting in plantings
        ]

    def harvest_rows(self, request):
        harvests = HarvestRecord.objects.select_related(
            "harvest_year",
            "planting",
            "planting__farmer",
            "planting__fruit",
        ).filter(user=request.user)
        year = request.query_params.get("year")
        fruit = request.query_params.get("fruit")
        farmer = request.query_params.get("farmer")
        if year:
            harvests = harvests.filter(harvest_year__year=year)
        if fruit:
            harvests = harvests.filter(planting__fruit_id=fruit)
        if farmer:
            harvests = harvests.filter(planting__farmer_id=farmer)
        harvests = harvests.order_by("-harvest_year__year", "planting__farmer__first_name", "planting__fruit__name")
        return [
            {
                "farmer_first_name": harvest.planting.farmer.first_name,
                "farmer_last_name": harvest.planting.farmer.last_name,
                "farmer_phone": harvest.planting.farmer.phone,
                "fruit_name": harvest.planting.fruit.name,
                "variety": harvest.planting.variety,
                "year": harvest.harvest_year.year,
                "quantity_kg": harvest.quantity_kg,
                "price_per_kg": harvest.price_per_kg,
                "harvested_at": harvest.harvested_at.isoformat() if harvest.harvested_at else "",
                "note": harvest.note,
            }
            for harvest in harvests
        ]

    def get(self, request):
        dataset = request.query_params.get("dataset", "all")
        if dataset not in {"all", "farmers", "plantings", "harvests"}:
            return Response({"detail": "Invalid dataset."}, status=status.HTTP_400_BAD_REQUEST)

        if dataset == "farmers":
            return csv_http_response("harvestdata-farmers.csv", FARMER_HEADERS, self.farmer_rows(request))
        if dataset == "plantings":
            return csv_http_response("harvestdata-plantings.csv", PLANTING_HEADERS, self.planting_rows(request))
        if dataset == "harvests":
            return csv_http_response("harvestdata-harvests.csv", HARVEST_HEADERS, self.harvest_rows(request))

        files = {
            "farmers.csv": csv_text(FARMER_HEADERS, self.farmer_rows(request)),
            "plantings.csv": csv_text(PLANTING_HEADERS, self.planting_rows(request)),
            "harvests.csv": csv_text(HARVEST_HEADERS, self.harvest_rows(request)),
        }
        return zip_http_response("harvestdata-export.zip", files)


class DataTransferImportView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    validators = {
        "farmers": validate_farmer_import,
        "plantings": validate_planting_import,
        "harvests": validate_harvest_import,
    }

    def post(self, request):
        dataset = request.data.get("dataset")
        upload = request.FILES.get("file")
        commit = str(request.data.get("commit", "")).lower() in {"1", "true", "yes"}

        if dataset not in DATASET_HEADERS:
            return Response({"detail": "Invalid dataset."}, status=status.HTTP_400_BAD_REQUEST)
        if not upload:
            return Response({"detail": "CSV file is required."}, status=status.HTTP_400_BAD_REQUEST)
        if upload.size and upload.size > MAX_IMPORT_FILE_SIZE:
            return Response(
                {
                    "detail": "CSV file is too large.",
                    "limits": import_limits_payload(),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        reader = decode_csv_upload(upload)
        headers = set(reader.fieldnames or [])
        required_headers = set(DATASET_HEADERS[dataset])
        missing_headers = sorted(required_headers - headers)
        if missing_headers:
            return Response(
                {
                    "detail": "Missing required columns.",
                    "missing_columns": missing_headers,
                    "expected_columns": DATASET_HEADERS[dataset],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        validator = self.validators[dataset]
        data_rows = []
        skipped_blank_rows = 0
        for index, row in enumerate(reader, start=2):
            if not any(clean_cell(row, field) for field in DATASET_HEADERS[dataset]):
                skipped_blank_rows += 1
                continue
            data_rows.append((index, row))
            if len(data_rows) > MAX_IMPORT_ROWS:
                return Response(
                    {
                        "detail": "CSV row limit exceeded.",
                        "limits": import_limits_payload(),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        results = []
        with transaction.atomic():
            for index, row in data_rows:
                results.append(validator(request.user, row, index, commit=commit))

        valid_count = sum(1 for item in results if item["status"] == "valid")
        error_count = sum(1 for item in results if item["status"] == "error")
        action_counts = {}
        for item in results:
            if item["status"] == "valid":
                action_counts[item["action"]] = action_counts.get(item["action"], 0) + 1

        return Response(
            {
                "dataset": dataset,
                "committed": commit,
                "summary": {
                    "total_rows": len(results),
                    "valid_rows": valid_count,
                    "error_rows": error_count,
                    "skipped_blank_rows": skipped_blank_rows,
                    "actions": action_counts,
                },
                "limits": import_limits_payload(),
                "rows": results,
            }
        )


class DashboardSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        harvests = HarvestRecord.objects.select_related(
            "harvest_year",
            "planting",
            "planting__farmer",
            "planting__fruit",
        )
        plantings = Planting.objects.select_related("farmer", "fruit")
        farmers = FarmerProfile.objects.all()

        harvests = harvests.filter(user=request.user)
        plantings = plantings.filter(user=request.user)
        farmers = farmers.filter(user=request.user)

        decimal_field = DecimalField(max_digits=18, decimal_places=2)
        zero = Value(Decimal("0.00"), output_field=decimal_field)

        all_harvests = harvests.annotate(
            row_revenue=ExpressionWrapper(
                F("quantity_kg") * F("price_per_kg"),
                output_field=decimal_field,
            )
        )

        active_years = list(
            all_harvests.values_list("harvest_year__year", flat=True)
            .distinct()
            .order_by("-harvest_year__year")
        )

        year = request.query_params.get("year")
        harvests = all_harvests
        if year:
            harvests = harvests.filter(harvest_year__year=year)

        def revenue_sum():
            return Sum("row_revenue", output_field=decimal_field)

        totals = harvests.aggregate(
            total_quantity_kg=Coalesce(Sum("quantity_kg"), zero, output_field=decimal_field),
            total_revenue=Coalesce(revenue_sum(), zero, output_field=decimal_field),
            average_price=Coalesce(Avg("price_per_kg"), zero, output_field=decimal_field),
        )

        by_year = harvests.values("harvest_year__year").annotate(
            quantity_kg=Coalesce(Sum("quantity_kg"), zero, output_field=decimal_field),
            revenue=Coalesce(revenue_sum(), zero, output_field=decimal_field),
            average_price=Coalesce(Avg("price_per_kg"), zero, output_field=decimal_field),
        ).order_by("harvest_year__year")

        by_fruit = harvests.values(
            "planting__fruit_id",
            "planting__fruit__name",
            "planting__fruit__color",
        ).annotate(
            quantity_kg=Coalesce(Sum("quantity_kg"), zero, output_field=decimal_field),
            revenue=Coalesce(revenue_sum(), zero, output_field=decimal_field),
            harvest_count=Count("id"),
        ).order_by("-revenue")

        product_by_year = harvests.values(
            "harvest_year__year",
            "planting__fruit_id",
            "planting__fruit__name",
            "planting__fruit__color",
        ).annotate(
            quantity_kg=Coalesce(Sum("quantity_kg"), zero, output_field=decimal_field),
            revenue=Coalesce(revenue_sum(), zero, output_field=decimal_field),
            average_price=Coalesce(Avg("price_per_kg"), zero, output_field=decimal_field),
        ).order_by("harvest_year__year", "planting__fruit__name")

        farmer_trends = all_harvests.values(
            "planting__farmer_id",
            "planting__farmer__first_name",
            "planting__farmer__last_name",
            "planting__farmer__photo",
            "harvest_year__year",
            "planting__fruit_id",
            "planting__fruit__name",
            "planting__fruit__color",
        ).annotate(
            quantity_kg=Coalesce(Sum("quantity_kg"), zero, output_field=decimal_field),
            revenue=Coalesce(revenue_sum(), zero, output_field=decimal_field),
            average_price=Coalesce(Avg("price_per_kg"), zero, output_field=decimal_field),
        ).order_by(
            "planting__farmer__first_name",
            "planting__farmer__last_name",
            "harvest_year__year",
            "planting__fruit__name",
        )

        top_farmers = harvests.values(
            "planting__farmer_id",
            "planting__farmer__first_name",
            "planting__farmer__last_name",
            "planting__farmer__village",
            "planting__farmer__photo",
        ).annotate(
            quantity_kg=Coalesce(Sum("quantity_kg"), zero, output_field=decimal_field),
            revenue=Coalesce(revenue_sum(), zero, output_field=decimal_field),
        ).order_by("-revenue")[:5]

        recent_harvests = harvests.order_by("-updated_at")[:8]

        planting_locations = plantings.values(
            "province",
            "district",
            "subdistrict",
            "farmer_id",
            "farmer__first_name",
            "farmer__last_name",
        ).annotate(
            planting_count=Count("id"),
            area_rai=Coalesce(Sum("area_rai"), zero, output_field=decimal_field),
        ).order_by("province", "district", "farmer__first_name")

        return Response(
            {
                "totals": {
                    "farmers": farmers.count(),
                    "plantings": plantings.count(),
                    "harvests": harvests.count(),
                    "quantity_kg": decimal_to_float(totals["total_quantity_kg"]),
                    "revenue": decimal_to_float(totals["total_revenue"]),
                    "average_price": decimal_to_float(totals["average_price"]),
                },
                "harvest_by_year": [
                    {
                        "year": item["harvest_year__year"],
                        "quantity_kg": decimal_to_float(item["quantity_kg"]),
                        "revenue": decimal_to_float(item["revenue"]),
                        "average_price": decimal_to_float(item["average_price"]),
                    }
                    for item in by_year
                ],
                "fruit_breakdown": [
                    {
                        "id": item["planting__fruit_id"],
                        "name": item["planting__fruit__name"],
                        "color": item["planting__fruit__color"],
                        "quantity_kg": decimal_to_float(item["quantity_kg"]),
                        "revenue": decimal_to_float(item["revenue"]),
                        "harvest_count": item["harvest_count"],
                    }
                    for item in by_fruit
                ],
                "product_trends": [
                    {
                        "year": item["harvest_year__year"],
                        "product_id": item["planting__fruit_id"],
                        "product_name": item["planting__fruit__name"],
                        "color": item["planting__fruit__color"],
                        "quantity_kg": decimal_to_float(item["quantity_kg"]),
                        "revenue": decimal_to_float(item["revenue"]),
                        "average_price": decimal_to_float(item["average_price"]),
                    }
                    for item in product_by_year
                ],
                "active_years": active_years,
                "farmer_trends": [
                    {
                        "farmer_id": item["planting__farmer_id"],
                        "farmer_name": " ".join(
                            part
                            for part in [
                                item["planting__farmer__first_name"],
                                item["planting__farmer__last_name"],
                            ]
                            if part
                        ),
                        "farmer_photo": item["planting__farmer__photo"],
                        "year": item["harvest_year__year"],
                        "product_id": item["planting__fruit_id"],
                        "product_name": item["planting__fruit__name"],
                        "color": item["planting__fruit__color"],
                        "quantity_kg": decimal_to_float(item["quantity_kg"]),
                        "revenue": decimal_to_float(item["revenue"]),
                        "average_price": decimal_to_float(item["average_price"]),
                    }
                    for item in farmer_trends
                ],
                "top_farmers": [
                    {
                        "id": item["planting__farmer_id"],
                        "name": " ".join(
                            part
                            for part in [
                                item["planting__farmer__first_name"],
                                item["planting__farmer__last_name"],
                            ]
                            if part
                        ),
                        "village": item["planting__farmer__village"],
                        "photo": item["planting__farmer__photo"],
                        "quantity_kg": decimal_to_float(item["quantity_kg"]),
                        "revenue": decimal_to_float(item["revenue"]),
                    }
                    for item in top_farmers
                ],
                "planting_locations": [
                    {
                        "province": item["province"],
                        "district": item["district"],
                        "subdistrict": item["subdistrict"],
                        "farmer_id": item["farmer_id"],
                        "farmer_name": " ".join(
                            part
                            for part in [
                                item["farmer__first_name"],
                                item["farmer__last_name"],
                            ]
                            if part
                        ),
                        "planting_count": item["planting_count"],
                        "area_rai": decimal_to_float(item["area_rai"]),
                    }
                    for item in planting_locations
                    if item["province"]
                ],
                "recent_harvests": HarvestRecordSerializer(recent_harvests, many=True).data,
            }
        )
