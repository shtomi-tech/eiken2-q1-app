"""準1級の大問1データを、共通Q1形式へ抽出する。"""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
ROUND_IDS = ("2026-1", "2025-3", "2025-2")
VOCAB_FIELDS = (
    "word",
    "meaning",
    "etymology",
    "example",
    "exampleTranslation",
    "pos",
    "collocation",
    "ipa",
    "relatedWords",
    "selfExampleEnabled",
    "etymologyUncertain",
)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def extract_round(round_id: str) -> None:
    source = load_json(DATA_DIR / f"pre1_{round_id}.json")
    source_vocab = load_json(DATA_DIR / f"pre1_vocab_{round_id}.json")
    questions = source.get("reading", {}).get("part1", [])
    vocab_by_question = source_vocab.get("part1", {})

    expected_questions = list(range(1, 19))
    if [item.get("q") for item in questions] != expected_questions:
        raise ValueError(f"{round_id}: 準1級大問1の設問番号が不連続です")

    words = []
    for question in questions:
        q = question["q"]
        entries = vocab_by_question.get(str(q), [])
        if len(entries) != 4:
            raise ValueError(f"{round_id}: Q{q}の語彙数が4ではありません")
        surfaces = [entry.get("word", "") for entry in entries]
        if surfaces != question.get("choices"):
            raise ValueError(f"{round_id}: Q{q}の語彙と選択肢が一致しません")
        if question.get("answerIndex") not in range(4):
            raise ValueError(f"{round_id}: Q{q}の正答位置が不正です")

        for entry in entries:
            normalized = {key: entry[key] for key in VOCAB_FIELDS if key in entry}
            normalized["q"] = q
            words.append(normalized)

    normalized_questions = []
    for question in questions:
        normalized = {
            key: question[key]
            for key in ("q", "stem", "choices", "answerIndex", "translation")
            if key in question
        }
        normalized_questions.append(normalized)

    meta = {
        "grade": "準1級",
        "round": round_id,
        "source": "data/pre1_*.json から大問1だけを抽出した共通Q1データ",
    }
    write_json(
        DATA_DIR / f"vocab_pre1_{round_id}.json",
        {"meta": meta, "words": words, "idioms": []},
    )
    write_json(
        DATA_DIR / f"questions_pre1_{round_id}.json",
        {"meta": meta, "questions": normalized_questions},
    )
    print(f"{round_id}: 18 questions / 72 words")


def main() -> None:
    for round_id in ROUND_IDS:
        extract_round(round_id)


if __name__ == "__main__":
    main()
