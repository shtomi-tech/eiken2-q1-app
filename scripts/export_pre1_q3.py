"""Merge pre1_q3_data.py (paragraphs/evidence/summary) into
data/pre1_{round}.json's reading.part3, in place. Run
scripts/verify_pre1_q3.py first -- this script does not re-validate.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import pre1_q3_data as q3_module

ROOT = Path(__file__).resolve().parents[1]

ROUNDS = {
    "2026-1": q3_module.ROUND_2026_1,
    "2025-3": q3_module.ROUND_2025_3,
    "2025-2": q3_module.ROUND_2025_2,
}

NOTE = (
    "reading.part3[].paragraphs/questions[].evidence,explanation,translation/summaryは"
    "エージェントが新規作成したもの(英検公式の解答・和訳ではない)。paragraphsの英文自体は公式過去問の"
    "本文をそのまま文単位に分割しただけで、書き換えていない。和訳・解説・要約はエージェントによる翻訳・要約であり、"
    "内容の解釈には確認の余地がありうる。"
)


def main():
    for round_id, passages in ROUNDS.items():
        data_path = ROOT / "data" / f"pre1_{round_id}.json"
        payload = json.loads(data_path.read_text(encoding="utf-8"))
        for passage in payload["reading"]["part3"]:
            enrichment = passages[passage["id"]]
            passage["paragraphs"] = enrichment["paragraphs"]
            evidence_by_q = {q["q"]: q for q in enrichment["questions"]}
            for question in passage["questions"]:
                extra = evidence_by_q[question["q"]]
                question["evidence"] = extra["evidence"]
                question["explanation"] = extra["explanation"]
                question["translation"] = extra["translation"]
            passage["summary"] = enrichment["summary"]
        payload["meta"]["q3Note"] = NOTE
        data_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(round_id, "merged", len(payload["reading"]["part3"]), "passages")


if __name__ == "__main__":
    main()
