from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from Farmer.models import FarmerProfile, FruitCrop, HarvestRecord, HarvestYear, Planting, UserProfile


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
        user.email = "demo@harvest.local"
        user.first_name = "Harvest"
        user.last_name = "Team"
        user.set_password("demo1234")
        if created:
            user.save()
        else:
            user.save(update_fields=["email", "first_name", "last_name", "password"])

        UserProfile.objects.update_or_create(
            user=user,
            defaults={
                "phone": "02-555-1400",
                "bio": "ทีมสาธิตข้อมูลสวนผลไม้ HarvestData",
            },
        )

        admin_user, admin_created = User.objects.get_or_create(
            username="admin",
            defaults={
                "email": "admin@harvest.local",
                "first_name": "Admin",
                "last_name": "Harvest",
                "is_staff": True,
                "is_superuser": True,
            },
        )
        admin_user.set_password("admin1234")
        admin_user.email = "admin@harvest.local"
        admin_user.first_name = "Admin"
        admin_user.last_name = "Harvest"
        admin_user.is_staff = True
        admin_user.is_superuser = True
        if admin_created:
            admin_user.save()
        else:
            admin_user.save(
                update_fields=[
                    "email",
                    "first_name",
                    "last_name",
                    "password",
                    "is_staff",
                    "is_superuser",
                ]
            )

        UserProfile.objects.update_or_create(
            user=admin_user,
            defaults={
                "phone": "02-555-9999",
                "bio": "ผู้ดูแล master data ของระบบ HarvestData",
            },
        )

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
                ("เงาะ", "ผลไม้สวน", "#c94e44"),
                ("ส้มโอ", "ผลไม้เมืองร้อน", "#8fbf5f"),
                ("สละ", "ผลไม้เศรษฐกิจ", "#a84732"),
                ("มะพร้าว", "พืชสวน", "#7b9c6c"),
            ]
        }

        farmer_rows = [
            ("สมชาย", "สวนเขียว", 46, "บ้านริมคลอง", "081-111-2040", "จันทบุรี", "ท่าใหม่", "เขาวัว"),
            ("มาลี", "ทองสวน", 39, "บ้านเนินดิน", "082-222-3150", "ระยอง", "แกลง", "ทางเกวียน"),
            ("อารีย์", "ผลหวาน", 52, "บ้านหนองไม้", "083-333-4260", "เชียงใหม่", "จอมทอง", "บ้านหลวง"),
            ("กิตติ", "ธารผล", 44, "บ้านป่าฝน", "084-444-5370", "ตราด", "เขาสมิง", "วังตะเคียน"),
            ("ปรียา", "แดนสวน", 41, "บ้านเขาแก้ว", "085-101-1101", "นครศรีธรรมราช", "ลานสกา", "กำโลน"),
            ("อนันต์", "ไร่ดี", 49, "บ้านห้วยลึก", "085-102-1102", "ชุมพร", "หลังสวน", "วังตะกอ"),
            ("ศิริพร", "บุญผล", 37, "บ้านทุ่งรวง", "085-103-1103", "สุราษฎร์ธานี", "พุนพิน", "ท่าโรงช้าง"),
            ("วิเชียร", "สวนทอง", 55, "บ้านวังน้ำ", "085-104-1104", "ปราจีนบุรี", "เมืองปราจีนบุรี", "ดงขี้เหล็ก"),
            ("นฤมล", "ใบเขียว", 34, "บ้านเหนือคลอง", "085-105-1105", "เชียงราย", "เมืองเชียงราย", "ท่าสุด"),
            ("ประเสริฐ", "ร่มไม้", 58, "บ้านปากน้ำ", "085-106-1106", "สระแก้ว", "วังน้ำเย็น", "วังน้ำเย็น"),
            ("จันทร์เพ็ญ", "สวนสุข", 43, "บ้านดอยงาม", "085-107-1107", "ลำพูน", "ป่าซาง", "น้ำดิบ"),
            ("ธนากร", "ผลไพบูลย์", 47, "บ้านหนองบัว", "085-108-1108", "ราชบุรี", "ดำเนินสะดวก", "ศรีสุราษฎร์"),
            ("รัตนา", "แก้วสวน", 50, "บ้านไร่ข้างวัด", "085-109-1109", "นครปฐม", "สามพราน", "ไร่ขิง"),
            ("สมพร", "คลองผล", 45, "บ้านสวนล่าง", "085-110-1110", "เพชรบุรี", "ท่ายาง", "ท่าไม้รวก"),
            ("อุทัย", "ภูผล", 53, "บ้านภูเขียว", "085-111-1111", "เลย", "ภูเรือ", "หนองบัว"),
            ("เบญจา", "คำสวน", 36, "บ้านทุ่งดอก", "085-112-1112", "น่าน", "ปัว", "ศิลาแลง"),
            ("ไพศาล", "นาดี", 48, "บ้านโคกสวน", "085-113-1113", "บุรีรัมย์", "นางรอง", "สะเดา"),
            ("สุภาพ", "ม่วงทอง", 42, "บ้านริมเขื่อน", "085-114-1114", "สกลนคร", "พังโคน", "ม่วงไข่"),
            ("กานดา", "สุขเกษม", 40, "บ้านคลองชล", "085-115-1115", "ฉะเชิงเทรา", "สนามชัยเขต", "ท่ากระดาน"),
            ("มนตรี", "ดินดี", 51, "บ้านชายสวน", "085-116-1116", "จันทบุรี", "มะขาม", "ปัถวี"),
        ]

        farmers = {}
        for first_name, last_name, age, village, phone, province, district, subdistrict in farmer_rows:
            address = f"{village} ตำบล{subdistrict} อำเภอ{district} จังหวัด{province}"
            farmers[first_name], _ = FarmerProfile.objects.update_or_create(
                user=user,
                first_name=first_name,
                last_name=last_name,
                defaults={
                    "age": age,
                    "address": address,
                    "phone": phone,
                    "village": village,
                },
            )

        crop_plan = [
            ("สมชาย", "มะม่วง", "น้ำดอกไม้", "8.50", date(2019, 6, 12)),
            ("สมชาย", "ทุเรียน", "ก้านยาว", "3.20", date(2022, 5, 14)),
            ("มาลี", "ทุเรียน", "หมอนทอง", "5.75", date(2020, 5, 8)),
            ("อารีย์", "ลำไย", "อีดอ", "11.00", date(2018, 4, 20)),
            ("กิตติ", "มังคุด", "พื้นเมือง", "6.25", date(2021, 7, 2)),
            ("ปรียา", "เงาะ", "โรงเรียน", "7.40", date(2020, 8, 18)),
            ("อนันต์", "มะพร้าว", "น้ำหอม", "12.20", date(2017, 3, 11)),
            ("ศิริพร", "ส้มโอ", "ทองดี", "6.80", date(2021, 9, 7)),
            ("วิเชียร", "มะม่วง", "เขียวเสวย", "9.10", date(2019, 5, 6)),
            ("นฤมล", "ลำไย", "เบี้ยวเขียว", "10.50", date(2018, 4, 16)),
            ("ประเสริฐ", "มังคุด", "พื้นเมือง", "4.90", date(2022, 7, 10)),
            ("จันทร์เพ็ญ", "ลำไย", "อีดอ", "8.30", date(2019, 4, 19)),
            ("ธนากร", "มะพร้าว", "น้ำหอม", "13.00", date(2016, 2, 23)),
            ("รัตนา", "ส้มโอ", "ขาวน้ำผึ้ง", "5.60", date(2020, 10, 3)),
            ("สมพร", "มะม่วง", "มหาชนก", "7.70", date(2021, 6, 9)),
            ("อุทัย", "สละ", "สุมาลี", "4.40", date(2022, 6, 21)),
            ("เบญจา", "ลำไย", "พวงทอง", "9.60", date(2018, 4, 8)),
            ("ไพศาล", "มะม่วง", "น้ำดอกไม้", "6.90", date(2020, 5, 28)),
            ("สุภาพ", "เงาะ", "สีทอง", "5.30", date(2021, 8, 13)),
            ("กานดา", "ทุเรียน", "ชะนี", "4.80", date(2022, 5, 19)),
            ("มนตรี", "มังคุด", "พื้นเมือง", "7.90", date(2019, 7, 1)),
            ("ปรียา", "สละ", "เนินวง", "3.60", date(2023, 6, 8)),
            ("วิเชียร", "ส้มโอ", "ทับทิมสยาม", "4.10", date(2022, 9, 17)),
            ("กานดา", "มะพร้าว", "น้ำหอม", "6.20", date(2020, 2, 12)),
        ]

        farmer_locations = {
            first_name: (province, district, subdistrict)
            for first_name, _, _, _, _, province, district, subdistrict in farmer_rows
        }

        base_price = {
            "มะม่วง": Decimal("31.00"),
            "ทุเรียน": Decimal("108.00"),
            "ลำไย": Decimal("21.00"),
            "มังคุด": Decimal("45.00"),
            "เงาะ": Decimal("24.00"),
            "ส้มโอ": Decimal("38.00"),
            "สละ": Decimal("62.00"),
            "มะพร้าว": Decimal("18.00"),
        }

        plantings = []
        for index, (farmer_name, fruit_name, variety, area, planted_at) in enumerate(crop_plan):
            province, district, subdistrict = farmer_locations[farmer_name]
            planting = self.upsert_planting(
                user,
                farmers[farmer_name],
                fruits[fruit_name],
                variety,
                area,
                planted_at,
                province,
                district,
                subdistrict,
            )
            plantings.append((index, planting, fruit_name))

        for index, planting, fruit_name in plantings:
            for year in [2023, 2024, 2025, 2026]:
                area = Decimal(planting.area_rai)
                growth = Decimal(year - 2022)
                quantity = area * Decimal("780") + Decimal(index * 115) + growth * Decimal("420")
                price = base_price[fruit_name] + Decimal(year - 2023) * Decimal("2.25") + Decimal(index % 4)
                HarvestRecord.objects.update_or_create(
                    user=user,
                    planting=planting,
                    harvest_year=years[year],
                    defaults={
                        "quantity_kg": quantity.quantize(Decimal("0.01")),
                        "price_per_kg": price.quantize(Decimal("0.01")),
                        "harvested_at": date(year, min(12, planted_at.month + 1), min(25, planted_at.day)),
                    },
                )

        self.stdout.write(
            self.style.SUCCESS(
                "Seeded HarvestData demo. Login: demo / demo1234, admin / admin1234"
            )
        )

    def upsert_planting(self, user, farmer, fruit, variety, area_rai, planted_at, province, district, subdistrict):
        planting, _ = Planting.objects.update_or_create(
            user=user,
            farmer=farmer,
            fruit=fruit,
            variety=variety,
            defaults={
                "area_rai": Decimal(area_rai),
                "planted_at": planted_at,
                "province": province,
                "district": district,
                "subdistrict": subdistrict,
            },
        )
        return planting
