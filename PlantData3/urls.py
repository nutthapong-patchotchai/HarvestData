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
    path('login/', auth_view.LoginView.as_view(template_name='Farmer/login.html'), name='login'),
    path('logout/', auth_view.LogoutView.as_view(template_name='Farmer/logout.html'), name='logout'),
    path('', farmer_views.ViewData.ViewFarmer, name='index'),
    path('farmer/<int:Farmer_id>/create/', farmer_views.CreateData.CreateFarmer, name='createFarmer'),
    path('farmer/<int:Farmer_id>/edit', farmer_views.EditData.EditFarmer, name='editFarmer'),
    path('farmer/<int:Farmer_id>/delete', farmer_views.DeleteData.DeleteFarmer, name='deleteFarmer'),
    path('farmer/<int:Farmer_id>/', farmer_views.ViewData.ViewPlant, name='viewFarmer'),
    path('farmer/<int:Farmer_id>/plant/<int:Plant_id>/edit', farmer_views.EditData.EditPlant, name='editPlant'),
    path('farmer/<int:Farmer_id>/plant/<int:Plant_id>/delete', farmer_views.DeleteData.DeletePlant, name='deletePlant'),
    path('farmer/<int:Farmer_id>/plant/create/account<int:id>/', farmer_views.CreateData.CreatePlant, name='createPlant'),
    path('plant/<int:Farmer_id>/harvest/<int:Plant_id>/', farmer_views.ViewData.ViewHarvest, name='viewHarvest'),
    path('plant/<int:Farmer_id>/harvest/<int:Harvest_id>/edit/<int:id>', farmer_views.EditData.EditHarvest, name='editHarvest'),
    path('plant/<int:Plant_id>/harvest/<int:Harvest_id>/delete/<int:id>', farmer_views.DeleteData.DeleteHarvest, name='deleteHarvest'),
    path('plant/<int:Plant_id>/harvest/<int:Harvest_id>/create/account<int:ids>/', farmer_views.CreateData.CreateHarvest, name='createHarvest'),
    path('base/', farmer_views.ViewData.base, name='base'),
    path('test/', farmer_views.test),
    path('fruit/<int:Fruit_id>', farmer_views.Fruits.Fruitss,name="Fruit"),
    path('fruit/<int:Fruit_id>/Year/<int:Year_id>', farmer_views.Fruits.Fruitssyear,name="FruitYear"),
    path('changepassword/',farmer_views.EditData.EditPassword,name="ChangePassword")

]
