from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from Farmer.models import FarmerProfile, FruitCrop, HarvestRecord, HarvestYear, Planting


class DashboardSummaryTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(username="orchard", password="pass12345")
        self.other_user = User.objects.create_user(username="other", password="pass12345")
        year = HarvestYear.objects.create(year=2026)
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
