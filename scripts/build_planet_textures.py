"""Download NASA global mosaics from Solar System Treks and save them as globe textures.

Writes shared/textures/<world>.jpg (2048 x 1024, equirectangular) for the Moon, Mars,
Mercury and Ceres. Run from the repo root:  python scripts/build_planet_textures.py
Needs: Python 3.10+, Pillow.
"""
import io
import subprocess
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "shared" / "textures"
ZOOM = 2  # equirectangular tile matrix: 2^(z+1) x 2^z tiles of 256 px -> 2048 x 1024

LAYERS = {
    "moon": ("Moon", "LRO_WAC_Mosaic_Global_303ppd_v02"),                  # LRO Wide Angle Camera
    "mars": ("Mars", "Mars_Viking_MDIM21_ClrMosaic_global_232m"),          # Viking colour mosaic
    "mercury": ("Mercury", "Mercury_MESSENGER_MDIS_Basemap_EnhancedColor_Mosaic_Global_665m"),
    "ceres": ("Ceres", "Ceres_Dawn_FC_HAMO_ClrShade_DLR_Global_60ppd_Oct2016"),
}
URL = "https://trek.nasa.gov/tiles/{body}/EQ/{layer}/1.0.0/default/default028mm/{z}/{r}/{c}.jpg"


def get(url: str) -> bytes:
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            return resp.read()
    except Exception:
        return subprocess.run(["curl.exe", "-sf", url], check=True, capture_output=True).stdout


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    cols, rows = 2 ** (ZOOM + 1), 2 ** ZOOM
    for name, (body, layer) in LAYERS.items():
        img = Image.new("RGB", (cols * 256, rows * 256))
        missing = 0
        for r in range(rows):
            for c in range(cols):
                try:
                    tile = Image.open(io.BytesIO(get(URL.format(body=body, layer=layer, z=ZOOM, r=r, c=c)))).convert("RGB")
                    img.paste(tile, (c * 256, r * 256))
                except Exception:
                    missing += 1
        img.save(OUT / f"{name}.jpg", quality=84, optimize=True)
        print(f"{name}: {img.size}, missing tiles {missing}")


if __name__ == "__main__":
    main()
