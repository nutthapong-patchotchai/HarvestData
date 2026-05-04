from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator, RegexValidator
from django.db import models


class HarvestYear(models.Model):
    year = models.PositiveSmallIntegerField(unique=True, db_index=True)

    class Meta:
        ordering = ["-year"]

    def __str__(self):
        return str(self.year)


class FruitCrop(models.Model):
    name = models.CharField(max_length=80, unique=True)
    category = models.CharField(max_length=80, blank=True)
    color = models.CharField(
        max_length=7,
        default="#4f8a3d",
        validators=[
            RegexValidator(
                regex=r"^#[0-9A-Fa-f]{6}$",
                message="Color must be a hex value such as #4f8a3d.",
            )
        ],
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        related_name="harvest_profile",
        on_delete=models.CASCADE,
    )
    avatar = models.TextField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    bio = models.TextField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["user__username"]

    def __str__(self):
        return self.user.get_full_name() or self.user.username


class FarmerProfile(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100, blank=True)
    age = models.PositiveSmallIntegerField(null=True, blank=True)
    address = models.TextField(max_length=500, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    village = models.CharField(max_length=120, blank=True)
    photo = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["first_name", "last_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "first_name", "last_name", "phone"],
                condition=~models.Q(phone=""),
                name="unique_farmer_identity_with_phone",
            ),
            models.UniqueConstraint(
                fields=["user", "first_name", "last_name", "village"],
                condition=models.Q(phone="") & ~models.Q(village=""),
                name="unique_farmer_identity_with_village",
            ),
            models.UniqueConstraint(
                fields=["user", "first_name", "last_name"],
                condition=models.Q(phone="", village=""),
                name="unique_farmer_identity_name_only",
            ),
        ]

    @property
    def full_name(self):
        return " ".join(part for part in [self.first_name, self.last_name] if part).strip()

    def __str__(self):
        return self.full_name or f"Farmer #{self.pk}"


class Planting(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    farmer = models.ForeignKey(FarmerProfile, related_name="plantings", on_delete=models.CASCADE)
    fruit = models.ForeignKey(FruitCrop, related_name="plantings", on_delete=models.PROTECT)
    variety = models.CharField(max_length=120, blank=True)
    area_rai = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    planted_at = models.DateField(null=True, blank=True)
    province = models.CharField(max_length=120, blank=True)
    district = models.CharField(max_length=120, blank=True)
    subdistrict = models.CharField(max_length=120, blank=True)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["fruit__name", "variety"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "farmer", "fruit", "variety"],
                name="unique_planting_per_farmer_fruit_variety",
            ),
            models.CheckConstraint(
                condition=models.Q(area_rai__gte=0),
                name="planting_area_rai_non_negative",
            ),
        ]

    def __str__(self):
        variety = f" {self.variety}" if self.variety else ""
        return f"{self.fruit}{variety} - {self.farmer}"


class HarvestRecord(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    planting = models.ForeignKey(Planting, related_name="harvests", on_delete=models.CASCADE)
    harvest_year = models.ForeignKey(HarvestYear, related_name="harvests", on_delete=models.PROTECT)
    quantity_kg = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    price_per_kg = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    harvested_at = models.DateField(null=True, blank=True)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-harvest_year__year", "planting__fruit__name"]
        constraints = [
            models.UniqueConstraint(
                fields=["planting", "harvest_year"],
                name="unique_harvest_per_planting_year",
            ),
            models.CheckConstraint(
                condition=models.Q(quantity_kg__gte=0),
                name="harvest_quantity_kg_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(price_per_kg__gte=0),
                name="harvest_price_per_kg_non_negative",
            ),
        ]

    @property
    def revenue(self):
        return self.quantity_kg * self.price_per_kg

    def __str__(self):
        return f"{self.planting} / {self.harvest_year} / {self.quantity_kg} kg"
