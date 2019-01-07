from django.shortcuts import render


def index(request):
    return render(request, 'Farmer/index.html')


def login(request):
    return render(request, 'Farmer/login.html')


def CreateFarmer(request):
    return render(request, 'Farmer/CreateFarmer.html')


def EditFarmer(request):
    return render(request, 'Farmer/EditFarmer.html')


def DeleteFarmer(request):
    return render(request, 'Farmer/DeleteFarmerForm.html')


def ViewFarmer(request):
    return render(request, 'Farmer/ViewPlant.html')


def EditPlant(request):
    return render(request, 'Farmer/EditPlant.html')


def DeletePlant(request):
    return render(request, 'Farmer/DeletePlant.html')


def CreatePlant(request):
    return render(request, 'Farmer/CreatePlant.html')

def ViewHarvest(request):
    return render(request, 'Farmer/ViewHarvest.html')


def EditHarvest(request):
    return render(request, 'Farmer/EditHarvest.html')


def DeleteHarvest(request):
    return render(request, 'Farmer/DeleteHarvest.html')


def CreateHarvest(request):
    return render(request, 'Farmer/CreateHarvest.html')