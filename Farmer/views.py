from django.contrib.auth.models import User
from django.shortcuts import render, redirect, get_object_or_404
from Farmer.models import Farmer, Plant, Harvest
from django.contrib.auth.decorators import login_required
from Farmer.forms import addFarmer
from django.contrib import messages
import sweetify


@login_required
def ViewFarmer(request):
    viewfarmer = Farmer.objects.filter(User_id=request.user)

    viewfarmerpage = {
            'viewFarmer': viewfarmer
    }
    return render(request, 'Farmer/index.html', viewfarmerpage)


@login_required
def CreateFarmer(request, id):
    if request.method == 'POST':
        farmerform = addFarmer(request.POST)
        if farmerform.is_valid():
            createfarmer = farmerform.save(commit=False)
            createfarmer.user = request.user
            createfarmer.save()
            return redirect("/")
    else:
        farmerform = addFarmer()

    context ={
        'farmerform': farmerform,
    }
    return render(request, 'Farmer/CreateFarmer.html', context)


@login_required
def EditFarmer(request, id):
    editfarmer = get_object_or_404(Farmer, id=id)
    editfarmerform = addFarmer(request.POST or None, instance=editfarmer)
    if editfarmerform.is_valid():
        editfarmer = editfarmerform.save(commit=False)
        editfarmer.user = request.user
        editfarmer.save()
        return redirect('/')
    context = {
        'editfarmerform': editfarmerform,
    }
    return render(request, 'Farmer/EditFarmer.html', context)


@login_required
def DeleteFarmer(request, id):
    deletefarmer = get_object_or_404(Farmer, id=id)
    checkuser = deletefarmer.User_id.username

    if request.user.username == checkuser:
        deletefarmer.delete()
        return redirect('/')
    else:
        return redirect('/')


@login_required
def ViewPlant(request, Farmer_id):
    viewplant = Plant.objects.filter(Farmer_id=Farmer_id)
    viewplantpage = {
                'viewplant': viewplant
    }
    return render(request, 'Farmer/ViewPlant.html', viewplantpage)


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
def ViewHarvest(request, Farmer_id, Plant_id):
    da = Plant.objects.filter(Farmer_id=Farmer_id)
    viewharvest = Harvest.objects.filter(Plant_id=Plant_id)
    viewharvestpage = {
        'da': da,
        'viewharvest': viewharvest
    }
    return render(request, 'Farmer/ViewHarvest.html', viewharvestpage)


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
    sweetify.success(request, 'You did it', text='Good job! You successfully showed a SweetAlert message',
                     persistent='Hell yeah')
    return redirect('/')
