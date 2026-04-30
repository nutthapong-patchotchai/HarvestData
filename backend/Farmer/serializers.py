from rest_framework import serializers

from Farmer.models import FarmerProfile, FruitCrop, HarvestRecord, HarvestYear, Planting


class HarvestYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = HarvestYear
        fields = ["id", "year"]


class FruitCropSerializer(serializers.ModelSerializer):
    class Meta:
        model = FruitCrop
        fields = ["id", "name", "category", "color"]


class FarmerProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = FarmerProfile
        fields = [
            "id",
            "first_name",
            "last_name",
            "full_name",
            "age",
            "address",
            "phone",
            "village",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class PlantingSerializer(serializers.ModelSerializer):
    farmer_name = serializers.CharField(source="farmer.full_name", read_only=True)
    fruit_name = serializers.CharField(source="fruit.name", read_only=True)
    fruit_color = serializers.CharField(source="fruit.color", read_only=True)

    class Meta:
        model = Planting
        fields = [
            "id",
            "farmer",
            "farmer_name",
            "fruit",
            "fruit_name",
            "fruit_color",
            "variety",
            "area_rai",
            "planted_at",
            "note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate_farmer(self, farmer):
        request = self.context.get("request")
        if request and request.user.is_authenticated and farmer.user_id != request.user.id:
            raise serializers.ValidationError("This farmer does not belong to the current user.")
        return farmer


class HarvestRecordSerializer(serializers.ModelSerializer):
    farmer_name = serializers.CharField(source="planting.farmer.full_name", read_only=True)
    fruit_name = serializers.CharField(source="planting.fruit.name", read_only=True)
    fruit_color = serializers.CharField(source="planting.fruit.color", read_only=True)
    variety = serializers.CharField(source="planting.variety", read_only=True)
    year = serializers.IntegerField(source="harvest_year.year", read_only=True)
    revenue = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = HarvestRecord
        fields = [
            "id",
            "planting",
            "harvest_year",
            "year",
            "farmer_name",
            "fruit_name",
            "fruit_color",
            "variety",
            "quantity_kg",
            "price_per_kg",
            "revenue",
            "harvested_at",
            "note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate_planting(self, planting):
        request = self.context.get("request")
        if request and request.user.is_authenticated and planting.user_id != request.user.id:
            raise serializers.ValidationError("This planting does not belong to the current user.")
        return planting
