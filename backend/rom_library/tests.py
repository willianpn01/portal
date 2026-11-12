import tempfile
from pathlib import Path

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .covers import resolve_cover
from .models import Platform, ROM


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
