from django.contrib.auth import authenticate, update_session_auth_hash
from django.contrib.auth.forms import PasswordChangeForm
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.contrib.auth.models import User
from django.http import HttpResponse
from django.shortcuts import render, redirect, get_object_or_404
# from spyder.config import user
from Farmer.models import Farmer, Plant, Harvest, YearSet, Fruit
from django.contrib.auth.decorators import login_required
from Farmer.forms import addFarmer, addPlant, addHarvest
from django.contrib import messages, auth
from django.core.paginator import Paginator
from django.db.models import Q, Exists
import json as simplejson

import sweetify


@login_required
class ViewData(LoginRequiredMixin, UserPassesTestMixin):
    def base(request):
        viewfarmer = Farmer.objects.filter(User_id=request.user)
        viewplant = Plant.objects.filter(User_id=request.user)
        viewharvest = Harvest.objects.filter(User_id=request.user)
        viewfarmerpage = {
            'viewFarmer': viewfarmer,
            'viewPlant': viewplant,
            'viewHarvest': viewharvest,
        }
        return render(request, 'Farmer/base.html', viewfarmerpage)

    @login_required
    def ViewFarmer(request):
        viewfarmer = Farmer.objects.filter(User_id=request.user)
        # (User_id=request.user)
        if request.user.is_staff or request.user.is_superuser:
            viewfarmer = Farmer.objects.all()

        viewplant = Plant.objects.filter(User_id=request.user)
        viewharvest = Harvest.objects.filter(User_id=request.user)
        viewyears = YearSet.objects.all()
        viewfruit = Fruit.objects.all()
        viewuser = User.objects.all()
        query = request.GET.get("q")
        if query:
            viewfarmer = viewfarmer.filter(
                Q(name__icontains=query) |
                Q(lastname__icontains=query)
            ).distinct()
        paginator = Paginator(viewfarmer, 10)
        page = request.GET.get('page')
        farmerpage = paginator.get_page(page)



        viewfarmerpage = {
            'viewFarmer': viewfarmer,
            'famerpage': farmerpage,
            'viewPlant': viewplant,
            'viewHarvest': viewharvest,
            'viewFruit': viewfruit,
            'viewyears': viewyears,
            'viewuser': viewuser

        }
        return render(request, 'Farmer/index.html', viewfarmerpage)

    @login_required
    def ViewPlant(request, Farmer_id):
        viewfarmers = Farmer.objects.filter(User_id=request.user)
        viewfarmer = Farmer.objects.get(id=Farmer_id)
        if request.user.id == viewfarmer.User_id.id or request.user.is_staff or request.user.is_superuser:
            viewplant = Plant.objects.filter(Farmer_id=Farmer_id)
            query = request.GET.get("q")
            if query:
                viewplant = viewplant.filter(
                    Q(fruit_name__fruit_name__icontains=query) |
                    Q(fruit_breed__icontains=query)
                ).distinct()
            viewplantpage = {
                'viewFarmer': viewfarmers,
                'viewplant': viewplant,
                'viewfarmer': viewfarmer,
            }
            return render(request, 'Farmer/ViewPlant.html', viewplantpage)
        else:
            return redirect('/')

    @login_required
    def ViewHarvest(request, Farmer_id, Plant_id):
        viewfarmers = Farmer.objects.filter(User_id=request.user)
        viewfarmer = Farmer.objects.get(id=Farmer_id)
        if request.user.id == viewfarmer.User_id.id or request.user.is_staff or request.user.is_superuser:
            viewplant = Plant.objects.get(id=Plant_id)
            viewharvests = Plant.objects.get(id=Plant_id)
            viewharvest = Harvest.objects.filter(Plant_id=Plant_id).order_by('years')[::1]
            viewharvestpage = {
                'viewFarmer': viewfarmers,
                'viewplant': viewplant,
                'viewharvest': viewharvest,
                'viewharvests': viewharvests,
                'viewfarmer': viewfarmer,
            }
            return render(request, 'Farmer/ViewHarvest.html', viewharvestpage)
        else:
            return redirect('/')

    @login_required
    def ViewFruit(request, Farmer_id, Plant_id):
        viewfarmers = Farmer.objects.filter(User_id=request.user)
        viewfarmer = Farmer.objects.get(id=Farmer_id)
        if request.user.id == viewfarmer.User_id.id or request.user.is_staff or request.user.is_superuser:
            viewplant = Plant.objects.get(id=Plant_id)
            viewharvests = Plant.objects.get(id=Plant_id)
            viewharvest = Harvest.objects.filter(Plant_id_id=Plant_id)
            viewharvestpage = {
                'viewFarmer': viewfarmers,
                'viewplant': viewplant,
                'viewharvest': viewharvest,
                'viewharvests': viewharvests,
                'viewfarmer': viewfarmer,
            }
            return render(request, 'Farmer/ViewHarvest.html', viewharvestpage)
        else:
            return redirect('/')


@login_required
class CreateData():
    @login_required
    def CreateFarmer(request, Farmer_id):
        viewfarmer = Farmer.objects.filter(User_id=request.user)
        if request.method == 'POST':
            farmerform = addFarmer(request.POST)
            if farmerform.is_valid():
                createfarmer = farmerform.save(commit=False)
                createfarmer.User_id = User(Farmer_id)
                createfarmer.user = request.user
                createfarmer.save()
                messages.success(request, 'เพิ่มข้อมูลเกษตรกร สำเร็จ')
                return redirect('/')
        else:
            farmerform = addFarmer()

        createfarmerform = {
            'viewFarmer': viewfarmer,
            'farmerform': farmerform,
        }
        return render(request, 'Farmer/CreateFarmer.html', createfarmerform)

    @login_required
    def CreatePlant(request, Farmer_id, id):
        viewfarmers = Farmer.objects.filter(User_id=request.user)
        viewfarmer = Farmer.objects.get(id=Farmer_id)
        if request.user.id == viewfarmer.User_id.id:
            if request.method == 'POST':
                plantform = addPlant(request.POST)
                if plantform.is_valid():
                    createplant = plantform.save(commit=False)
                    createplant.User_id = User(id)
                    createplant.Farmer_id = Farmer(Farmer_id)
                    createplant.user = request.user
                    createplant.save()
                    messages.success(request, 'เพิ่มข้อมูลการปลูกของเกษตรกร สำเร็จ')
                    return redirect('../../../')
            else:
                plantform = addPlant()
        else:
            return redirect('/')

        plantcreateform = {
            'viewFarmer': viewfarmers,
            'plantform': plantform,
            'viewfarmer': viewfarmer
        }
        return render(request, 'Farmer/CreatePlant.html', plantcreateform)

    @login_required
    def CreateHarvest(request, Plant_id, Harvest_id, ids):
        viewfarmers = Farmer.objects.get(id=Plant_id)
        viewfarmer = Farmer.objects.filter(User_id=request.user)
        viewplant = Plant.objects.get(id=Harvest_id)
        if request.method == 'POST':
            harvestform = addHarvest(request.POST)
            if harvestform.is_valid():
                createharvest = harvestform.save(commit=False)
                createharvest.User_id = User(ids)
                createharvest.Plant_id = Plant(Harvest_id)
                createharvest.user = request.user
                if (Harvest.objects.filter(Plant_id=Harvest_id) & Harvest.objects.filter(
                        years_id=createharvest.years.id)).exists():
                    messages.warning(request, 'เพิ่มข้อมูลการเก็บเกี่ยว ไม่สำเร็จเนื่องจากปีซ้ำ')
                else:
                    createharvest.save()
                    messages.success(request, 'เพิ่มข้อมูลการเก็บเกี่ยว สำเร็จ')
                    return redirect("../../")

            else:
                messages.warning(request, 'เพิ่มไม่สำเร็จ')
                harvestcreateform = {
                    'viewFarmer': viewfarmer,
                    'harvestform': harvestform,
                    'viewplant': viewplant,
                    'viewfarmers': viewfarmers
                }
                return render(request, 'Farmer/CreateHarvest.html', harvestcreateform)

        else:
            harvestform = addHarvest()

        harvestcreateform = {
            'viewFarmer': viewfarmer,
            'harvestform': harvestform,
            'viewplant': viewplant,
            'viewfarmers': viewfarmers
        }
        return render(request, 'Farmer/CreateHarvest.html', harvestcreateform)


@login_required
class Fruits():
    @login_required
    def Fruitss(request, Fruit_id):
        viewfarmer = Farmer.objects.filter(User_id=request.user)
        viewplant = Plant.objects.filter(User_id=request.user)
        viewharvest = Harvest.objects.filter(User_id=request.user)
        viewfruit = Fruit.objects.get(id=Fruit_id)
        viewyears = YearSet.objects.all()
        viewfarmerpage = {
            'viewFarmer': viewfarmer,
            'viewPlant': viewplant,
            'viewHarvest': viewharvest,
            'viewfruit': viewfruit,
            'viewyears': viewyears
        }
        return render(request, 'Fruit/Fruit.html', viewfarmerpage)

    @login_required
    def Fruitssyear(request, Fruit_id, Year_id):
        viewfarmer = Farmer.objects.filter(User_id=request.user)
        viewplant = Plant.objects.filter(User_id=request.user)
        viewharvest = Harvest.objects.filter(User_id=request.user)
        viewfruit = Fruit.objects.get(id=Fruit_id)
        viewyears = YearSet.objects.get(id=Year_id)
        viewfarmerpage = {
            'viewFarmer': viewfarmer,
            'viewPlant': viewplant,
            'viewHarvest': viewharvest,
            'viewfruit': viewfruit,
            'viewyears': viewyears
        }
        return render(request, 'Fruit/FruitYear.html', viewfarmerpage)


@login_required
class EditData():
    @login_required
    def EditFarmer(request, Farmer_id):
        viewfarmer = Farmer.objects.filter(User_id=request.user)
        editfarmer = get_object_or_404(Farmer, id=Farmer_id)
        editfarmerform = addFarmer(request.POST or None, instance=editfarmer)
        if editfarmerform.is_valid():
            editfarmers = editfarmerform.save(commit=False)
            editfarmers.user = request.user
            editfarmers.save()
            messages.warning(request, 'แก้ไขข้อมูลเกษตรกร สำเร็จ')
            return redirect('/')
        editfarmerforms = {
            'viewFarmer': viewfarmer,
            'editfarmerform': editfarmerform,
        }
        return render(request, 'Farmer/EditFarmer.html', editfarmerforms)

    @login_required
    def EditPlant(request, Farmer_id, Plant_id):
        viewfarmers = Farmer.objects.get(id=Farmer_id)
        viewfarmer = Farmer.objects.filter(User_id=request.user)
        viewplant = Plant.objects.filter(Farmer_id=Farmer_id)
        editplant = get_object_or_404(Plant, id=Plant_id)
        editplantform = addPlant(request.POST or None, instance=editplant)
        if editplantform.is_valid():
            editplants = editplantform.save(commit=False)
            editplants.user = request.user
            editplants.save()
            messages.warning(request, 'แก้ไขข้อมูลการปลูกของเกษตรกร สำเร็จ')
            return redirect('../../')
        editplantforms = {
            'viewFarmer': viewfarmer,
            'editplantform': editplantform,
            'viewfarmers': viewfarmers
        }
        return render(request, 'Farmer/EditPlant.html', editplantforms)

    @login_required
    def EditHarvest(request, Farmer_id, Harvest_id, id):
        viewfarmers = Farmer.objects.get(id=Farmer_id)
        viewfarmer = Farmer.objects.filter(User_id=request.user)
        viewplant = Plant.objects.filter(Farmer_id=Farmer_id)
        viewharvest = Harvest.objects.filter(Plant_id=id)
        editharvest = get_object_or_404(Harvest, id=id)
        viewplants = Plant.objects.get(id=Harvest_id)
        editharvestform = addHarvest(request.POST or None, instance=editharvest)
        if editharvestform.is_valid():
            editharvests = editharvestform.save(commit=False)
            editharvests.user = request.user
            editharvests.save()
            messages.warning(request, 'แก้ไขข้อมูลการเก็บเกี่ยวของการปลูกของเกษตรกร สำเร็จ')
            return redirect('../')
        editharvestforms = {
            'viewFarmer': viewfarmer,
            'editharvestform': editharvestform,
            'viewfarmers': viewfarmers,
            'viewplants': viewplants,
        }
        return render(request, 'Farmer/EditHarvest.html', editharvestforms)

    @login_required
    def EditPassword(request):
        if request.method == 'POST':
            form = PasswordChangeForm(data=request.POST, user=request.user)

            if form.is_valid():
                form.save()
                update_session_auth_hash(request, form.user)
                messages.success(request, 'แก้ไขแก้ไขรหัสผ่าน สำเร็จ')
                return redirect('../')
            else:
                messages.warning(request, 'แก้ไขแก้ไขรหัสผ่าน ไม่สำเร็จ')
                return redirect('changepassword/')
        else:
            form = PasswordChangeForm(user=request.user)

            args = {'form': form}

            return render(request, 'Farmer/ChangePassword.html', args)


@login_required
class DeleteData():
    @login_required
    def DeleteFarmer(request, Farmer_id):
        deletefarmer = get_object_or_404(Farmer, id=Farmer_id)
        checkuser = deletefarmer.User_id.username

        if request.user.username == checkuser:
            deletefarmer.delete()
            messages.error(request, 'ลบข้อมูลเกษตรกรสำเร็จ')
            return redirect('/')
        else:
            return redirect('/')

    @login_required
    def DeletePlant(request, Farmer_id, Plant_id):
        viewfarmer = Farmer.objects.filter(User_id=request.user)
        deleteplant = get_object_or_404(Plant, id=Plant_id)
        messages.error(request, 'ลบขข้อมูลการปลูกของเกษตรกรสำเร็จ')
        deleteplant.delete()
        return redirect('../../')

    @login_required
    def DeleteHarvest(request, Plant_id, Harvest_id, id):
        deleteHarvest = get_object_or_404(Harvest, pk=id)
        messages.error(request, 'ลบขข้อมูลการเก็บเกี่ยวของการปลูกของเกษตรกรสำเร็จ')
        deleteHarvest.delete()
        return redirect("../")


def test(request):
    return render(request, 'Farmer/test.html')
