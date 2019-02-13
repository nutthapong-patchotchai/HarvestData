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