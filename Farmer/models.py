from django.db import models
from django.contrib.auth.models import User


class YearSet(models.Model):
    year = models.CharField(max_length=4, default='')

    class Meta:
        ordering = ["-year"]

    def __str__(self):
        return self.year


class Farmer(models.Model):
    User_id = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=100, default='')
    lastname = models.CharField(max_length=100, default='')
    age = models.IntegerField(default='')
    address = models.TextField(max_length=500, default='')
    tel = models.CharField(max_length=100, default='')

    def __str__(self):
        return "name = "+str(self.name)+" id="+str(self.id)


class Plant(models.Model):
    fruit_name = models.CharField(max_length=100, default='')
    fruit_breed = models.CharField(max_length=100, default='')
    scale = models.CharField(max_length=100, default='')
    Farmer_id = models.ForeignKey(Farmer, on_delete=models.CASCADE)

    def __str__(self):
        return self.fruit_name


class Harvest(models.Model):
    product = models.IntegerField(default='')
    years = models.ForeignKey(YearSet, on_delete=models.CASCADE, default='2017')
    Plant_id = models.ForeignKey(Plant, on_delete=models.CASCADE)

    def __str__(self):
        return str(self.id)+" "+str(self.Plant_id)+"/"+str(self.product)+"กิโลกรัม/"+str(self.years)