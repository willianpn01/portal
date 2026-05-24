from rom_library.models import SaveState
import os

for s in SaveState.objects.all():
      print(f"Slot {s.slot}: {os.path.getsize(s.state_path):,} bytes")