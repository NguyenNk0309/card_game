"""Build runtime pixel-animation strips from the generated source atlases.

The source atlases live in tmp/imagegen/clean after chroma-key removal. This
script deliberately exports fixed, validator-friendly frame grids:

- character moves: 12 frames at 64x64
- card/shared effects: 16 frames at 128x128
- world/result effects: 20 frames at 128x128

Run from the repository root:
    python scripts/build-pixel-animation-assets.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Iterable

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "tmp" / "imagegen" / "clean"
OUTPUT_ROOT = ROOT / "public" / "pixel"
CHARACTER_ROOT = OUTPUT_ROOT / "characters"
VFX_ROOT = OUTPUT_ROOT / "vfx"

HEROES = (
    "elara-voss",
    "thorne-vale",
    "mira-ash",
    "brother-orren",
    "nyx-calder",
    "bram-coalhand",
    "sable-fen",
    "kael-rook",
    "ione-mire",
    "dagan-flint",
)

HERO_TINTS = {
    "elara-voss": "#d5b56b",
    "thorne-vale": "#82a88a",
    "mira-ash": "#bd705c",
    "brother-orren": "#789bad",
    "nyx-calder": "#9a83b7",
    "bram-coalhand": "#c98b58",
    "sable-fen": "#6aa8a5",
    "kael-rook": "#a96161",
    "ione-mire": "#bd9f76",
    "dagan-flint": "#768493",
}

CHARACTER_ANIMATIONS = (
    "idle",
    "enter",
    "slash",
    "heavy",
    "brace",
    "second-wind",
    "hurt",
    "shield-hit",
    "shield-break",
    "backlash",
    "defeat",
    "revive",
    "victory",
    "discard",
    "skip",
    "timeout",
    "forced-skip",
    "pity-success",
    "zero-pity-success",
    "cast",
)

UNIQUE_CARD_IDS = (
    "ev-aegis",
    "ev-ward",
    "ev-command",
    "tv-mark",
    "tv-pierce",
    "tv-hunt",
    "ma-inferno",
    "ma-comet",
    "ma-gravity",
    "bo-prayer",
    "bo-blessing",
    "bo-return",
    "nc-knife",
    "nc-execute",
    "nc-pilfer",
    "bc-fortress",
    "bc-temper",
    "bc-march",
    "sf-favor",
    "sf-hex",
    "sf-stolen",
    "kr-riposte",
    "kr-duel",
    "kr-break",
    "im-command",
    "im-focus",
    "im-purge",
    "df-none",
    "df-cleave",
    "df-frenzy",
)

COMMON_CARD_IDS = (
    "slash",
    "heavy",
    "brace",
    "second-wind",
    "empty-gesture",
    "broken-plan",
    "lost-momentum",
)

SHARED_VFX = (
    "neutral",
    "world",
    "damage",
    "heal",
    "shield-gain",
    "shield-loss",
    "shield-hit",
    "shield-break",
    "shield-pierce",
    "attack-buff",
    "dice-buff",
    "dice-penalty",
    "turn-skip",
    "turn-advance",
    "card-steal",
    "card-purge",
    "revival-pending",
    "revive",
    "dispel",
    "backlash",
    "pity-success",
    "zero-pity-success",
    "no-effect",
    "discard",
    "skip",
    "timeout",
    "forced-skip",
)

WORLD_EVENTS = (
    "chaos-convergence",
    "fractured-fate",
    "crimson-world-pulse",
    "unstable-arena-surge",
)

# (atlas, cell, tint, motion)
# action atlas:
# 0 slash, 1 heavy, 2 shield, 3 heal, 4 attack, 5 dice+, 6 dice-,
# 7 area blast, 8 pierce, 9 revive, 10 steal, 11 purge, 12 skip,
# 13 advance, 14 dispel, 15 neutral.
# outcome atlas:
# 0 backlash, 1 team backlash, 2 shield break, 3 failed cast,
# 4 discard, 5 timeout, 6 pity, 7 zero-pity, 8..11 world,
# 12 victory, 13 defeat, 14 damage, 15 healing.
SHARED_SPECS = {
    "neutral": ("actions", 15, "#a6aaa6", "pulse"),
    "world": ("outcomes", 8, "#68c8c4", "spin"),
    "damage": ("outcomes", 14, "#e46f5d", "burst"),
    "heal": ("actions", 3, "#82d6a4", "rise"),
    "shield-gain": ("actions", 2, "#75bde1", "pulse"),
    "shield-loss": ("outcomes", 2, "#e2796b", "fall"),
    "shield-hit": ("actions", 2, "#acd7eb", "burst"),
    "shield-break": ("outcomes", 2, "#e5a36c", "burst"),
    "shield-pierce": ("actions", 8, "#d9b4ff", "sweep"),
    "attack-buff": ("actions", 4, "#e58a64", "rise"),
    "dice-buff": ("actions", 5, "#76d8c7", "spin"),
    "dice-penalty": ("actions", 6, "#bd79d6", "fall"),
    "turn-skip": ("actions", 12, "#9aa4aa", "spin"),
    "turn-advance": ("actions", 13, "#e6bd69", "sweep"),
    "card-steal": ("actions", 10, "#aa83d5", "sweep"),
    "card-purge": ("actions", 11, "#d7c47a", "burst"),
    "revival-pending": ("actions", 9, "#8dd7bd", "pulse"),
    "revive": ("actions", 9, "#a8e4b3", "rise"),
    "dispel": ("actions", 14, "#e2c8ff", "spin"),
    "backlash": ("outcomes", 0, "#ef6d5c", "burst"),
    "pity-success": ("outcomes", 6, "#f0b94f", "spin"),
    "zero-pity-success": ("outcomes", 7, "#70d6c0", "rise"),
    "no-effect": ("actions", 15, "#919a98", "pulse"),
    "discard": ("outcomes", 4, "#b89b69", "fall"),
    "skip": ("actions", 12, "#a3aba9", "sweep"),
    "timeout": ("outcomes", 5, "#93a4af", "spin"),
    "forced-skip": ("actions", 12, "#dd7965", "fall"),
}

CARD_SUCCESS_SPECS = {
    "ev-aegis": ("actions", 2, "#e4c66e", "burst"),
    "ev-ward": ("actions", 2, "#e9d692", "pulse"),
    "ev-command": ("actions", 13, "#e1be70", "sweep"),
    "tv-mark": ("actions", 0, "#8fc49a", "sweep"),
    "tv-pierce": ("actions", 8, "#b2e1b9", "sweep"),
    "tv-hunt": ("actions", 4, "#8fc49a", "rise"),
    "ma-inferno": ("actions", 7, "#ef6c4f", "burst"),
    "ma-comet": ("actions", 7, "#ffa05d", "sweep"),
    "ma-gravity": ("actions", 6, "#cb76d5", "fall"),
    "bo-prayer": ("actions", 3, "#9edbc7", "rise"),
    "bo-blessing": ("outcomes", 15, "#9edbc7", "burst"),
    "bo-return": ("actions", 9, "#b8e0c5", "rise"),
    "nc-knife": ("actions", 8, "#bd96dd", "sweep"),
    "nc-execute": ("actions", 1, "#c17aea", "sweep"),
    "nc-pilfer": ("actions", 10, "#a487d1", "spin"),
    "bc-fortress": ("actions", 2, "#de9b5e", "burst"),
    "bc-temper": ("actions", 2, "#e9ae73", "pulse"),
    "bc-march": ("actions", 2, "#f0bb7b", "rise"),
    "sf-favor": ("actions", 5, "#76d4c8", "spin"),
    "sf-hex": ("actions", 6, "#9a76c9", "fall"),
    "sf-stolen": ("actions", 12, "#71b9b3", "spin"),
    "kr-riposte": ("actions", 0, "#d6766d", "sweep"),
    "kr-duel": ("actions", 1, "#cb665f", "burst"),
    "kr-break": ("actions", 14, "#e6a2a0", "spin"),
    "im-command": ("actions", 4, "#d8b77d", "rise"),
    "im-focus": ("actions", 5, "#e1c993", "spin"),
    "im-purge": ("actions", 11, "#d5b37b", "burst"),
    "df-none": ("actions", 7, "#a9b0bc", "burst"),
    "df-cleave": ("actions", 1, "#c3cad5", "sweep"),
    "df-frenzy": ("actions", 4, "#e66e59", "rise"),
    "slash": ("actions", 0, "#d7d0bd", "sweep"),
    "heavy": ("actions", 1, "#e7c984", "burst"),
    "brace": ("actions", 2, "#9ac9dc", "pulse"),
    "second-wind": ("actions", 3, "#86cfa6", "rise"),
    "empty-gesture": ("outcomes", 7, "#7fc9bb", "pulse"),
    "broken-plan": ("outcomes", 7, "#9bb2ac", "spin"),
    "lost-momentum": ("outcomes", 7, "#b19f8a", "fall"),
}


def parse_color(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[index : index + 2], 16) for index in (0, 2, 4))


def harden_alpha(image: Image.Image) -> Image.Image:
    result = image.convert("RGBA")
    alpha = result.getchannel("A").point(lambda value: 255 if value >= 112 else 0)
    result.putalpha(alpha)
    return result


def tint(image: Image.Image, color: str, amount: float) -> Image.Image:
    base = image.convert("RGBA")
    overlay = Image.new("RGBA", base.size, (*parse_color(color), 255))
    colored = Image.blend(base, overlay, max(0.0, min(1.0, amount)))
    colored.putalpha(base.getchannel("A"))
    return colored


def crop_atlas(image: Image.Image, rows: int) -> list[Image.Image]:
    columns = 4
    cell_width = image.width // columns
    cell_height = image.height // rows
    cells: list[Image.Image] = []
    for row in range(rows):
        for column in range(columns):
            left = column * cell_width
            top = row * cell_height
            right = image.width if column == columns - 1 else (column + 1) * cell_width
            bottom = image.height if row == rows - 1 else (row + 1) * cell_height
            cell = harden_alpha(image.crop((left, top, right, bottom)))
            bounds = cell.getchannel("A").getbbox()
            if not bounds:
                raise RuntimeError(f"Generated atlas contains an empty cell at row {row + 1}, column {column + 1}.")
            cells.append(cell.crop(bounds))
    return cells


def fit_sprite(image: Image.Image, frame_size: int, maximum: int) -> Image.Image:
    ratio = min(maximum / image.width, maximum / image.height)
    size = (
        max(1, round(image.width * ratio)),
        max(1, round(image.height * ratio)),
    )
    sprite = image.resize(size, Image.Resampling.NEAREST)
    frame = Image.new("RGBA", (frame_size, frame_size))
    frame.alpha_composite(
        sprite,
        ((frame_size - sprite.width) // 2, frame_size - sprite.height - 2),
    )
    return harden_alpha(frame)


def translate(image: Image.Image, x: int = 0, y: int = 0) -> Image.Image:
    frame = Image.new("RGBA", image.size)
    frame.alpha_composite(image, (x, y))
    return frame


def scale_center(image: Image.Image, scale: float) -> Image.Image:
    size = max(1, round(image.width * scale)), max(1, round(image.height * scale))
    scaled = image.resize(size, Image.Resampling.NEAREST)
    frame = Image.new("RGBA", image.size)
    frame.alpha_composite(scaled, ((image.width - scaled.width) // 2, (image.height - scaled.height) // 2))
    return frame


def rotate_center(image: Image.Image, degrees: float) -> Image.Image:
    return image.rotate(degrees, resample=Image.Resampling.NEAREST, expand=False)


def save_strip(frames: Iterable[Image.Image], destination: Path) -> int:
    frame_list = [frame.convert("RGBA") for frame in frames]
    if not frame_list:
        raise RuntimeError(f"No frames were supplied for {destination}.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    strip = Image.new("RGBA", (frame_list[0].width * len(frame_list), frame_list[0].height))
    for index, frame in enumerate(frame_list):
        strip.alpha_composite(frame, (index * frame.width, 0))
    strip.save(destination, format="PNG", optimize=True, compress_level=9)
    return len(frame_list)


def animation_pose_indices(name: str) -> list[int]:
    sequences = {
        "idle": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        "enter": [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
        "slash": [0, 1, 1, 2, 2, 2, 2, 1, 1, 0, 0, 0],
        "heavy": [0, 1, 1, 3, 3, 3, 3, 1, 1, 0, 0, 0],
        "brace": [0, 5, 5, 5, 5, 5, 5, 5, 0, 0, 0, 0],
        "second-wind": [0, 4, 4, 5, 5, 4, 4, 7, 7, 0, 0, 0],
        "hurt": [0, 6, 6, 6, 6, 6, 6, 0, 0, 0, 0, 0],
        "shield-hit": [0, 5, 6, 5, 6, 5, 5, 0, 0, 0, 0, 0],
        "shield-break": [5, 5, 6, 6, 6, 6, 6, 0, 0, 0, 0, 0],
        "backlash": [0, 6, 6, 6, 6, 6, 6, 6, 0, 0, 0, 0],
        "defeat": [0, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
        "revive": [6, 6, 6, 6, 6, 6, 6, 4, 4, 7, 0, 0],
        "victory": [0, 7, 7, 7, 7, 7, 7, 7, 7, 7, 0, 7],
        "discard": [0, 4, 4, 5, 5, 4, 4, 0, 0, 0, 0, 0],
        "skip": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        "timeout": [0, 0, 0, 6, 0, 0, 6, 0, 0, 6, 0, 0],
        "forced-skip": [0, 6, 6, 6, 6, 6, 6, 6, 0, 0, 0, 0],
        "pity-success": [0, 4, 4, 5, 5, 7, 7, 7, 7, 0, 0, 7],
        "zero-pity-success": [0, 4, 4, 7, 7, 7, 7, 7, 7, 0, 0, 7],
        "cast": [0, 4, 4, 5, 5, 5, 5, 4, 4, 0, 0, 0],
    }
    return sequences[name]


def build_character_frames(poses: list[Image.Image], animation: str, hero_tint: str) -> list[Image.Image]:
    pose_indices = animation_pose_indices(animation)
    frames: list[Image.Image] = []
    bob = [0, 0, -1, -1, 0, 0, 1, 1, 0, 0, -1, 0]
    shake = [0, -3, 3, -3, 2, -2, 1, 0, 0, 0, 0, 0]
    for index, pose_index in enumerate(pose_indices):
        frame = poses[pose_index].copy()
        x = 0
        y = bob[index] if animation in {"idle", "victory", "pity-success", "zero-pity-success"} else 0

        if animation == "enter":
            x = [-14, -11, -8, -5, -3, -1, 0, 0, 0, 0, 0, 0][index]
        elif animation in {"slash", "heavy"}:
            x = [0, 1, 2, 4, 6, 8, 7, 5, 3, 1, 0, 0][index]
        elif animation in {"hurt", "shield-hit", "shield-break", "backlash"}:
            x = shake[index]
        elif animation == "skip":
            x = [0, -2, -4, -6, -8, -9, -7, -5, -3, -1, 0, 0][index]
        elif animation == "forced-skip":
            x = [0, -2, -5, -8, -11, -13, -10, -7, -4, -2, 0, 0][index]

        if animation == "defeat":
            angles = [0, 0, -4, -8, -14, -22, -34, -46, -58, -68, -76, -82]
            y = [0, 0, 1, 2, 4, 7, 10, 13, 16, 18, 20, 21][index]
            frame = rotate_center(frame, angles[index])
        elif animation == "revive":
            angles = [-82, -76, -68, -58, -46, -34, -22, -12, -6, 0, 0, 0]
            y = [21, 20, 18, 16, 13, 10, 7, 4, 2, 0, 0, 0][index]
            frame = rotate_center(frame, angles[index])

        if animation in {"brace", "shield-hit"} and 2 <= index <= 7:
            frame = tint(frame, "#78c8ea", 0.24)
        elif animation in {"second-wind", "revive"} and 2 <= index <= 9:
            frame = tint(frame, "#83d6a2", 0.26)
        elif animation in {"hurt", "shield-break", "backlash", "forced-skip"} and 1 <= index <= 7:
            frame = tint(frame, "#ef6455", 0.28)
        elif animation == "discard" and 1 <= index <= 7:
            frame = tint(frame, "#b9a16c", 0.22)
        elif animation == "timeout" and index in {3, 6, 9}:
            frame = tint(frame, "#718d9f", 0.32)
        elif animation == "pity-success" and 1 <= index <= 9:
            frame = tint(frame, "#f0b94f", 0.30)
        elif animation == "zero-pity-success" and 1 <= index <= 9:
            frame = tint(frame, "#70d6c0", 0.30)
        elif animation in {"cast", "victory"} and 1 <= index <= 9:
            frame = tint(frame, hero_tint, 0.16)

        frames.append(harden_alpha(translate(frame, x, y)))
    return frames


def build_vfx_frames(
    source: Image.Image,
    tint_color: str,
    motion: str,
    frame_count: int = 16,
) -> list[Image.Image]:
    base = fit_sprite(source, 128, 108)
    base = tint(base, tint_color, 0.28)
    frames: list[Image.Image] = []
    for index in range(frame_count):
        progress = index / max(1, frame_count - 1)
        envelope = math.sin(progress * math.pi)
        scale = 0.24 + (0.82 * envelope)
        frame = scale_center(base, scale)
        x = 0
        y = 0
        if motion == "sweep":
            x = round(-25 + (50 * progress))
            y = round(-4 * math.sin(progress * math.pi * 2))
            frame = rotate_center(frame, -20 + (40 * progress))
        elif motion == "rise":
            y = round(17 - (29 * progress))
        elif motion == "fall":
            y = round(-13 + (29 * progress))
            frame = rotate_center(frame, -12 + (24 * progress))
        elif motion == "spin":
            frame = rotate_center(frame, -70 + (140 * progress))
            y = round(-3 * math.sin(progress * math.pi * 2))
        elif motion == "burst":
            frame = rotate_center(frame, -8 + (16 * progress))
        elif motion == "pulse":
            x = round(2 * math.sin(progress * math.pi * 4))
        frames.append(translate(frame, x, y))
    return frames


def clip(src: str, frame_size: int, frames: int, fps: int, loop: bool = False) -> dict[str, object]:
    return {
        "src": src,
        "frameWidth": frame_size,
        "frameHeight": frame_size,
        "frames": frames,
        "columns": frames,
        "fps": fps,
        "loop": loop,
    }


def main() -> None:
    missing_sources = [
        source
        for source in [*(SOURCE_ROOT / f"{hero}.png" for hero in HEROES), SOURCE_ROOT / "vfx-actions.png", SOURCE_ROOT / "vfx-outcomes.png"]
        if not source.is_file()
    ]
    if missing_sources:
        missing = "\n".join(str(source.relative_to(ROOT)) for source in missing_sources)
        raise RuntimeError(f"Missing generated/chroma-cleaned source atlases:\n{missing}")

    manifest: dict[str, object] = {"version": 1, "clips": {}}
    clips: dict[str, dict[str, object]] = manifest["clips"]  # type: ignore[assignment]

    for hero in HEROES:
        source = Image.open(SOURCE_ROOT / f"{hero}.png").convert("RGBA")
        poses = [fit_sprite(cell, 64, 58) for cell in crop_atlas(source, 2)]
        for animation in CHARACTER_ANIMATIONS:
            frames = build_character_frames(poses, animation, HERO_TINTS[hero])
            relative_path = f"/pixel/characters/{hero}/{animation}.png"
            save_strip(frames, ROOT / f"public{relative_path}")
            clips[f"character.{hero}.{animation}"] = clip(
                relative_path,
                64,
                len(frames),
                6,
                loop=animation == "idle",
            )

    vfx_atlases = {
        "actions": crop_atlas(Image.open(SOURCE_ROOT / "vfx-actions.png").convert("RGBA"), 4),
        "outcomes": crop_atlas(Image.open(SOURCE_ROOT / "vfx-outcomes.png").convert("RGBA"), 4),
    }

    for kind in SHARED_VFX:
        atlas, cell_index, tint_color, motion = SHARED_SPECS[kind]
        frames = build_vfx_frames(vfx_atlases[atlas][cell_index], tint_color, motion)
        relative_path = f"/pixel/vfx/shared/{kind}.png"
        save_strip(frames, ROOT / f"public{relative_path}")
        clips[f"shared.{kind}"] = clip(relative_path, 128, len(frames), 7)

    card_hero_tints = {
        prefix: HERO_TINTS[hero]
        for prefix, hero in (
            ("ev", "elara-voss"),
            ("tv", "thorne-vale"),
            ("ma", "mira-ash"),
            ("bo", "brother-orren"),
            ("nc", "nyx-calder"),
            ("bc", "bram-coalhand"),
            ("sf", "sable-fen"),
            ("kr", "kael-rook"),
            ("im", "ione-mire"),
            ("df", "dagan-flint"),
        )
    }
    for card_id in (*UNIQUE_CARD_IDS, *COMMON_CARD_IDS):
        atlas, cell_index, tint_color, motion = CARD_SUCCESS_SPECS[card_id]
        success_frames = build_vfx_frames(vfx_atlases[atlas][cell_index], tint_color, motion)
        success_path = f"/pixel/vfx/cards/{card_id}-success.png"
        save_strip(success_frames, ROOT / f"public{success_path}")
        clips[f"card.{card_id}.success"] = clip(success_path, 128, len(success_frames), 7)

        if card_id in COMMON_CARD_IDS:
            failure_source = vfx_atlases["actions"][15]
            failure_tint = "#909a98"
            failure_motion = "fall"
        else:
            failure_source = vfx_atlases["outcomes"][0]
            failure_tint = card_hero_tints[card_id.split("-", 1)[0]]
            failure_motion = "burst"
        failure_frames = build_vfx_frames(failure_source, failure_tint, failure_motion)
        failure_path = f"/pixel/vfx/cards/{card_id}-failure.png"
        save_strip(failure_frames, ROOT / f"public{failure_path}")
        clips[f"card.{card_id}.failure"] = clip(failure_path, 128, len(failure_frames), 7)

    for index, world_event in enumerate(WORLD_EVENTS):
        tint_colors = ("#69d5c5", "#aa82dc", "#e16f63", "#dfbd62")
        motions = ("spin", "sweep", "burst", "fall")
        frames = build_vfx_frames(
            vfx_atlases["outcomes"][8 + index],
            tint_colors[index],
            motions[index],
            frame_count=20,
        )
        relative_path = f"/pixel/vfx/world/{world_event}.png"
        save_strip(frames, ROOT / f"public{relative_path}")
        clips[f"world.{world_event}"] = clip(relative_path, 128, len(frames), 6)

    result_specs = {
        "victory": (12, "#e7bd60", "rise"),
        "defeat": (13, "#dd675b", "fall"),
    }
    for result, (cell_index, tint_color, motion) in result_specs.items():
        frames = build_vfx_frames(
            vfx_atlases["outcomes"][cell_index],
            tint_color,
            motion,
            frame_count=20,
        )
        relative_path = f"/pixel/vfx/results/{result}.png"
        save_strip(frames, ROOT / f"public{relative_path}")
        clips[f"result.{result}"] = clip(relative_path, 128, len(frames), 6)

    manifest_path = OUTPUT_ROOT / "animations.manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    print(
        f"Built {len(clips)} clips for {len(HEROES)} heroes, "
        f"{len(UNIQUE_CARD_IDS) + len(COMMON_CARD_IDS)} cards, "
        f"{len(SHARED_VFX)} shared effects, {len(WORLD_EVENTS)} world events, "
        "and 2 battle results."
    )


if __name__ == "__main__":
    main()
