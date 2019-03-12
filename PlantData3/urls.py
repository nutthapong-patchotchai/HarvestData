"""PlantData3 URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/2.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from Farmer import views as farmer_views
from django.contrib.auth import views as auth_view
from Farmer.models import Farmer,Plant,Harvest

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', farmer_views.ViewData.ViewFarmer, name='index'),
    path('login/', auth_view.LoginView.as_view(template_name='Farmer/login.html'), name='login'),
    path('logout/', auth_view.LogoutView.as_view(template_name='Farmer/logout.html'), name='logout'),
    path('farmer/<int:Farmer_id>/create/', farmer_views.ViewData.CreateFarmer, name='createFarmer'),
    path('farmer/<int:Farmer_id>/edit', farmer_views.ViewData.EditFarmer, name='editFarmer'),
    path('farmer/<int:Farmer_id>/delete', farmer_views.ViewData.DeleteFarmer, name='deleteFarmer'),
    path('<int:id>/farmer/<int:Farmer_id>/', farmer_views.ViewData.ViewPlant, name='viewFarmer'),
    path('farmer/<int:Farmer_id>/plant/<int:Plant_id>/edit', farmer_views.ViewData.EditPlant, name='editPlant'),
    path('farmer/<int:Farmer_id>/plant/<int:Plant_id>/delete', farmer_views.ViewData.DeletePlant, name='deletePlant'),
    path('farmer/<int:Farmer_id>/plant/create', farmer_views.ViewData.CreatePlant, name='createPlant'),
    path('plant/<int:Farmer_id>/harvest/<int:Plant_id>/', farmer_views.ViewData.ViewHarvest, name='viewHarvest'),
    path('plant/<int:Farmer_id>/harvest/<int:Harvest_id>/edit/<int:id>', farmer_views.ViewData.EditHarvest, name='editHarvest'),
    path('plant/<int:Plant_id>/harvest/<int:Harvest_id>/delete/<int:id>', farmer_views.ViewData.DeleteHarvest, name='deleteHarvest'),
    path('plant/<int:Plant_id>/harvest/<int:Harvest_id>/create/', farmer_views.ViewData.CreateHarvest, name='createHarvest'),
    path('test/', farmer_views.ViewData.test, name='test'),
    path('test2/', farmer_views.ViewData.test_view, name='test')
]
