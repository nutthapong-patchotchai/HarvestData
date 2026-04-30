from django import forms

from Farmer.models import FarmerProfile, HarvestRecord, Planting


class FarmerProfileForm(forms.ModelForm):
    class Meta:
        model = FarmerProfile
        fields = ["first_name", "last_name", "age", "address", "phone", "village"]


class PlantingForm(forms.ModelForm):
    class Meta:
        model = Planting
        fields = ["farmer", "fruit", "variety", "area_rai", "planted_at", "note"]


class HarvestRecordForm(forms.ModelForm):
    class Meta:
        model = HarvestRecord
        fields = ["planting", "harvest_year", "quantity_kg", "price_per_kg", "harvested_at", "note"]
