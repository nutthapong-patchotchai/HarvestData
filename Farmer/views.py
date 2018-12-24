from django.shortcuts import render


def index(request):
    return render(request, 'Farmer/index.html')


def login(request):
    return render(request, 'Farmer/login.html')