"""Validate the app-facing Eiken Pre-1 datasets without rewriting them."""

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
EXPECTED_ROUNDS = ("2026-1", "2025-3", "2025-2")


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def require(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def verify_choices(
    round_id: str,
    section: str,
    questions: list[dict],
    expected: range,
    errors: list[str],
    *,
    require_stem: bool = True,
) -> None:
    prefix = f"{round_id} {section}"
    require([item.get("q") for item in questions] == list(expected), f"{prefix}: question numbers are incomplete", errors)
    for item in questions:
        label = f"{prefix} q{item.get('q')}"
        require(len(item.get("choices", [])) == 4, f"{label}: expected four choices", errors)
        answer_index = item.get("answerIndex")
        require(isinstance(answer_index, int) and 0 <= answer_index < 4, f"{label}: invalid answerIndex", errors)
        if require_stem:
            require(bool(str(item.get("stem", "")).strip()), f"{label}: missing stem", errors)


def verify_vocab(round_id: str, reading1: list[dict], vocab: dict, errors: list[str]) -> None:
    part1 = vocab.get("part1", {})
    expected_keys = {str(question["q"]) for question in reading1}
    require(set(part1) == expected_keys, f"{round_id} vocab: question set mismatch", errors)
    meanings: list[str] = []
    for question in reading1:
        entries = part1.get(str(question["q"]), [])
        label = f"{round_id} vocab q{question['q']}"
        require(len(entries) == 4, f"{label}: expected four entries", errors)
        if len(entries) != 4:
            continue
        require([entry.get("word") for entry in entries] == question["choices"], f"{label}: words do not match choices", errors)
        flags = [index for index, entry in enumerate(entries) if entry.get("isAnswer")]
        require(flags == [question["answerIndex"]], f"{label}: incorrect isAnswer flag", errors)
        for entry in entries:
            for field in ("word", "meaning", "etymology", "example"):
                require(bool(str(entry.get(field, "")).strip()), f"{label}: missing {field}", errors)
            meanings.append(entry.get("meaning", ""))
    require(len(meanings) == len(set(meanings)), f"{round_id} vocab: duplicate meanings can create ambiguous checks", errors)


def verify_q3(round_id: str, passages: list[dict], errors: list[str]) -> None:
    prefix = f"{round_id} reading3"
    require(len(passages) == 2, f"{prefix}: expected two passages", errors)
    questions = [question for passage in passages for question in passage.get("questions", [])]
    verify_choices(round_id, "reading3", questions, range(25, 32), errors)
    for passage in passages:
        label = f"{prefix} passage {passage.get('id')}"
        paragraphs = passage.get("paragraphs", [])
        require(bool(paragraphs), f"{label}: missing paragraph data", errors)
        for paragraph in paragraphs:
            require(bool(paragraph.get("sentences")), f"{label}: paragraph has no sentences", errors)
            require(bool(str(paragraph.get("translation", "")).strip()), f"{label}: paragraph translation missing", errors)
        for question in passage.get("questions", []):
            evidence = question.get("evidence", {})
            paragraph_index = evidence.get("paragraph")
            evidence_label = f"{label} q{question.get('q')}"
            require(isinstance(paragraph_index, int) and 0 <= paragraph_index < len(paragraphs), f"{evidence_label}: invalid evidence paragraph", errors)
            if isinstance(paragraph_index, int) and 0 <= paragraph_index < len(paragraphs):
                sentence_count = len(paragraphs[paragraph_index].get("sentences", []))
                require(bool(evidence.get("sentences")), f"{evidence_label}: evidence sentences missing", errors)
                require(all(isinstance(index, int) and 0 <= index < sentence_count for index in evidence.get("sentences", [])), f"{evidence_label}: invalid evidence sentence", errors)
            require(bool(str(question.get("explanation", "")).strip()), f"{evidence_label}: explanation missing", errors)
            require(bool(str(question.get("translation", "")).strip()), f"{evidence_label}: translation missing", errors)
        summary = passage.get("summary", {})
        blanks = summary.get("blanks", [])
        require(bool(summary.get("sections")) and bool(blanks), f"{label}: summary data missing", errors)
        words = [blank.get("answer") for blank in blanks] + summary.get("distractors", [])
        require(len(words) == len(set(words)), f"{label}: duplicate summary word-bank values", errors)


def verify_listening(round_id: str, questions: list[dict], errors: list[str]) -> None:
    verify_choices(round_id, "listening", questions, range(1, 30), errors, require_stem=False)
    for question in questions:
        label = f"{round_id} listening q{question.get('q')}"
        q_number = question.get("q", 0)
        expected_part = 1 if q_number <= 12 else 2 if q_number <= 24 else 3
        require(question.get("part") == expected_part, f"{label}: incorrect part", errors)
        audio_path = str(question.get("audio", "")).strip()
        require(bool(audio_path), f"{label}: audio path missing", errors)
        if audio_path:
            require((ROOT / audio_path).is_file(), f"{label}: audio file not found", errors)
        require(bool(str(question.get("script", "")).strip()), f"{label}: script missing", errors)
        require(bool(question.get("tips")), f"{label}: listening tips missing", errors)
        if expected_part in (1, 2):
            require(bool(str(question.get("question", "")).strip()), f"{label}: spoken question missing", errors)
            start, end = question.get("start"), question.get("end")
            require(isinstance(start, (int, float)) and isinstance(end, (int, float)) and start < end, f"{label}: invalid audio segment", errors)
        else:
            require(bool(str(question.get("stem", "")).strip()), f"{label}: situation text missing", errors)


def verify_writing(round_id: str, tasks: list[dict], errors: list[str]) -> None:
    require(len(tasks) == 2, f"{round_id} writing: expected summary and essay", errors)
    require({task.get("type") for task in tasks} == {"SUMMARY", "ESSAY"}, f"{round_id} writing: task types mismatch", errors)
    for task in tasks:
        label = f"{round_id} writing {task.get('id')}"
        require(bool(str(task.get("prompt", "")).strip()), f"{label}: prompt missing", errors)
        require(bool(str(task.get("referenceAnswer", "")).strip()), f"{label}: reference answer missing", errors)
        require(isinstance(task.get("targetMin"), int) and isinstance(task.get("targetMax"), int) and task["targetMin"] < task["targetMax"], f"{label}: invalid word target", errors)


def main() -> None:
    errors: list[str] = []
    manifest = load_json(DATA_DIR / "manifest.json")
    rounds = manifest.get("pre1", {}).get("rounds", [])
    require(tuple(item.get("id") for item in rounds) == EXPECTED_ROUNDS, "manifest: Pre-1 rounds mismatch", errors)
    for item in rounds:
        round_id = item["id"]
        data_path = ROOT / item.get("dataUrl", "")
        vocab_path = ROOT / item.get("vocabUrl", "")
        require(data_path.is_file(), f"{round_id}: data file missing", errors)
        require(vocab_path.is_file(), f"{round_id}: vocab file missing", errors)
        if not data_path.is_file() or not vocab_path.is_file():
            continue
        data = load_json(data_path)
        reading1 = data.get("reading", {}).get("part1", [])
        reading2 = data.get("reading", {}).get("part2", [])
        verify_choices(round_id, "reading1", reading1, range(1, 19), errors)
        verify_choices(round_id, "reading2", reading2, range(19, 25), errors)
        verify_vocab(round_id, reading1, load_json(vocab_path), errors)
        verify_q3(round_id, data.get("reading", {}).get("part3", []), errors)
        verify_listening(round_id, data.get("listening", []), errors)
        verify_writing(round_id, data.get("writing", []), errors)
        print(f"{round_id}: checked 62 questions/tasks and enhanced practice data")
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        raise SystemExit(1)
    print("Pre-1 app data: OK")


if __name__ == "__main__":
    main()
