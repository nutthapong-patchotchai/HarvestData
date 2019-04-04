# Generated by Django 2.1.1 on 2019-03-10 09:51

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('Farmer', '0002_auto_20190203_1828'),
    ]

    operations = [
        migrations.CreateModel(
            name='Fruit',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('fruit_name', models.CharField(default='', max_length=50)),
            ],
            options={
                'ordering': ['fruit_name'],
            },
        ),
    ]