"""Azure Speechで英検1級・2級・準1級・準2級の単語・熟語音声を生成する。"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
AUDIO_ROOT = ROOT / "assets" / "audio" / "vocab"
GRADE_CONFIG = {
    "1": {"pattern": "vocab_1_*.json", "filename": r"vocab_1_(.+)\.json", "folder": "1"},
    "2": {"pattern": "vocab_*.json", "filename": r"vocab_(\d{4}-\d+)\.json", "folder": "2"},
    "pre1": {"pattern": "vocab_pre1_*.json", "filename": r"vocab_pre1_(.+)\.json", "folder": "pre1"},
    "pre2": {"pattern": "vocab_p2_*.json", "filename": r"vocab_p2_(.+)\.json", "folder": "pre2"},
}
DEFAULT_VOICE = "en-US-JennyNeural"
OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3"


def audio_slug(surface: str) -> str:
    normalized = str(surface or "").lower()
    normalized = re.sub(r"[’']", "'", normalized)
    normalized = re.sub(r"\b(one's|his|her|my|your|our|their|its)\b", "@poss", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    slug = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
    if not slug:
        raise ValueError(f"音声ファイル名を作れない語句です: {surface!r}")
    return slug


def vocab_files(grade: str, round_id: str) -> list[tuple[str, Path]]:
    config = GRADE_CONFIG[grade]
    files = []
    for path in sorted((ROOT / "data").glob(config["pattern"])):
        match = re.fullmatch(config["filename"], path.name)
        if not match:
            continue
        current_round = match.group(1)
        if round_id != "all" and current_round != round_id:
            continue
        files.append((current_round, path))
    if not files:
        raise SystemExit(f"対象データが見つかりません: grade={grade}, round={round_id}")
    return files


def load_jobs(grade: str, round_id: str) -> list[tuple[str, str, str]]:
    jobs: list[tuple[str, str, str]] = []
    for current_round, path in vocab_files(grade, round_id):
        data = json.loads(path.read_text(encoding="utf-8"))
        for item_type, data_key, surface_key in (
            ("word", "words", "word"),
            ("idiom", "idioms", "phrase"),
        ):
            seen: set[str] = set()
            for item in data.get(data_key, []):
                surface = str(item.get(surface_key, "")).strip()
                if not surface or surface in seen:
                    continue
                seen.add(surface)
                jobs.append((current_round, item_type, surface))
    return jobs


def ssml_for(word: str, voice: str) -> bytes:
    safe_word = html.escape(word, quote=False)
    safe_voice = html.escape(voice, quote=True)
    return (
        "<speak version=\"1.0\" xml:lang=\"en-US\">"
        f"<voice name=\"{safe_voice}\">{safe_word}</voice>"
        "</speak>"
    ).encode("utf-8")


def request_audio(key: str, region: str, word: str, voice: str) -> bytes:
    endpoint = f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1"
    request = Request(
        endpoint,
        data=ssml_for(word, voice),
        method="POST",
        headers={
            "Accept": "audio/mpeg",
            "Content-Type": "application/ssml+xml",
            "Ocp-Apim-Subscription-Key": key,
            "User-Agent": "eiken-practice-tts/1.0",
            "X-Microsoft-OutputFormat": OUTPUT_FORMAT,
        },
    )
    try:
        with urlopen(request, timeout=30) as response:
            return response.read()
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"Azure Speechが{error.code}を返しました: {detail}") from error
    except URLError as error:
        raise RuntimeError(f"Azure Speechへ接続できません: {error.reason}") from error


def generate(args: argparse.Namespace) -> int:
    jobs = load_jobs(args.grade, args.round_id)
    if args.limit:
        jobs = jobs[: args.limit]

    key = os.environ.get("AZURE_SPEECH_KEY", "").strip()
    region = os.environ.get("AZURE_SPEECH_REGION", "japaneast").strip()
    if not args.dry_run and not key:
        raise SystemExit(
            "AZURE_SPEECH_KEY が見つかりません。"
            "キーはチャットへ貼らず、生成コマンドを実行するPowerShellに設定してください。"
        )

    generated = 0
    skipped = 0
    audio_dir = GRADE_CONFIG[args.grade]["folder"]
    for current_round, item_type, surface in jobs:
        item_dir = AUDIO_ROOT / audio_dir / current_round
        if item_type == "idiom":
            item_dir /= "idiom"
        target = item_dir / f"{audio_slug(surface)}.mp3"
        if target.exists() and not args.force:
            skipped += 1
            continue
        if args.dry_run:
            print(f"[dry-run] {current_round} {item_type}: {surface} -> {target.relative_to(ROOT)}")
            continue

        target.parent.mkdir(parents=True, exist_ok=True)
        audio = request_audio(key, region, surface, args.voice)
        temporary = target.with_suffix(".mp3.tmp")
        temporary.write_bytes(audio)
        temporary.replace(target)
        generated += 1
        print(f"生成: {current_round} {item_type} {surface}")

    mode = "確認" if args.dry_run else "生成"
    print(f"{mode}対象 {len(jobs)}件 / 新規{generated}件 / 既存スキップ{skipped}件")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--grade", choices=sorted(GRADE_CONFIG), default="1", help="1 / 2 / pre1 / pre2")
    parser.add_argument("--round", dest="round_id", default="all", help="2026-1 / 2025-3 / 2025-2 / mock-1 / mock-2 / mock-3 / mock-4 / mock-5 / all")
    parser.add_argument("--limit", type=int, help="先頭から指定件数だけ処理する")
    parser.add_argument("--voice", default=os.environ.get("AZURE_SPEECH_VOICE", DEFAULT_VOICE))
    parser.add_argument("--force", action="store_true", help="既存音声を上書きする")
    parser.add_argument("--dry-run", action="store_true", help="Azureへ送信せず対象だけ確認する")
    return generate(parser.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
