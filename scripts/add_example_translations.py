"""大問1の例文に日本語訳を補う。

例文の翻訳は公開されている Google 翻訳の簡易エンドポイントで一括取得する。
既存の exampleTranslation は保持し、空欄だけを補う。
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import re
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
TARGET_PATTERN = re.compile(
    r"^vocab_(?:20\d{2}-\d+|p2_20\d{2}-\d+|pre1_20\d{2}-\d+)\.json$"
)
TRANSLATE_URL = "https://translate.googleapis.com/translate_a/single"


def target_paths() -> list[Path]:
    return sorted(path for path in DATA_DIR.glob("vocab*.json") if TARGET_PATTERN.match(path.name))


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def items_in(data: dict):
    for key in ("words", "idioms"):
        yield from data.get(key, [])


def missing_examples(data: dict) -> list[dict]:
    return [
        item
        for item in items_in(data)
        if str(item.get("example", "")).strip()
        and not str(item.get("exampleTranslation", "")).strip()
    ]


def translate(sentence: str) -> str:
    query = urlencode(
        {
            "client": "gtx",
            "sl": "en",
            "tl": "ja",
            "dt": "t",
            "q": sentence,
        }
    )
    request = Request(
        f"{TRANSLATE_URL}?{query}",
        headers={"User-Agent": "eiken-practice example translation importer"},
    )
    for attempt in range(3):
        try:
            with urlopen(request, timeout=15) as response:
                payload = json.loads(response.read().decode("utf-8"))
            translated = "".join(
                segment[0]
                for segment in payload[0]
                if isinstance(segment, list) and segment and segment[0]
            ).strip()
            if not translated:
                raise RuntimeError(f"翻訳結果が空です: {sentence}")
            return translated
        except (HTTPError, URLError) as exc:
            if attempt == 2:
                raise RuntimeError(f"翻訳取得に失敗しました: {sentence}") from exc
            time.sleep(1.5 * (attempt + 1))
    raise AssertionError("unreachable")


def write_json(path: Path, data: dict) -> None:
    original = path.read_bytes()
    newline = "\r\n" if b"\r\n" in original else "\n"
    text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    if newline == "\r\n":
        text = text.replace("\n", "\r\n")
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_bytes(text.encode("utf-8"))
    temporary.replace(path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="対象件数だけ確認し、翻訳取得・ファイル変更を行わない",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=6,
        help="同時に実行する翻訳リクエスト数（既定: 6）",
    )
    args = parser.parse_args()

    paths = target_paths()
    loaded = [(path, load(path)) for path in paths]
    pending_by_path = {path: missing_examples(data) for path, data in loaded}
    sentences = sorted(
        {
            str(item["example"]).strip()
            for pending in pending_by_path.values()
            for item in pending
        }
    )

    print(f"対象ファイル: {len(paths)}件")
    print(f"訳が必要な例文: {sum(len(items) for items in pending_by_path.values())}件")
    print(f"翻訳する固有文: {len(sentences)}件")
    for path, pending in pending_by_path.items():
        if pending:
            print(f"  {path.name}: {len(pending)}件")

    if args.dry_run or not sentences:
        return

    translations: dict[str, str] = {}
    worker_count = max(1, args.workers)
    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        futures = {executor.submit(translate, sentence): sentence for sentence in sentences}
        for index, future in enumerate(as_completed(futures), start=1):
            sentence = futures[future]
            translations[sentence] = future.result()
            if index == 1 or index % 25 == 0 or index == len(sentences):
                print(f"翻訳取得: {index}/{len(sentences)}")

    changed = 0
    for path, data in loaded:
        for item in pending_by_path[path]:
            item["exampleTranslation"] = translations[str(item["example"]).strip()]
            changed += 1
        if pending_by_path[path]:
            write_json(path, data)

    print(f"更新完了: {changed}件")


if __name__ == "__main__":
    main()
