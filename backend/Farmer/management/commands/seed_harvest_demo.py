from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from Farmer.models import FarmerProfile, FruitCrop, HarvestRecord, HarvestYear, Planting


class Command(BaseCommand):
    help = "Seed natural demo data for the HarvestData dashboard."

    def handle(self, *args, **options):
        User = get_user_model()
        user, created = User.objects.get_or_create(
            username="demo",
            defaults={
                "email": "demo@harvest.local",
                "first_name": "Harvest",
                "last_name": "Team",
            },
        )
        if created:
            user.set_password("demo1234")
            user.save(update_fields=["password"])

        years = {
            year: HarvestYear.objects.get_or_create(year=year)[0]
            for year in [2022, 2023, 2024, 2025, 2026]
        }

        fruits = {
            name: FruitCrop.objects.update_or_create(
                name=name,
                defaults={"category": category, "color": color},
            )[0]
            for name, category, color in [
                ("มะม่วง", "ผลไม้เมืองร้อน", "#e0a11b"),
                ("ทุเรียน", "ผลไม้เศรษฐกิจ", "#6b8e23"),
                ("ลำไย", "ผลไม้ตามฤดูกาล", "#b98f57"),
                ("มังคุด", "ผลไม้สวน", "#6f3a7d"),
            ]
        }

        farmers = {
            first_name: FarmerProfile.objects.update_or_create(
                user=user,
                first_name=first_name,
                last_name=last_name,
                defaults={
                    "age": age,
                    "address": address,
                    "phone": phone,
                    "village": village,
                },
            )[0]
            for first_name, last_name, age, village, phone, address in [
                ("สมชาย", "สวนเขียว", 46, "บ้านริมคลอง", "081-111-2040", "12 หมู่ 5 ตำบลสวนกลาง"),
                ("มาลี", "ทองสวน", 39, "บ้านเนินดิน", "082-222-3150", "87 หมู่ 2 ตำบลแม่สวน"),
                ("อารีย์", "ผลหวาน", 52, "บ้านหนองไม้", "083-333-4260", "33 หมู่ 8 ตำบลน้ำใส"),
                ("กิตติ", "ธารผล", 44, "บ้านป่าฝน", "084-444-5370", "64 หมู่ 1 ตำบลเขียวชอุ่ม"),
            ]
        }

        plantings = [
            self.upsert_planting(user, farmers["สมชาย"], fruits["มะม่วง"], "น้ำดอกไม้", "8.50", date(2019, 6, 12)),
            self.upsert_planting(user, farmers["มาลี"], fruits["ทุเรียน"], "หมอนทอง", "5.75", date(2020, 5, 8)),
            self.upsert_planting(user, farmers["อารีย์"], fruits["ลำไย"], "อีดอ", "11.00", date(2018, 4, 20)),
            self.upsert_planting(user, farmers["กิตติ"], fruits["มังคุด"], "พื้นเมือง", "6.25", date(2021, 7, 2)),
            self.upsert_planting(user, farmers["สมชาย"], fruits["ทุเรียน"], "ก้านยาว", "3.20", date(2022, 5, 14)),
        ]

        rows = [
            (plantings[0], 2022, "8400", "28.50", date(2022, 4, 28)),
            (plantings[0], 2023, "9100", "31.00", date(2023, 4, 25)),
            (plantings[0], 2024, "9600", "33.75", date(2024, 4, 22)),
            (plantings[0], 2025, "10300", "36.25", date(2025, 4, 18)),
            (plantings[1], 2022, "4100", "88.00", date(2022, 6, 12)),
            (plantings[1], 2023, "4700", "96.00", date(2023, 6, 9)),
            (plantings[1], 2024, "5100", "104.00", date(2024, 6, 11)),
            (plantings[1], 2025, "5600", "112.00", date(2025, 6, 8)),
            (plantings[2], 2023, "13200", "19.50", date(2023, 8, 20)),
            (plantings[2], 2024, "14100", "21.25", date(2024, 8, 17)),
            (plantings[2], 2025, "14800", "22.00", date(2025, 8, 19)),
            (plantings[3], 2024, "3900", "43.00", date(2024, 7, 5)),
            (plantings[3], 2025, "4300", "46.50", date(2025, 7, 6)),
            (plantings[4], 2025, "1900", "132.00", date(2025, 6, 18)),
            (plantings[4], 2026, "2300", "138.00", date(2026, 6, 16)),
        ]

        for planting, year, quantity, price, harvested_at in rows:
            HarvestRecord.objects.update_or_create(
                user=user,
                planting=planting,
                harvest_year=years[year],
                defaults={
                    "quantity_kg": Decimal(quantity),
                    "price_per_kg": Decimal(price),
                    "harvested_at": harvested_at,
                },
            )

        self.stdout.write(self.style.SUCCESS("Seeded HarvestData demo. Login: demo / demo1234"))

    def upsert_planting(self, user, farmer, fruit, variety, area_rai, planted_at):
        planting, _ = Planting.objects.update_or_create(
            user=user,
            farmer=farmer,
            fruit=fruit,
            variety=variety,
            defaults={
                "area_rai": Decimal(area_rai),
                "planted_at": planted_at,
            },
        )
        return planting
