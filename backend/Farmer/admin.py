from django.contrib import admin

from Farmer.models import FarmerProfile, FruitCrop, HarvestRecord, HarvestYear, Planting, UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "phone", "updated_at")
    search_fields = ("user__username", "user__first_name", "user__last_name", "phone")


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
    list_display = ("fruit", "variety", "farmer", "province", "district", "area_rai", "planted_at", "user")
    list_filter = ("fruit", "province", "planted_at")
    search_fields = (
        "fruit__name",
        "variety",
        "farmer__first_name",
        "farmer__last_name",
        "province",
        "district",
        "subdistrict",
    )


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
