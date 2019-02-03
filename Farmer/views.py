from django.shortcuts import render, get_object_or_404
from django.views.generic import DetailView

from Farmer.models import Farmer, Plant, Harvest
from django.contrib.auth.decorators import login_required


@login_required
def index(request):
    ga = Farmer.objects.filter(User_id=request.user)

    a = {
            'Farmer': ga
    }
    return render(request, 'Farmer/index.html', a)


@login_required
def login(request):
    return render(request, 'Farmer/login.html')


@login_required
def CreateFarmer(request):
    return render(request, 'Farmer/CreateFarmer.html')


@login_required
def EditFarmer(request):
    return render(request, 'Farmer/EditFarmer.html')


@login_required
def DeleteFarmer(request):
    return render(request, 'Farmer/DeleteFarmerForm.html')


@login_required
def ViewFarmer(request, id):
    ca = Harvest.objects.filter(Plant_id=id)
    ba = Plant.objects.filter(Farmer_id=id)
    aa = {
                'ba': ba,
                'ca': ca
    }
    return render(request, 'Farmer/ViewPlant.html', aa)


@login_required
def EditPlant(request):
    return render(request, 'Farmer/EditPlant.html')


@login_required
def DeletePlant(request):
    return render(request, 'Farmer/DeletePlant.html')


@login_required
def CreatePlant(request):
    return render(request, 'Farmer/CreatePlant.html')


@login_required
def ViewHarvest(request, id):
    da = Plant.objects.filter(Farmer_id=id)
    ca = Harvest.objects.filter(Plant_id=id)
    cc = {
        'da': da,
        'ca': ca
    }
    return render(request, 'Farmer/ViewHarvest.html', cc)


@login_required
def EditHarvest(request):
    return render(request, 'Farmer/EditHarvest.html')


@login_required
def DeleteHarvest(request):
    return render(request, 'Farmer/DeleteHarvest.html')


@login_required
def CreateHarvest(request):
    return render(request, 'Farmer/CreateHarvest.html')


@login_required
def test(request):
    return render(request, 'Farmer/test.html')