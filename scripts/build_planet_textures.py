"""Download NASA global maps from Solar System Treks and save them as globe textures.

Writes shared/textures/<name>.jpg (2048 x 1024, equirectangular). Run from the repo root:
  python scripts/build_planet_textures.py            # every map
  python scripts/build_planet_textures.py vesta      # only the named ones
  python scripts/build_planet_textures.py --thumbs   # small icon copies in shared/textures/thumbs/
Needs: Python 3.10+, Pillow.

Imagery: Moon (LRO WAC), Mars (Viking), Mercury (MESSENGER), Ceres and Vesta (Dawn).
Elevation: moon-topo (LRO LOLA colour-shaded topography) and mars-topo (MGS MOLA colour-shaded topography).
"""
import io
import subprocess
import sys
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "shared" / "textures"
ZOOM = 2  # equirectangular tile matrix: 2^(z+1) x 2^z tiles of 256 px -> 2048 x 1024

# name -> (Trek body, layer id, tile extension)
LAYERS = {
    "moon": ("Moon", "LRO_WAC_Mosaic_Global_303ppd_v02", "jpg"),                  # LRO Wide Angle Camera
    "mars": ("Mars", "Mars_Viking_MDIM21_ClrMosaic_global_232m", "jpg"),          # Viking colour mosaic
    "mercury": ("Mercury", "Mercury_MESSENGER_MDIS_Basemap_EnhancedColor_Mosaic_Global_665m", "jpg"),
    "ceres": ("Ceres", "Ceres_Dawn_FC_HAMO_ClrShade_DLR_Global_60ppd_Oct2016", "jpg"),
    "vesta": ("Vesta", "Vesta_Dawn_HAMO_ClrShade_DLR_Global_48ppd", "png"),       # Dawn framing camera, colour-shaded topography
    "moon-topo": ("Moon", "LRO_LOLA_ClrShade_Global_128ppd_v04", "png"),          # LOLA laser altimeter
    "mars-topo": ("Mars", "Mars_MGS_MOLA_ClrShade_merge_global_463m", "jpg"),     # MOLA laser altimeter
}
URL = "https://trek.nasa.gov/tiles/{body}/EQ/{layer}/1.0.0/default/default028mm/{z}/{r}/{c}.{ext}"


def get(url: str) -> bytes:
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            return resp.read()
    except Exception:
        return subprocess.run(["curl.exe", "-sf", url], check=True, capture_output=True).stdout


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    cols, rows = 2 ** (ZOOM + 1), 2 ** ZOOM
    wanted = sys.argv[1:] or list(LAYERS)
    for name in wanted:
        body, layer, ext = LAYERS[name]
        img = Image.new("RGB", (cols * 256, rows * 256))
        missing = 0
        for r in range(rows):
            for c in range(cols):
                try:
                    tile = Image.open(io.BytesIO(get(URL.format(body=body, layer=layer, z=ZOOM, r=r, c=c, ext=ext)))).convert("RGB")
                    img.paste(tile, (c * 256, r * 256))
                except Exception:
                    missing += 1
        img.save(OUT / f"{name}.jpg", quality=84, optimize=True)
        print(f"{name}: {img.size}, missing tiles {missing}")


def thumbs() -> None:
    """Small 512 x 256 copies for the planet icons on the hub and landing page (the full maps are only needed by the 3D globes)."""
    out = OUT / "thumbs"
    out.mkdir(exist_ok=True)
    for src in sorted(OUT.glob("*.jpg")):
        if src.stem.endswith("-topo"):
            continue
        img = Image.open(src).convert("RGB").resize((512, 256), Image.LANCZOS)
        img.save(out / src.name, quality=72, optimize=True)
        print(f"thumb {src.name}: {(out / src.name).stat().st_size // 1024} KB")


if __name__ == "__main__":
    if sys.argv[1:] == ["--thumbs"]:
        thumbs()
    else:
        main()
