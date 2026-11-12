from django.test import TestCase
from rest_framework.test import APIClient

from .models import User


class ProfileUpdateTests(TestCase):
    def test_user_cannot_grant_self_staff(self):
        user = User.objects.create_user('u1', password='x')
        client = APIClient()
        client.force_authenticate(user)
        r = client.patch('/api/auth/me/update/', {'is_staff': True, 'first_name': 'Ana'}, format='json')
        self.assertEqual(r.status_code, 200)
        user.refresh_from_db()
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertEqual(user.first_name, 'Ana')
