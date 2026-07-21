"""Cross-check pre1_vocab_data.py against the source reading.part1 choices.

Verifies, per round and question:
- exactly 4 vocab entries, in the same order as choices
- entry["word"] matches choices[i] exactly (case-sensitive)
- exactly one entry has isAnswer=True, and it is at answerIndex
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import pre1_vocab_data as vocab_module

ROOT = Path(__file__).resolve().parents[1]
ROUND_MAP = {
    "2026-1": vocab_module.ROUND_2026_1,
    "2025-3": getattr(vocab_module, "ROUND_2025_3", None),
    "2025-2": getattr(vocab_module, "ROUND_2025_2", None),
}


def verify_round(round_id: str, vocab_by_q: dict) -> list[str]:
    errors = []
    data = json.loads((ROOT / "data" / f"pre1_{round_id}.json").read_text(encoding="utf-8"))
    part1 = {q["q"]: q for q in data["reading"]["part1"]}
    if set(vocab_by_q) != set(part1):
        errors.append(f"{round_id}: question set mismatch. vocab has {sorted(vocab_by_q)}, source has {sorted(part1)}")
        return errors
    for q_num, entries in vocab_by_q.items():
        choices = part1[q_num]["choices"]
        answer_index = part1[q_num]["answerIndex"]
        if len(entries) != 4:
            errors.append(f"{round_id} q{q_num}: expected 4 entries, got {len(entries)}")
            continue
        for i, (entry, choice) in enumerate(zip(entries, choices)):
            if entry["word"] != choice:
                errors.append(f"{round_id} q{q_num} choice[{i}]: word {entry['word']!r} != source {choice!r}")
        answer_flags = [i for i, entry in enumerate(entries) if entry.get("isAnswer")]
        if answer_flags != [answer_index]:
            errors.append(f"{round_id} q{q_num}: isAnswer flags at {answer_flags}, expected [{answer_index}]")
    return errors


def main():
    all_errors = []
    for round_id, vocab_by_q in ROUND_MAP.items():
        if vocab_by_q is None:
            print(f"{round_id}: not yet drafted, skipping")
            continue
        errors = verify_round(round_id, vocab_by_q)
        if errors:
            all_errors.extend(errors)
            print(f"{round_id}: {len(errors)} problem(s)")
            for err in errors:
                print("  -", err)
        else:
            print(f"{round_id}: OK ({len(vocab_by_q)} questions, {sum(len(v) for v in vocab_by_q.values())} entries)")
    if all_errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
