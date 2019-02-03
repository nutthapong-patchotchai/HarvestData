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
    path('', farmer_views.index, name='index'),
    path('login/', auth_view.LoginView.as_view(template_name='Farmer/login.html'), name='login'),
    path('logout/', auth_view.LogoutView.as_view(template_name='Farmer/logout.html'), name='logout'),
    path('farmer/create/', farmer_views.CreateFarmer, name='createFarmer'),
    path('farmer/1/edit', farmer_views.EditFarmer, name='editFarmer'),
    path('farmer/1/delete', farmer_views.DeleteFarmer, name='deleteFarmer'),
    path('farmer/<int:User_id>/plant', farmer_views.ViewFarmer, name='viewFarmer'),
    path('farmer/1/plant/1/edit', farmer_views.EditPlant, name='editPlant'),
    path('farmer/1/plant/1/delete', farmer_views.DeletePlant, name='deletePlant'),
    path('farmer/1/plant/create', farmer_views.CreatePlant, name='createPlant'),
    path('farmer/<int:id>/plant/<int:id>/harvest/', farmer_views.ViewHarvest, name='viewHarvest'),
    path('farmer/1/plant/1/harvest/1/edit', farmer_views.EditHarvest, name='editHarvest'),
    path('farmer/1/plant/1/harvest/1/delete', farmer_views.DeleteHarvest, name='deleteHarvest'),
    path('farmer/1/plant/1/harvest/1/create', farmer_views.CreateHarvest, name='createHarvest'),
    path('test/', farmer_views.test, name='test')
]
