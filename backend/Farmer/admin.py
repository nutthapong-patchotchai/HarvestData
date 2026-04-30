from django.contrib import admin

from Farmer.models import FarmerProfile, FruitCrop, HarvestRecord, HarvestYear, Planting


@admin.register(HarvestYear)
class HarvestYearAdmin(admin.ModelAdmin):
    list_display = ("year",)
    search_fields = ("year",)


@admin.register(FruitCrop)
class FruitCropAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "color")
    search_fields = ("name", "category")


@admin.register(FarmerProfile)
class FarmerProfileAdmin(admin.ModelAdmin):
    list_display = ("full_name", "phone", "village", "user", "updated_at")
    list_filter = ("village",)
    search_fields = ("first_name", "last_name", "phone", "village")


@admin.register(Planting)
class PlantingAdmin(admin.ModelAdmin):
    list_display = ("fruit", "variety", "farmer", "area_rai", "planted_at", "user")
    list_filter = ("fruit", "planted_at")
    search_fields = ("fruit__name", "variety", "farmer__first_name", "farmer__last_name")


@admin.register(HarvestRecord)
class HarvestRecordAdmin(admin.ModelAdmin):
    list_display = (
        "planting",
        "harvest_year",
        "quantity_kg",
        "price_per_kg",
        "revenue",
        "harvested_at",
    )
    list_filter = ("harvest_year", "planting__fruit")
    search_fields = ("planting__fruit__name", "planting__farmer__first_name")
