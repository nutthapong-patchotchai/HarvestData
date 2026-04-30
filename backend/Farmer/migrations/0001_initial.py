import decimal

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="FruitCrop",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=80, unique=True)),
                ("category", models.CharField(blank=True, max_length=80)),
                ("color", models.CharField(default="#4f8a3d", max_length=7)),
            ],
            options={
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="HarvestYear",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("year", models.PositiveSmallIntegerField(db_index=True, unique=True)),
            ],
            options={
                "ordering": ["-year"],
            },
        ),
        migrations.CreateModel(
            name="FarmerProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("first_name", models.CharField(max_length=100)),
                ("last_name", models.CharField(blank=True, max_length=100)),
                ("age", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("address", models.TextField(blank=True, max_length=500)),
                ("phone", models.CharField(blank=True, max_length=40)),
                ("village", models.CharField(blank=True, max_length=120)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["first_name", "last_name"],
            },
        ),
        migrations.CreateModel(
            name="Planting",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("variety", models.CharField(blank=True, max_length=120)),
                ("area_rai", models.DecimalField(decimal_places=2, default=decimal.Decimal("0.00"), max_digits=8)),
                ("planted_at", models.DateField(blank=True, null=True)),
                ("note", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("farmer", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="plantings", to="Farmer.farmerprofile")),
                ("fruit", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="plantings", to="Farmer.fruitcrop")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["fruit__name", "variety"],
            },
        ),
        migrations.CreateModel(
            name="HarvestRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("quantity_kg", models.DecimalField(decimal_places=2, max_digits=12)),
                ("price_per_kg", models.DecimalField(decimal_places=2, max_digits=10)),
                ("harvested_at", models.DateField(blank=True, null=True)),
                ("note", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("harvest_year", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="harvests", to="Farmer.harvestyear")),
                ("planting", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="harvests", to="Farmer.planting")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-harvest_year__year", "planting__fruit__name"],
            },
        ),
        migrations.AddConstraint(
            model_name="harvestrecord",
            constraint=models.UniqueConstraint(fields=("planting", "harvest_year"), name="unique_harvest_per_planting_year"),
        ),
    ]
