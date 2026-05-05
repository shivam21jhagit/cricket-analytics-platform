from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
import zipfile

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_PHOTO_DIR = ROOT / "public" / "player-photos"
MANIFEST_PATH = ROOT / "src" / "data" / "playerPhotoManifest.json"
DEFAULT_ZIP_PATH = Path.home() / "Downloads" / "archive (1).zip"
IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")

PLAYER_IMPORTS = [
    {
        "folder": "adam_gilchrist",
        "asset_name": "adam-gilchrist.jpg",
        "aliases": ["Adam Gilchrist", "AC Gilchrist"],
    },
    {
        "folder": "alastair_cook",
        "asset_name": "alastair-cook.jpg",
        "aliases": ["Alastair Cook", "AN Cook"],
    },
    {
        "folder": "allan_donald",
        "asset_name": "allan-donald.jpg",
        "aliases": ["Allan Donald", "AA Donald"],
    },
    {
        "folder": "brian_lara",
        "asset_name": "brian-lara.jpg",
        "aliases": ["Brian Lara", "BC Lara"],
    },
    {
        "folder": "chris_gayle",
        "asset_name": "chris-gayle.jpg",
        "aliases": ["Chris Gayle", "CH Gayle"],
    },
    {
        "folder": "dale_steyn",
        "asset_name": "dale-steyn.jpg",
        "aliases": ["Dale Steyn", "DW Steyn"],
    },
    {
        "folder": "glenn_mcgrath",
        "asset_name": "glenn-mcgrath.jpg",
        "aliases": ["Glenn McGrath", "GD McGrath"],
    },
    {
        "folder": "imran_khan",
        "asset_name": "imran-khan.jpg",
        "aliases": ["Imran Khan"],
    },
    {
        "folder": "james_anderson",
        "asset_name": "james-anderson.jpg",
        "aliases": ["James Anderson", "JM Anderson"],
    },
    {
        "folder": "jaques_kallis",
        "asset_name": "jacques-kallis.jpg",
        "aliases": ["Jacques Kallis", "Jaques Kallis", "JH Kallis"],
    },
    {
        "folder": "kumar_sangakkara",
        "asset_name": "kumar-sangakkara.jpg",
        "aliases": ["Kumar Sangakkara", "KC Sangakkara"],
    },
    {
        "folder": "mahela_jayawardene",
        "asset_name": "mahela-jayawardene.jpg",
        "aliases": ["Mahela Jayawardene", "DPMD Jayawardene"],
    },
    {
        "folder": "ms_dhoni",
        "asset_name": "ms-dhoni.jpg",
        "aliases": ["MS Dhoni", "M S Dhoni", "Mahendra Singh Dhoni"],
    },
    {
        "folder": "muttiah_muralitharan",
        "asset_name": "muttiah-muralitharan.jpg",
        "aliases": ["Muttiah Muralitharan", "M Muralitharan"],
    },
    {
        "folder": "rahul_dravid",
        "asset_name": "rahul-dravid.jpg",
        "aliases": ["Rahul Dravid", "R Dravid"],
    },
    {
        "folder": "ricky_ponting",
        "asset_name": "ricky-ponting.jpg",
        "aliases": ["Ricky Ponting", "RT Ponting"],
    },
    {
        "folder": "sachin_tendulkar",
        "asset_name": "sachin-tendulkar.jpg",
        "aliases": ["Sachin Tendulkar", "SR Tendulkar"],
    },
    {
        "folder": "shane_warne",
        "asset_name": "shane-warne.jpg",
        "aliases": ["Shane Warne", "SK Warne"],
    },
    {
        "folder": "shoaib_akhtar",
        "asset_name": "shoaib-akhtar.jpg",
        "aliases": ["Shoaib Akhtar"],
    },
    {
        "folder": "steve_waugh",
        "asset_name": "steve-waugh.jpg",
        "aliases": ["Steve Waugh", "SR Waugh"],
    },
    {
        "folder": "virat_kohli",
        "asset_name": "virat-kohli.jpg",
        "aliases": ["Virat Kohli", "V Kohli"],
        "source_member": "Cricket Legends/Cricket Legends/virat_kohli/0be6a82880.jpg",
    },
    {
        "folder": "wasim_akram",
        "asset_name": "wasim-akram.jpg",
        "aliases": ["Wasim Akram"],
    },
]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Import matched player photos from the legends zip into the frontend."
    )
    parser.add_argument(
        "zip_path",
        nargs="?",
        default=str(DEFAULT_ZIP_PATH),
        help=f"Path to the source zip file. Defaults to {DEFAULT_ZIP_PATH}",
    )
    parser.add_argument(
        "--size",
        type=int,
        default=360,
        help="Square output size for each portrait.",
    )
    return parser


def choose_source_member(archive: zipfile.ZipFile, folder: str) -> zipfile.ZipInfo:
    prefix = f"Cricket Legends/Cricket Legends/{folder}/"
    members = sorted(
        (
            info
            for info in archive.infolist()
            if not info.is_dir()
            and info.filename.startswith(prefix)
            and info.filename.lower().endswith(IMAGE_EXTENSIONS)
        ),
        key=lambda info: info.filename.lower(),
    )

    if not members:
        raise FileNotFoundError(f"No images found for archive folder '{folder}'.")

    return members[0]


def resolve_source_member(
    archive: zipfile.ZipFile, folder: str, preferred_member: str | None
) -> zipfile.ZipInfo:
    if preferred_member:
        return archive.getinfo(preferred_member)

    return choose_source_member(archive, folder)


def extract_square_portrait(
    archive: zipfile.ZipFile, source_member: zipfile.ZipInfo, destination: Path, size: int
) -> None:
    with archive.open(source_member) as image_stream:
        image = Image.open(image_stream)
        image = ImageOps.exif_transpose(image).convert("RGB")
        portrait = ImageOps.fit(
            image,
            (size, size),
            method=Image.Resampling.LANCZOS,
            centering=(0.5, 0.35),
        )
        portrait.save(destination, format="JPEG", quality=86, optimize=True)


def build_manifest(entries: list[dict[str, object]]) -> dict[str, object]:
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "entries": entries,
    }


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    zip_path = Path(args.zip_path).expanduser().resolve()

    if not zip_path.exists():
        raise FileNotFoundError(f"Could not find zip file at '{zip_path}'.")

    PUBLIC_PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)

    manifest_entries = []

    with zipfile.ZipFile(zip_path) as archive:
        for item in PLAYER_IMPORTS:
            destination = PUBLIC_PHOTO_DIR / item["asset_name"]
            source_member = resolve_source_member(
                archive, item["folder"], item.get("source_member")
            )
            extract_square_portrait(archive, source_member, destination, args.size)

            manifest_entries.append(
                {
                    "folder": item["folder"],
                    "assetPath": f"player-photos/{item['asset_name']}",
                    "aliases": item["aliases"],
                    "sourceMember": source_member.filename,
                }
            )

    MANIFEST_PATH.write_text(
        json.dumps(build_manifest(manifest_entries), indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"Imported {len(manifest_entries)} player portraits")
    print(f"Assets: {PUBLIC_PHOTO_DIR}")
    print(f"Manifest: {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
