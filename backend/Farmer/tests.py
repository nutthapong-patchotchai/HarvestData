from decimal import Decimal
from io import BytesIO
from zipfile import ZipFile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from Farmer.models import FarmerProfile, FruitCrop, HarvestRecord, HarvestYear, Planting
from Farmer.views import MAX_IMPORT_FILE_SIZE, MAX_IMPORT_ROWS


class DashboardSummaryTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="orchard", password="pass12345")
        self.other_user = User.objects.create_user(username="other", password="pass12345")
        year = HarvestYear.objects.create(year=2026)
        self.next_year = HarvestYear.objects.create(year=2027)
        fruit = FruitCrop.objects.create(name="มะม่วง", category="ผลไม้เมืองร้อน")
        farmer = FarmerProfile.objects.create(user=self.user, first_name="มาลี")
        other_farmer = FarmerProfile.objects.create(user=self.other_user, first_name="สมชาย")
        planting = Planting.objects.create(
            user=self.user,
            farmer=farmer,
            fruit=fruit,
            variety="น้ำดอกไม้",
            area_rai=Decimal("4.50"),
        )
        self.year = year
        self.fruit = fruit
        self.farmer = farmer
        self.planting = planting
        other_planting = Planting.objects.create(
            user=self.other_user,
            farmer=other_farmer,
            fruit=fruit,
            variety="เขียวเสวย",
            area_rai=Decimal("7.00"),
        )
        HarvestRecord.objects.create(
            user=self.user,
            planting=planting,
            harvest_year=year,
            quantity_kg=Decimal("1200.00"),
            price_per_kg=Decimal("32.50"),
        )
        HarvestRecord.objects.create(
            user=self.other_user,
            planting=other_planting,
            harvest_year=year,
            quantity_kg=Decimal("9900.00"),
            price_per_kg=Decimal("99.00"),
        )

    def test_dashboard_summary_returns_aggregates(self):
        client = APIClient()
        client.force_authenticate(self.user)
        response = client.get("/api/v1/dashboard/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["totals"]["farmers"], 1)
        self.assertEqual(response.data["totals"]["quantity_kg"], 1200.0)
        self.assertEqual(response.data["fruit_breakdown"][0]["name"], "มะม่วง")

    def test_dashboard_requires_login(self):
        client = APIClient()
        response = client.get("/api/v1/dashboard/")

        self.assertEqual(response.status_code, 403)

    def test_farmer_list_is_scoped_to_current_user(self):
        client = APIClient()
        client.force_authenticate(self.user)
        response = client.get("/api/v1/farmers/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["first_name"], "มาลี")

    def test_regular_user_cannot_write_master_data(self):
        client = APIClient()
        client.force_authenticate(self.user)
        response = client.post(
            "/api/v1/fruits/",
            {"name": "ส้ม", "category": "ผลไม้เมืองร้อน", "color": "#f4a261"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_negative_harvest_values_are_rejected(self):
        client = APIClient()
        client.force_authenticate(self.user)
        response = client.post(
            "/api/v1/harvests/",
            {
                "planting": self.planting.id,
                "harvest_year": self.next_year.id,
                "quantity_kg": "-1.00",
                "price_per_kg": "20.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("quantity_kg", response.data)

    def test_duplicate_planting_is_rejected(self):
        client = APIClient()
        client.force_authenticate(self.user)
        response = client.post(
            "/api/v1/plantings/",
            {
                "farmer": self.farmer.id,
                "fruit": self.fruit.id,
                "variety": "น้ำดอกไม้",
                "area_rai": "1.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("non_field_errors", response.data)

    def test_import_template_downloads_zip_with_readme(self):
        client = APIClient()
        client.force_authenticate(self.user)
        response = client.get("/api/v1/data-transfer/template/", HTTP_ACCEPT="application/octet-stream")

        self.assertEqual(response.status_code, 200)
        with ZipFile(BytesIO(response.content)) as archive:
            self.assertIn("README.txt", archive.namelist())
            self.assertIn("farmers.csv", archive.namelist())

    def test_farmer_csv_import_preview_and_commit(self):
        client = APIClient()
        client.force_authenticate(self.user)
        csv_body = "first_name,last_name,age,phone,village,address\nสายใจ,สวนดี,39,0800000000,บ้านใหม่,เชียงราย\n"
        upload = SimpleUploadedFile("farmers.csv", csv_body.encode("utf-8"), content_type="text/csv")

        preview = client.post(
            "/api/v1/data-transfer/import/",
            {"dataset": "farmers", "file": upload, "commit": "false"},
            format="multipart",
        )

        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.data["summary"]["valid_rows"], 1)
        self.assertFalse(FarmerProfile.objects.filter(user=self.user, first_name="สายใจ").exists())

        upload = SimpleUploadedFile("farmers.csv", csv_body.encode("utf-8"), content_type="text/csv")
        commit = client.post(
            "/api/v1/data-transfer/import/",
            {"dataset": "farmers", "file": upload, "commit": "true"},
            format="multipart",
        )

        self.assertEqual(commit.status_code, 200)
        self.assertTrue(FarmerProfile.objects.filter(user=self.user, first_name="สายใจ").exists())

    def test_planting_csv_import_commit(self):
        client = APIClient()
        client.force_authenticate(self.user)
        csv_body = (
            "farmer_first_name,farmer_last_name,farmer_phone,fruit_name,variety,area_rai,"
            "planted_at,province,district,subdistrict,note\n"
            "มาลี,,,มะม่วง,โชคอนันต์,2.75,2025-06-01,เชียงใหม่,เมืองเชียงใหม่,สุเทพ,แปลงใหม่\n"
        )
        upload = SimpleUploadedFile("plantings.csv", csv_body.encode("utf-8"), content_type="text/csv")

        response = client.post(
            "/api/v1/data-transfer/import/",
            {"dataset": "plantings", "file": upload, "commit": "true"},
            format="multipart",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["summary"]["valid_rows"], 1)
        self.assertTrue(
            Planting.objects.filter(
                user=self.user,
                farmer=self.farmer,
                fruit=self.fruit,
                variety="โชคอนันต์",
            ).exists()
        )

    def test_harvest_csv_import_commit(self):
        client = APIClient()
        client.force_authenticate(self.user)
        csv_body = (
            "farmer_first_name,farmer_last_name,farmer_phone,fruit_name,variety,year,"
            "quantity_kg,price_per_kg,harvested_at,note\n"
            "มาลี,,,มะม่วง,น้ำดอกไม้,2027,1800.50,36.75,2027-04-20,รอบใหม่\n"
        )
        upload = SimpleUploadedFile("harvests.csv", csv_body.encode("utf-8"), content_type="text/csv")

        response = client.post(
            "/api/v1/data-transfer/import/",
            {"dataset": "harvests", "file": upload, "commit": "true"},
            format="multipart",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["summary"]["valid_rows"], 1)
        self.assertTrue(
            HarvestRecord.objects.filter(
                user=self.user,
                planting=self.planting,
                harvest_year=self.next_year,
                quantity_kg=Decimal("1800.50"),
            ).exists()
        )

    def test_farmer_csv_import_rejects_large_files(self):
        client = APIClient()
        client.force_authenticate(self.user)
        upload = SimpleUploadedFile(
            "farmers.csv",
            b"x" * (MAX_IMPORT_FILE_SIZE + 1),
            content_type="text/csv",
        )

        response = client.post(
            "/api/v1/data-transfer/import/",
            {"dataset": "farmers", "file": upload, "commit": "false"},
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["detail"], "CSV file is too large.")
        self.assertEqual(response.data["limits"]["max_rows"], MAX_IMPORT_ROWS)

    def test_farmer_csv_import_row_limit_prevents_partial_commit(self):
        client = APIClient()
        client.force_authenticate(self.user)
        existing_count = FarmerProfile.objects.filter(user=self.user).count()
        rows = [
            f"bulk{i},สวนดี,39,089{i:07d},บ้านใหม่,เชียงราย"
            for i in range(MAX_IMPORT_ROWS + 1)
        ]
        csv_body = "first_name,last_name,age,phone,village,address\n" + "\n".join(rows)
        upload = SimpleUploadedFile("farmers.csv", csv_body.encode("utf-8"), content_type="text/csv")

        response = client.post(
            "/api/v1/data-transfer/import/",
            {"dataset": "farmers", "file": upload, "commit": "true"},
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["detail"], "CSV row limit exceeded.")
        self.assertEqual(FarmerProfile.objects.filter(user=self.user).count(), existing_count)

    def test_harvest_export_is_scoped_csv(self):
        client = APIClient()
        client.force_authenticate(self.user)
        response = client.get("/api/v1/data-transfer/export/?dataset=harvests", HTTP_ACCEPT="application/octet-stream")

        self.assertEqual(response.status_code, 200)
        content = response.content.decode("utf-8-sig")
        self.assertIn("มาลี", content)
        self.assertNotIn("สมชาย", content)
