"""Build the public media download from an explicit list of existing project assets."""

import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
FILES = {
    "logos/arguseye.svg": "docs/assets/icon.svg",
    "logos/arguseye.png": "docs/assets/icon.png",
    "social/arguseye-share-card.png": "docs/assets/og-hero.png",
    "arguseye-facts.md": "docs/media/arguseye-facts.md",
    "LICENSE": "LICENSE",
}

payload = {name: (ROOT / source).read_bytes() for name, source in FILES.items()}
manifest = {
    "product": "Arguseye",
    "factsCheckedOn": "2026-10-30",
    "website": "https://darkworldcoder.github.io/arguseye/",
    "mediaNote": "Existing project logos and website artwork. No new application screenshots.",
    "files": {
        name: {
            "source": FILES[name],
            "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
        }
        for name, data in payload.items()
    },
}
payload["manifest.json"] = (json.dumps(manifest, indent=2) + "\n").encode()
destination = ROOT / "docs/assets/arguseye-media-kit.zip"
with ZipFile(destination, "w", ZIP_DEFLATED) as archive:
    for name, data in payload.items():
        # Stable metadata makes identical approved assets produce identical archives.
        entry = ZipInfo(name, date_time=(2026, 10, 30, 0, 0, 0))
        entry.compress_type = ZIP_DEFLATED
        entry.external_attr = 0o644 << 16
        archive.writestr(entry, data)

print(f"Built {destination.relative_to(ROOT)}: {len(payload)} files, {destination.stat().st_size:,} bytes")
