from decimal import Decimal

from django.contrib.auth import authenticate, login, logout
from django.db.models import Avg, Count, DecimalField, ExpressionWrapper, F, Sum, Value
from django.db.models.functions import Coalesce
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from Farmer.models import FarmerProfile, FruitCrop, HarvestRecord, HarvestYear, Planting
from Farmer.serializers import (
    FarmerProfileSerializer,
    FruitCropSerializer,
    HarvestRecordSerializer,
    HarvestYearSerializer,
    PlantingSerializer,
)


def decimal_to_float(value):
    return float(value or 0)


class SessionLoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username") or request.data.get("email")
        password = request.data.get("password")
        user = authenticate(request, username=username, password=password)

        if user is None:
            return Response(
                {"detail": "Invalid username or password."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        login(request, user)
        return Response(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "name": user.get_full_name() or user.username,
            }
        )


class SessionLogoutView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CurrentUserView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        if not request.user.is_authenticated:
            return Response({"is_authenticated": False})

        return Response(
            {
                "is_authenticated": True,
                "id": request.user.id,
                "username": request.user.username,
                "email": request.user.email,
                "name": request.user.get_full_name() or request.user.username,
            }
        )


class UserScopedViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        return queryset.filter(user=user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class HarvestYearViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = HarvestYear.objects.all()
    serializer_class = HarvestYearSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["year"]


class FruitCropViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = FruitCrop.objects.all()
    serializer_class = FruitCropSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["name", "category"]


class FarmerProfileViewSet(UserScopedViewSet):
    queryset = FarmerProfile.objects.select_related("user").all()
    serializer_class = FarmerProfileSerializer
    search_fields = ["first_name", "last_name", "phone", "village"]


class PlantingViewSet(UserScopedViewSet):
    queryset = Planting.objects.select_related("farmer", "fruit", "user").all()
    serializer_class = PlantingSerializer
    search_fields = ["variety", "farmer__first_name", "farmer__last_name", "fruit__name"]

    def get_queryset(self):
        queryset = super().get_queryset()
        fruit = self.request.query_params.get("fruit")
        farmer = self.request.query_params.get("farmer")

        if fruit:
            queryset = queryset.filter(fruit_id=fruit)
        if farmer:
            queryset = queryset.filter(farmer_id=farmer)

        return queryset

    @action(detail=True, methods=["get"])
    def harvests(self, request, pk=None):
        planting = self.get_object()
        harvests = planting.harvests.select_related(
            "harvest_year",
            "planting__farmer",
            "planting__fruit",
        )
        serializer = HarvestRecordSerializer(harvests, many=True, context={"request": request})
        return Response(serializer.data)


class HarvestRecordViewSet(UserScopedViewSet):
    queryset = HarvestRecord.objects.select_related(
        "harvest_year",
        "planting",
        "planting__farmer",
        "planting__fruit",
        "user",
    ).all()
    serializer_class = HarvestRecordSerializer
    search_fields = ["planting__farmer__first_name", "planting__fruit__name", "planting__variety"]

    def get_queryset(self):
        queryset = super().get_queryset()
        year = self.request.query_params.get("year")
        fruit = self.request.query_params.get("fruit")
        farmer = self.request.query_params.get("farmer")

        if year:
            queryset = queryset.filter(harvest_year__year=year)
        if fruit:
            queryset = queryset.filter(planting__fruit_id=fruit)
        if farmer:
            queryset = queryset.filter(planting__farmer_id=farmer)

        return queryset


class DashboardSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        harvests = HarvestRecord.objects.select_related(
            "harvest_year",
            "planting",
            "planting__farmer",
            "planting__fruit",
        )
        plantings = Planting.objects.select_related("farmer", "fruit")
        farmers = FarmerProfile.objects.all()

        harvests = harvests.filter(user=request.user)
        plantings = plantings.filter(user=request.user)
        farmers = farmers.filter(user=request.user)

        year = request.query_params.get("year")
        if year:
            harvests = harvests.filter(harvest_year__year=year)

        decimal_field = DecimalField(max_digits=18, decimal_places=2)
        zero = Value(Decimal("0.00"), output_field=decimal_field)
        harvests = harvests.annotate(
            row_revenue=ExpressionWrapper(
                F("quantity_kg") * F("price_per_kg"),
                output_field=decimal_field,
            )
        )

        def revenue_sum():
            return Sum("row_revenue", output_field=decimal_field)

        totals = harvests.aggregate(
            total_quantity_kg=Coalesce(Sum("quantity_kg"), zero, output_field=decimal_field),
            total_revenue=Coalesce(revenue_sum(), zero, output_field=decimal_field),
            average_price=Coalesce(Avg("price_per_kg"), zero, output_field=decimal_field),
        )

        by_year = harvests.values("harvest_year__year").annotate(
            quantity_kg=Coalesce(Sum("quantity_kg"), zero, output_field=decimal_field),
            revenue=Coalesce(revenue_sum(), zero, output_field=decimal_field),
            average_price=Coalesce(Avg("price_per_kg"), zero, output_field=decimal_field),
        ).order_by("harvest_year__year")

        by_fruit = harvests.values(
            "planting__fruit_id",
            "planting__fruit__name",
            "planting__fruit__color",
        ).annotate(
            quantity_kg=Coalesce(Sum("quantity_kg"), zero, output_field=decimal_field),
            revenue=Coalesce(revenue_sum(), zero, output_field=decimal_field),
            harvest_count=Count("id"),
        ).order_by("-revenue")

        product_by_year = harvests.values(
            "harvest_year__year",
            "planting__fruit_id",
            "planting__fruit__name",
            "planting__fruit__color",
        ).annotate(
            quantity_kg=Coalesce(Sum("quantity_kg"), zero, output_field=decimal_field),
            revenue=Coalesce(revenue_sum(), zero, output_field=decimal_field),
            average_price=Coalesce(Avg("price_per_kg"), zero, output_field=decimal_field),
        ).order_by("harvest_year__year", "planting__fruit__name")

        top_farmers = harvests.values(
            "planting__farmer_id",
            "planting__farmer__first_name",
            "planting__farmer__last_name",
            "planting__farmer__village",
        ).annotate(
            quantity_kg=Coalesce(Sum("quantity_kg"), zero, output_field=decimal_field),
            revenue=Coalesce(revenue_sum(), zero, output_field=decimal_field),
        ).order_by("-revenue")[:5]

        recent_harvests = harvests.order_by("-updated_at")[:8]

        return Response(
            {
                "totals": {
                    "farmers": farmers.count(),
                    "plantings": plantings.count(),
                    "harvests": harvests.count(),
                    "quantity_kg": decimal_to_float(totals["total_quantity_kg"]),
                    "revenue": decimal_to_float(totals["total_revenue"]),
                    "average_price": decimal_to_float(totals["average_price"]),
                },
                "harvest_by_year": [
                    {
                        "year": item["harvest_year__year"],
                        "quantity_kg": decimal_to_float(item["quantity_kg"]),
                        "revenue": decimal_to_float(item["revenue"]),
                        "average_price": decimal_to_float(item["average_price"]),
                    }
                    for item in by_year
                ],
                "fruit_breakdown": [
                    {
                        "id": item["planting__fruit_id"],
                        "name": item["planting__fruit__name"],
                        "color": item["planting__fruit__color"],
                        "quantity_kg": decimal_to_float(item["quantity_kg"]),
                        "revenue": decimal_to_float(item["revenue"]),
                        "harvest_count": item["harvest_count"],
                    }
                    for item in by_fruit
                ],
                "product_trends": [
                    {
                        "year": item["harvest_year__year"],
                        "product_id": item["planting__fruit_id"],
                        "product_name": item["planting__fruit__name"],
                        "color": item["planting__fruit__color"],
                        "quantity_kg": decimal_to_float(item["quantity_kg"]),
                        "revenue": decimal_to_float(item["revenue"]),
                        "average_price": decimal_to_float(item["average_price"]),
                    }
                    for item in product_by_year
                ],
                "top_farmers": [
                    {
                        "id": item["planting__farmer_id"],
                        "name": " ".join(
                            part
                            for part in [
                                item["planting__farmer__first_name"],
                                item["planting__farmer__last_name"],
                            ]
                            if part
                        ),
                        "village": item["planting__farmer__village"],
                        "quantity_kg": decimal_to_float(item["quantity_kg"]),
                        "revenue": decimal_to_float(item["revenue"]),
                    }
                    for item in top_farmers
                ],
                "recent_harvests": HarvestRecordSerializer(recent_harvests, many=True).data,
            }
        )
