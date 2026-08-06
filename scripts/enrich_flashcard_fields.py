"""準2級を基準に、1級・準1級の暗記カード用データを補う。

発音と品詞は Datamuse の発音・品詞タグから取得する。取得できない項目は
推測で埋めない。1級のオリジナル例文は別スクリプトで管理する。
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
TARGET_PATTERN = re.compile(r"^vocab_(?:1_20\d{2}-\d+|pre1_20\d{2}-\d+)\.json$")
POS_LABELS = {
    "n": "名詞",
    "v": "動詞",
    "adj": "形容詞",
    "adv": "副詞",
    "prep": "前置詞",
    "pron": "代名詞",
    "conj": "接続詞",
    "interj": "間投詞",
    "det": "限定詞",
}
CMU_TO_IPA = {
    "AA": "ɑ",
    "AE": "æ",
    "AH": "ə",
    "AO": "ɔ",
    "AW": "aʊ",
    "AY": "aɪ",
    "B": "b",
    "CH": "tʃ",
    "D": "d",
    "DH": "ð",
    "EH": "ɛ",
    "ER": "ər",
    "EY": "eɪ",
    "F": "f",
    "G": "ɡ",
    "HH": "h",
    "IH": "ɪ",
    "IY": "i",
    "JH": "dʒ",
    "K": "k",
    "L": "l",
    "M": "m",
    "N": "n",
    "NG": "ŋ",
    "OW": "oʊ",
    "OY": "ɔɪ",
    "P": "p",
    "R": "ɹ",
    "S": "s",
    "SH": "ʃ",
    "T": "t",
    "TH": "θ",
    "UH": "ʊ",
    "UW": "u",
    "V": "v",
    "W": "w",
    "Y": "j",
    "Z": "z",
    "ZH": "ʒ",
}


def target_paths() -> list[Path]:
    return sorted(path for path in DATA_DIR.glob("vocab*.json") if TARGET_PATTERN.match(path.name))


def items_in(data: dict):
    for bucket in ("words", "idioms"):
        yield from data.get(bucket, [])


def surface(item: dict) -> str:
    return str(item.get("phrase") if item.get("phrase") else item.get("word", "")).strip()


def cmu_to_ipa(pronunciation: str) -> str:
    result: list[str] = []
    for token in pronunciation.split():
        match = re.fullmatch(r"([A-Z]+)([012]?)", token)
        if not match or match.group(1) not in CMU_TO_IPA:
            return ""
        phoneme, stress = match.groups()
        if stress == "1":
            result.append("ˈ")
        elif stress == "2":
            result.append("ˌ")
        if phoneme == "ER":
            result.append("ɝ" if stress in {"1", "2"} else "ɚ")
        else:
            result.append(CMU_TO_IPA[phoneme])
    return f"/{''.join(result)}/" if result else ""


def datamuse_fields(word: str) -> tuple[str, str]:
    query = urlencode({"sp": word, "md": "pr", "max": 1})
    request = Request(
        f"https://api.datamuse.com/words?{query}",
        headers={"User-Agent": "eiken-practice flashcard field importer"},
    )
    for attempt in range(3):
        try:
            with urlopen(request, timeout=20) as response:
                payload = json.loads(response.read().decode("utf-8"))
            exact = next((entry for entry in payload if entry.get("word") == word), None)
            if not exact:
                return "", ""
            tags = exact.get("tags", [])
            pronunciation = next(
                (tag.removeprefix("pron:").strip() for tag in tags if tag.startswith("pron:")),
                "",
            )
            pos_tags = list(
                dict.fromkeys(POS_LABELS[tag.lower()] for tag in tags if tag.lower() in POS_LABELS)
            )
            return cmu_to_ipa(pronunciation), "・".join(pos_tags)
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
            if attempt == 2:
                return "", ""
            time.sleep(1.5 * (attempt + 1))
    return "", ""


def write_json(path: Path, data: dict) -> None:
    original = path.read_bytes()
    newline = "\r\n" if b"\r\n" in original else "\n"
    text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    if newline == "\r\n":
        text = text.replace("\n", "\r\n")
    path.write_bytes(text.encode("utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="件数だけ確認して変更しない")
    parser.add_argument("--workers", type=int, default=8, help="Datamuseの同時取得数（既定: 8）")
    args = parser.parse_args()

    loaded = [(path, json.loads(path.read_text(encoding="utf-8"))) for path in target_paths()]
    field_targets = {
        surface(item)
        for path, data in loaded
        for item in items_in(data)
        if item.get("word") and (not item.get("ipa") or path.name.startswith("vocab_1_"))
    }
    print(f"対象ファイル: {len(loaded)}件")
    print(f"発音情報を取得する語: {len(field_targets)}件")

    pronunciations: dict[str, tuple[str, str]] = {}
    if not args.dry_run and field_targets:
        with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
            futures = {executor.submit(datamuse_fields, word): word for word in sorted(field_targets)}
            for index, future in enumerate(as_completed(futures), start=1):
                pronunciations[futures[future]] = future.result()
                if index == 1 or index % 50 == 0 or index == len(futures):
                    print(f"発音情報取得: {index}/{len(futures)}")

    if args.dry_run:
        return

    for path, data in loaded:
        added_ipa = 0
        added_pos = 0
        for item in items_in(data):
            word = surface(item)
            ipa, pos = pronunciations.get(word, ("", ""))
            if not item.get("ipa") and ipa:
                item["ipa"] = ipa
                added_ipa += 1
            if path.name.startswith("vocab_1_") and not item.get("pos") and pos:
                item["pos"] = pos
                added_pos += 1
        write_json(path, data)
        print(f"{path.name}: IPA +{added_ipa}, 品詞 +{added_pos}")


if __name__ == "__main__":
    main()
