import tempfile
from pathlib import Path

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .covers import resolve_cover
from .models import Platform, ROM, SaveState, ScanJob


class CoverTests(TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.plat = Platform.objects.get_or_create(slug="snes", defaults={"name": "SNES", "emulatorjs_core": "snes9x"})[0]
        self.tgdb = self.tmp / "tgdb.jpg"
        self.tgdb.write_bytes(b"tgdb")
        self.rom = ROM.objects.create(platform=self.plat, title="Foo", file_path="/roms/Foo.smc",
                                      file_size=1, cover_path=str(self.tgdb))

    def _local(self, content=b"local"):
        d = self.tmp / "covers" / "snes"
        d.mkdir(parents=True, exist_ok=True)
        (d / "Foo.png").write_bytes(content)

    def test_local_has_priority(self):
        self._local()
        with override_settings(ROM_COVERS_DIR=self.tmp / "covers"):
            self.assertEqual(resolve_cover(self.rom).name, "Foo.png")
            r = APIClient().get(f"/api/roms/{self.rom.pk}/cover/")
            self.assertEqual(r.status_code, 200)
            self.assertEqual(r["Content-Type"], "image/png")

    def test_fallback_to_tgdb(self):
        with override_settings(ROM_COVERS_DIR=self.tmp / "covers"):
            self.assertEqual(resolve_cover(self.rom), self.tgdb)
            self.assertEqual(APIClient().get(f"/api/roms/{self.rom.pk}/cover/").status_code, 200)

    def test_no_cover_404(self):
        self.rom.cover_path = ""
        self.rom.save()
        with override_settings(ROM_COVERS_DIR=self.tmp / "covers"):
            self.assertIsNone(resolve_cover(self.rom))
            self.assertEqual(APIClient().get(f"/api/roms/{self.rom.pk}/cover/").status_code, 404)

    def test_local_only_rom_has_cover_url(self):
        self.rom.cover_path = ""
        self.rom.save()
        self._local()
        with override_settings(ROM_COVERS_DIR=self.tmp / "covers"):
            from .serializers import ROMSerializer
            self.assertTrue(ROMSerializer(self.rom).data["cover_url"].endswith(f"/api/roms/{self.rom.pk}/cover/"))


class _AuthMixin:
    def _client(self, user):
        c = APIClient()
        c.force_authenticate(user)
        return c


class RevalidateTests(_AuthMixin, TestCase):
    def setUp(self):
        from django.contrib.auth import get_user_model
        self.user = get_user_model().objects.create_user('rv', password='x')
        self.tmp = Path(tempfile.mkdtemp())
        self.root = self.tmp / "roms"
        self.root.mkdir()
        self.plat = Platform.objects.get_or_create(slug="snes", defaults={"name": "SNES", "emulatorjs_core": "snes9x"})[0]
        ScanJob.objects.create(roms_path=str(self.root))

    def _rom(self, name, exists):
        f = self.root / name
        if exists:
            f.write_bytes(b"x")
        return ROM.objects.create(platform=self.plat, title=name, file_path=str(f), file_size=1)

    def _post(self):
        with override_settings(EXECUTABLES_CONFIG=self.tmp / "none.json"):
            return self._client(self.user).post("/api/roms/revalidate/")

    def test_removes_missing_when_folder_healthy(self):
        self._rom("a.sfc", True)
        self._rom("b.sfc", False)
        r = self._post()
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["removed"], 1)
        self.assertEqual(ROM.objects.count(), 1)

    def test_folder_empty_removes_nothing(self):
        self._rom("b.sfc", False)
        r = self._post()
        self.assertEqual(r.status_code, 409)
        self.assertEqual(ROM.objects.count(), 1)

    def test_folder_missing_removes_nothing(self):
        self._rom("b.sfc", False)
        self.root.rmdir()
        r = self._post()
        self.assertEqual(r.status_code, 409)
        self.assertEqual(ROM.objects.count(), 1)

    def test_rom_outside_known_roots_is_kept(self):
        self._rom("a.sfc", True)
        ROM.objects.create(platform=self.plat, title="x", file_path="/nowhere/x.sfc", file_size=1)
        r = self._post()
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["removed"], 0)
        self.assertEqual(r.data["unverified"], 1)


class SaveStateUserTests(_AuthMixin, TestCase):
    def setUp(self):
        from django.contrib.auth import get_user_model
        U = get_user_model()
        self.u1 = U.objects.create_user('s1', password='x')
        self.u2 = U.objects.create_user('s2', password='x')
        self.media = Path(tempfile.mkdtemp())
        plat = Platform.objects.get_or_create(slug="snes", defaults={"name": "SNES", "emulatorjs_core": "snes9x"})[0]
        self.rom = ROM.objects.create(platform=plat, title="G", file_path="/r/g.sfc", file_size=1)

    def _save(self, user, payload):
        from django.core.files.uploadedfile import SimpleUploadedFile
        with override_settings(MEDIA_ROOT=self.media):
            return self._client(user).post(
                f"/api/roms/{self.rom.pk}/savestates/1/",
                {"state": SimpleUploadedFile("s.bin", payload)}, format="multipart")

    def test_same_slot_two_users_isolated_and_download_ok(self):
        self.assertEqual(self._save(self.u1, b"one").status_code, 200)
        self.assertEqual(self._save(self.u2, b"two").status_code, 200)
        paths = {s.user_id: s.state_path for s in SaveState.objects.all()}
        self.assertNotEqual(paths[self.u1.pk], paths[self.u2.pk])
        self.assertIn(f"savestates/{self.u1.pk}/{self.rom.pk}", Path(paths[self.u1.pk]).as_posix())
        for user, expected in ((self.u1, b"one"), (self.u2, b"two")):
            r = self._client(user).get(f"/api/roms/{self.rom.pk}/savestates/1/download/")
            self.assertEqual(r.status_code, 200)
            self.assertEqual(b"".join(r.streaming_content), expected)

    def test_download_anonymous_is_401_not_500(self):
        self._save(self.u1, b"one")
        r = APIClient().get(f"/api/roms/{self.rom.pk}/savestates/1/download/")
        self.assertEqual(r.status_code, 401)
