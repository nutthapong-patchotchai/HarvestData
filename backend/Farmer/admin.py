from django.contrib import admin

# Register your models here.

from Farmer.models import User,Farmer,Plant,Harvest,YearSet,Fruit

admin.site.register(Farmer)
admin.site.register(Plant)
admin.site.register(Harvest)
admin.site.register(YearSet)
admin.site.register(Fruit)