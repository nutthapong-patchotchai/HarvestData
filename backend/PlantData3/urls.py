from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from Farmer import views


router = DefaultRouter()
router.register("years", views.HarvestYearViewSet, basename="year")
router.register("fruits", views.FruitCropViewSet, basename="fruit")
router.register("farmers", views.FarmerProfileViewSet, basename="farmer")
router.register("plantings", views.PlantingViewSet, basename="planting")
router.register("harvests", views.HarvestRecordViewSet, basename="harvest")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/auth/login/", views.SessionLoginView.as_view(), name="api-login"),
    path("api/v1/auth/logout/", views.SessionLogoutView.as_view(), name="api-logout"),
    path("api/v1/auth/me/", views.CurrentUserView.as_view(), name="api-current-user"),
    path("api/v1/dashboard/", views.DashboardSummaryView.as_view(), name="api-dashboard"),
    path("api/v1/", include(router.urls)),
    path("api-auth/", include("rest_framework.urls")),
]
