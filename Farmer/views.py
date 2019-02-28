from django.contrib.auth.models import User
from django.shortcuts import render, redirect, get_object_or_404
from Farmer.models import Farmer, Plant, Harvest
from django.contrib.auth.decorators import login_required
from Farmer.forms import addFarmer, addPlant, addHarvest
from django.contrib import messages
from django.core.paginator import Paginator

import sweetify


@login_required
def ViewFarmer(request):
    viewfarmer = Farmer.objects.filter(User_id=request.user)
    paginator = Paginator(viewfarmer, 10)
    page = request.GET.get('page')
    farmerpage = paginator.get_page(page)
    viewfarmerpage = {
            'viewFarmer': viewfarmer,
            'famerpage': farmerpage
    }
    return render(request, 'Farmer/index.html', viewfarmerpage)


@login_required
def CreateFarmer(request, Farmer_id):
    if request.method == 'POST':
        farmerform = addFarmer(request.POST)
        if farmerform.is_valid():
            createfarmer = farmerform.save(commit=False)
            createfarmer.User_id = User(Farmer_id)
            createfarmer.user = request.user
            createfarmer.save()
            return redirect('/')
    else:
        farmerform = addFarmer()

    createfarmerform ={
        'farmerform': farmerform,
    }
    return render(request, 'Farmer/CreateFarmer.html', createfarmerform)


@login_required
def EditFarmer(request, Farmer_id):
    editfarmer = get_object_or_404(Farmer, id=Farmer_id)
    editfarmerform = addFarmer(request.POST or None, instance=editfarmer)
    if editfarmerform.is_valid():
        editfarmers = editfarmerform.save(commit=False)
        editfarmers.user = request.user
        editfarmers.save()
        return redirect('/')
    editfarmerforms = {
        'editfarmerform': editfarmerform,
    }
    return render(request, 'Farmer/EditFarmer.html', editfarmerforms)


@login_required
def DeleteFarmer(request, Farmer_id):
    deletefarmer = get_object_or_404(Farmer, id=Farmer_id)
    checkuser = deletefarmer.User_id.username

    if request.user.username == checkuser:
        deletefarmer.delete()
        return redirect('/')
    else:
        return redirect('/')


@login_required
def ViewPlant(request, Farmer_id):
    viewfarmer = Farmer.objects.get(id=Farmer_id)
    viewplant = Plant.objects.filter(Farmer_id=Farmer_id)
    viewplantpage = {
                'viewplant': viewplant,
                'viewfarmer': viewfarmer
    }
    return render(request, 'Farmer/ViewPlant.html', viewplantpage)


@login_required
def EditPlant(request,Farmer_id, Plant_id):
    viewplant = Plant.objects.filter(Farmer_id=Farmer_id)
    editplant = get_object_or_404(Plant, id=Plant_id)
    editplantform = addPlant(request.POST or None, instance=editplant)
    if editplantform.is_valid():
        editplants = editplantform.save(commit=False)
        editplants.user = request.user
        editplants.save()
        return redirect('/')
    editplantforms = {
        'editplantform': editplantform,
    }
    return render(request, 'Farmer/EditPlant.html', editplantforms)


@login_required
def DeletePlant(request,Farmer_id,Plant_id):
    deleteplant = get_object_or_404(Plant, id=Plant_id)
    deleteplant.delete()
    return redirect('/')



@login_required
def CreatePlant(request, Farmer_id):
    viewfarmer = Farmer.objects.get(id=Farmer_id)
    if request.method == 'POST':
        plantform = addPlant(request.POST)
        if plantform.is_valid():
            createplant = plantform.save(commit=False)
            createplant.Farmer_id = Farmer(Farmer_id)
            createplant.user = request.user
            createplant.save()
            return redirect('/farmer/')
    else:
        plantform = addPlant()

    plantcreateform ={
        'plantform': plantform,
        'viewfarmer': viewfarmer
    }
    return render(request, 'Farmer/CreatePlant.html', plantcreateform)


@login_required
def ViewHarvest(request, Farmer_id, Plant_id):
    viewfarmer = Farmer.objects.get(id=Farmer_id)
    viewplant = Plant.objects.get(id=Plant_id)
    viewharvests = Plant.objects.get(id=Plant_id)
    viewharvest = Harvest.objects.filter(Plant_id=Plant_id)
    viewharvestpage = {
        'viewplant': viewplant,
        'viewharvest': viewharvest,
        'viewharvests': viewharvests,
        'viewfarmer': viewfarmer
    }
    return render(request, 'Farmer/ViewHarvest.html', viewharvestpage)


@login_required
def EditHarvest(request, Farmer_id, Harvest_id):
    viewplant = Plant.objects.filter(Farmer_id=Farmer_id)
    viewharvest = Harvest.objects.filter(Plant_id=Harvest_id)
    editharvest = get_object_or_404(Harvest, id=Harvest_id)
    editharvestform = addHarvest(request.POST or None, instance=editharvest)
    if editharvestform.is_valid():
        editharvests = editharvestform.save(commit=False)
        editharvests.user = request.user
        editharvests.save()
        return redirect('/')
    editharvestforms = {
        'editharvestform': editharvestform,
    }
    return render(request, 'Farmer/EditHarvest.html', editharvestforms)


@login_required
def DeleteHarvest(request,Harvest_id):
    deleteHarvest = get_object_or_404(Harvest, pk=Harvest_id)
    deleteHarvest.delete()
    return redirect('/')


@login_required
def CreateHarvest(request, Harvest_id):
    viewplant = Plant.objects.get(id=Harvest_id)
    if request.method == 'POST':
        harvestform = addHarvest(request.POST)
        if harvestform.is_valid():
            createharvest = harvestform.save(commit=False)
            createharvest.Plant_id = Plant(Harvest_id)
            createharvest.user = request.user
            createharvest.save()
            return redirect("/")
    else:
        harvestform = addHarvest()

    harvestcreateform ={
        'harvestform': harvestform,
        'viewplant': viewplant,
    }
    return render(request, 'Farmer/CreateHarvest.html', harvestcreateform)


@login_required
def test(request):
    contact_list = Farmer.objects.filter(User_id=request.user)
    paginator = Paginator(contact_list, 10)

    page = request.GET.get('page')
    contacts = paginator.get_page(page)
    return render(request, 'Farmer/test.html', {'contacts': contacts})
