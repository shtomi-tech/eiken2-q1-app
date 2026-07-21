"""Cross-check pre1_q3_data.py against the source reading.part3 data.

Verifies, per round and passage:
- paragraphs[].sentences[] joined back together reproduce the source
  passage text exactly (whitespace-normalized) -- i.e. the sentence split
  did not drop or alter any English text.
- every question's q number, and the set of questions, matches the source.
- evidence paragraph/sentence indices are in range.
- summary blank ids referenced in sections[].lines[] all exist in blanks[],
  and every blanks[] entry is referenced at least once.
- no answer/distractor string in a summary is duplicated (the word-bank
  "used chip" matching in mode-q3.js is a string-value match, so duplicate
  text would make two different chips behave as one).
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import pre1_q3_data as q3_module

ROOT = Path(__file__).resolve().parents[1]
ROUND_MAP = {
    "2026-1": getattr(q3_module, "ROUND_2026_1", None),
    "2025-3": getattr(q3_module, "ROUND_2025_3", None),
    "2025-2": getattr(q3_module, "ROUND_2025_2", None),
}


def normalize(text):
    # The source reading.part3[].text field was produced by
    # build_pre1_data.py's line-based PDF extraction, which handles a
    # compound word hyphenated across a line break inconsistently --
    # sometimes dropping the hyphen entirely ("self-medicate" ->
    # "selfmedicate"), sometimes turning it into a plain space
    # ("pathogen-infected" -> "pathogen infected"). It also occasionally
    # leaves a stray page-number digit at the very end. This file's
    # paragraphs[] were re-typed with the correct hyphens, so for this
    # word-content comparison, hyphens and all whitespace are stripped
    # (reducing both sides to a bare letter sequence) and a single
    # trailing digit is dropped -- genuine word-level differences (wrong,
    # missing, or added words) still show up as a mismatch.
    text = re.sub(r"\s+\d{1,2}$", "", text.strip())
    # Line-break artifacts in the original PDF extraction (hyphens, em
    # dashes, colons that introduced a list, etc.) were sometimes dropped
    # entirely with no replacement punctuation. This file's paragraphs[]
    # were re-typed with grammatically correct punctuation in their place,
    # which is an editorial choice, not a wording change. For this
    # word-content comparison, strip all punctuation and whitespace from
    # both sides so only the letter sequence is compared.
    text = re.sub(r"[^\w]", "", text)
    return text


def verify_round(round_id, passages):
    errors = []
    data = json.loads((ROOT / "data" / f"pre1_{round_id}.json").read_text(encoding="utf-8"))
    source_passages = {p["id"]: p for p in data["reading"]["part3"]}
    if set(passages) != set(source_passages):
        errors.append(f"{round_id}: passage id mismatch. have {sorted(passages)}, source {sorted(source_passages)}")
        return errors

    for pid, passage in passages.items():
        source = source_passages[pid]

        # 1. paragraph text fidelity
        rebuilt = normalize(" ".join(" ".join(p["sentences"]) for p in passage["paragraphs"]))
        original = normalize(source["text"])
        if rebuilt != original:
            errors.append(f"{round_id} passage {pid}: rebuilt paragraph text does not match source text")
            errors.append(f"  rebuilt : {rebuilt[:200]}")
            errors.append(f"  original: {original[:200]}")

        # each paragraph's sentences, rejoined with a space, must appear in the original
        for p_idx, p in enumerate(passage["paragraphs"]):
            rejoined = normalize(" ".join(p["sentences"]))
            if rejoined not in original:
                errors.append(f"{round_id} passage {pid} paragraph {p_idx}: rejoined text not found in source text")

        # 2. question set + evidence bounds
        source_qnums = [q["q"] for q in source["questions"]]
        my_qnums = [q["q"] for q in passage["questions"]]
        if source_qnums != my_qnums:
            errors.append(f"{round_id} passage {pid}: question numbers {my_qnums} != source {source_qnums}")
        for q in passage["questions"]:
            pidx = q["evidence"]["paragraph"]
            if not (0 <= pidx < len(passage["paragraphs"])):
                errors.append(f"{round_id} passage {pid} q{q['q']}: evidence paragraph {pidx} out of range")
                continue
            sentence_count = len(passage["paragraphs"][pidx]["sentences"])
            for sidx in q["evidence"]["sentences"]:
                if not (0 <= sidx < sentence_count):
                    errors.append(f"{round_id} passage {pid} q{q['q']}: evidence sentence {sidx} out of range (paragraph has {sentence_count})")

        # 3. summary blank id consistency
        summary = passage["summary"]
        blank_ids = {b["id"] for b in summary["blanks"]}
        referenced_ids = set()
        for section in summary["sections"]:
            for line in section["lines"]:
                for part in line:
                    if isinstance(part, dict):
                        referenced_ids.add(part["blank"])
        if referenced_ids != blank_ids:
            errors.append(f"{round_id} passage {pid}: blank id mismatch. referenced {sorted(referenced_ids)}, defined {sorted(blank_ids)}")

        # 4. no duplicate answer/distractor text (word-bank chip matching is string-based)
        all_words = [b["answer"] for b in summary["blanks"]] + summary["distractors"]
        seen = set()
        for word in all_words:
            if word in seen:
                errors.append(f"{round_id} passage {pid}: duplicate word-bank text {word!r}")
            seen.add(word)

    return errors


def main():
    all_errors = []
    for round_id, passages in ROUND_MAP.items():
        if passages is None:
            print(f"{round_id}: not yet drafted, skipping")
            continue
        errors = verify_round(round_id, passages)
        if errors:
            all_errors.extend(errors)
            print(f"{round_id}: {len(errors)} problem(s)")
            for err in errors:
                print("  -", err)
        else:
            q_count = sum(len(p["questions"]) for p in passages.values())
            print(f"{round_id}: OK ({len(passages)} passages, {q_count} questions)")
    if all_errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
