"""Export pre1_vocab_data.py into data/pre1_vocab_{round}.json.

Run scripts/verify_pre1_vocab.py first -- this script does not re-validate
against the source reading data.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import pre1_vocab_data as vocab_module

ROOT = Path(__file__).resolve().parents[1]

ROUNDS = {
    "2026-1": vocab_module.ROUND_2026_1,
    "2025-3": vocab_module.ROUND_2025_3,
    "2025-2": vocab_module.ROUND_2025_2,
}

NOTE = (
    "大問1(語彙)のフラッシュカード用データ。meaning/etymology/example/pos/collocationは"
    "エージェントが新規作成したもので、英検公式の語彙集ではない。語義は入試問題での用法に基づく。"
    "語源はLatin/Greek/Old Englishなどの通説を簡略化して記載し、確信が持てないものは"
    "etymologyUncertain:trueを付けて要確認としている。発音記号(ipa)は誤記のリスクを避けるため収録していない。"
)


def build_payload(round_id: str, vocab_by_q: dict) -> dict:
    part1 = {}
    for q_num in sorted(vocab_by_q):
        part1[str(q_num)] = vocab_by_q[q_num]
    return {
        "meta": {
            "grade": "準1級",
            "round": round_id,
            "note": NOTE,
        },
        "part1": part1,
    }


def main():
    for round_id, vocab_by_q in ROUNDS.items():
        payload = build_payload(round_id, vocab_by_q)
        output = ROOT / "data" / f"pre1_vocab_{round_id}.json"
        output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(output, "written:", sum(len(v) for v in vocab_by_q.values()), "entries")


if __name__ == "__main__":
    main()
