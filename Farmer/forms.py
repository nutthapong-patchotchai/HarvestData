from django import forms
from Farmer.models import Farmer,Plant,Harvest


class addFarmer(forms.ModelForm):
    class Meta:
        model = Farmer
        fields = [
            'name',
            'lastname',
            'age',
            'address',
            'tel',
            'User_id'
        ]

class addPlant(forms.ModelForm):
    class Meta:
        model = Plant
        fields = [
            'fruit_name',
            'fruit_breed',
            'scale',
            'Farmer_id'
        ]

class addHarvest(forms.ModelForm):
    class Meta:
        model = Harvest
        fields = [
            'product',
            'years',
            'Plant_id'
        ]