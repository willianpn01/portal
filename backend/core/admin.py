from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ('Portal', {'fields': ('avatar', 'theme')}),
    )
    list_display = ['username', 'email', 'is_staff', 'theme']
