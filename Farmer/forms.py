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
        ]

        def __init__(self, *args, **kwargs):
            super(Farmer, self).__init__(*args, **kwargs)
            self.helper = addFarmer()
            self.helper.form_show_title = False

class addPlant(forms.ModelForm):
    class Meta:
        model = Plant
        fields = [
            'fruit_name',
            'fruit_breed',
            'scale'
        ]

class addHarvest(forms.ModelForm):
    class Meta:
        model = Harvest
        fields = [
            'product',
            'years'
        ]