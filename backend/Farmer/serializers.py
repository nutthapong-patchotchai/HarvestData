from rest_framework import serializers

from Farmer.models import FarmerProfile, FruitCrop, HarvestRecord, HarvestYear, Planting, UserProfile


def active_user(context):
    request = context.get("request")
    if request and request.user.is_authenticated:
        return request.user
    return None


def value_from_attrs(instance, attrs, field, default=""):
    if field in attrs:
        return attrs[field]
    if instance is not None:
        return getattr(instance, field)
    return default


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ["avatar", "phone", "bio", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]


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
            "photo",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate(self, attrs):
        user = active_user(self.context)
        if not user:
            return attrs

        first_name = value_from_attrs(self.instance, attrs, "first_name")
        last_name = value_from_attrs(self.instance, attrs, "last_name")
        phone = value_from_attrs(self.instance, attrs, "phone")
        village = value_from_attrs(self.instance, attrs, "village")

        if not first_name:
            return attrs

        queryset = FarmerProfile.objects.filter(
            user=user,
            first_name=first_name,
            last_name=last_name or "",
        )
        if phone:
            queryset = queryset.filter(phone=phone)
        elif village:
            queryset = queryset.filter(phone="", village=village)
        else:
            queryset = queryset.filter(phone="", village="")

        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError(
                "A farmer with the same identifying details already exists."
            )

        return attrs


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
            "province",
            "district",
            "subdistrict",
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

    def validate(self, attrs):
        user = active_user(self.context)
        if not user:
            return attrs

        farmer = value_from_attrs(self.instance, attrs, "farmer", None)
        fruit = value_from_attrs(self.instance, attrs, "fruit", None)
        variety = value_from_attrs(self.instance, attrs, "variety", "") or ""
        if not farmer or not fruit:
            return attrs

        queryset = Planting.objects.filter(
            user=user,
            farmer=farmer,
            fruit=fruit,
            variety=variety,
        )
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError(
                "A planting with this farmer, fruit, and variety already exists."
            )

        return attrs


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

    def validate(self, attrs):
        user = active_user(self.context)
        if not user:
            return attrs

        planting = value_from_attrs(self.instance, attrs, "planting", None)
        harvest_year = value_from_attrs(self.instance, attrs, "harvest_year", None)
        if not planting or not harvest_year:
            return attrs

        queryset = HarvestRecord.objects.filter(
            user=user,
            planting=planting,
            harvest_year=harvest_year,
        )
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError(
                "A harvest record for this planting and year already exists."
            )

        return attrs
