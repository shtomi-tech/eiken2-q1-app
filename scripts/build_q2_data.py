"""Build Eiken Grade 2 / Pre-2 Question 2 data from local source PDFs.

The official PDFs live in ``materials/`` (gitignored) and are not copied
into the public app.  This script extracts only the reading-cloze
questions used by the app.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import fitz


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "materials"
OUTPUT_ROOT = ROOT / "data"
ROUNDS = ("2026-1", "2025-3", "2025-2")

CONFIG = {
    "2kyu": {
        "label": "英検2級",
        "folder": "英検2級",
        "problem": lambda round_id: f"{round_id}-1ji-2kyu.pdf",
        "answer": lambda round_id: f"{round_id[:4]}0{round_id[-1]}F2kyu.pdf",
        "pages": {"2026-1": (6, 7), "2025-3": (6, 7), "2025-2": (6, 7)},
        "page_ranges": ((18, 20), (21, 23)),
        "numbers": (18, 23),
        "prefix": "eiken2",
    },
    "pre2": {
        "label": "英検準2級",
        "folder": "英検準2級",
        "problem": lambda round_id: f"{round_id}-1ji-p2kyu.pdf",
        "answer": lambda round_id: f"{round_id[:4]}0{round_id[-1]}Fp2kyu.pdf",
        "pages": {"2026-1": (4, 5), "2025-3": (4, 5), "2025-2": (4, 5)},
        "page_ranges": ((16, 20), (21, 22)),
        "numbers": (16, 22),
        "prefix": "eikenp2",
    },
}


def clean_text(value: str) -> str:
    replacements = {
        "\u00ad": "",
        "ﬁ": "fi",
        "ﬂ": "fl",
        "’": "'",
        "‘": "'",
        "“": '"',
        "”": '"',
        "–": "-",
        "—": "-",
        "−": "-",
        "\u00a0": " ",
        "\x02": " ",
    }
    for old, new in replacements.items():
        value = value.replace(old, new)
    value = re.sub(r"\(\s*(\d+)\s*\)", r"(\1)", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def page_text(path: Path, pages: tuple[int, int]) -> list[str]:
    document = fitz.open(path)
    return [document[index].get_text() for index in pages]


def answer_key(path: Path, numbers: tuple[int, int]) -> dict[int, int]:
    text = clean_text("\n".join(page.get_text() for page in fitz.open(path)))
    text = text.split("リスニング", 1)[0]
    answers = {
        int(number): int(answer) - 1
        for number, answer in re.findall(r"\((\d+)\)\s+(\d)", text)
    }
    start, end = numbers
    selected = {number: answers[number] for number in range(start, end + 1) if number in answers}
    if len(selected) != end - start + 1:
        raise ValueError(f"answer key is incomplete: {path} {selected}")
    return selected


def option_starts(text: str, numbers: tuple[int, int] | None = None) -> list[re.Match[str]]:
    # Some Pre-2 pages repeat the question number immediately before its
    # choices, while Grade 2 pages put the choices in a compact block.  In
    # both cases the final occurrence before the instruction footer is the
    # option marker.
    candidate = re.split(r"次の|Read each passage|20\d{2}年度第", text, maxsplit=1)[0]
    if numbers:
        last_by_number = {}
        for match in re.finditer(r"\(\s*(\d+)\s*\)", candidate):
            number = int(match.group(1))
            if numbers[0] <= number <= numbers[1]:
                last_by_number[number] = match
        return [last_by_number[number] for number in sorted(last_by_number)]
    return list(re.finditer(r"\((\d+)\)", text))


def parse_questions(text: str, numbers: tuple[int, int], answers: dict[int, int], context_label: str) -> list[dict]:
    starts = option_starts(text, numbers)
    expected = list(range(numbers[0], numbers[1] + 1))
    found = [int(match.group(1)) for match in starts if int(match.group(1)) in expected]
    if found != expected:
        raise ValueError(f"question markers are incomplete in {context_label}: {found}")

    questions: list[dict] = []
    for index, match in enumerate(starts):
        number = int(match.group(1))
        if number not in expected:
            continue
        end = starts[index + 1].start() if index + 1 < len(starts) else len(text)
        block = text[match.end():end]
        all_option_markers = list(re.finditer(r"(?m)^[ \t]*([1-4])[ \t]*$", block))
        option_markers = []
        for marker_index in range(len(all_option_markers) - 3):
            labels = [all_option_markers[marker_index + offset].group(1) for offset in range(4)]
            if labels == ["1", "2", "3", "4"]:
                option_markers = all_option_markers[marker_index:marker_index + 4]
        if len(option_markers) < 4:
            raise ValueError(f"four options not found for Q{number}: {context_label}")
        choices = []
        for choice_index, choice_marker in enumerate(option_markers):
            choice_end = option_markers[choice_index + 1].start() if choice_index < 3 else len(block)
            choice = clean_text(block[choice_marker.end():choice_end])
            choice = re.split(r"20\d{2}年度第|copyright|無断転載|次の四つ|次の英文", choice, maxsplit=1)[0]
            choices.append(clean_text(choice))
        if any(not choice for choice in choices):
            raise ValueError(f"empty option for Q{number}: {choices}")
        questions.append({
            "q": number,
            "stem": f"空所（{number}）に入る最も適切なものを選んでください。",
            "choices": choices,
            "answerIndex": answers[number],
            "context": context_label,
        })
    return questions


def context_before_options(text: str, title: str, numbers: tuple[int, int]) -> str:
    first_option = re.search(r"(?m)^[ \t]*1[ \t]*$", text)
    if not first_option:
        raise ValueError(f"option section not found: {title}")
    body = text[:first_option.start()]
    body = re.sub(r"^Grade (?:2|Pre-2).*?\d+\s+\d+\s+", "", body, flags=re.S)
    body = re.sub(r"^\s*\d+\s+\d+\s+", "", body)
    return clean_text(body)


def pre2_page_contexts(text: str, page_questions: list[dict], numbers: tuple[int, int]) -> dict[int, str]:
    """Split the five dialogue questions into usable per-dialogue contexts."""
    if numbers != (16, 20):
        context = context_before_options(text, "pre2", numbers)
        return {question["q"]: context for question in page_questions}
    candidate = re.split(r"次の|20\d{2}年度第", text, maxsplit=1)[0]
    starts = {}
    for match in re.finditer(r"\(\s*(\d+)\s*\)", candidate):
        number = int(match.group(1))
        if numbers[0] <= number <= numbers[1] and number not in starts:
            starts[number] = match.start()
    ordered = sorted(starts)
    contexts = {}
    for number in ordered:
        end_number = next((candidate_number for candidate_number in ordered if candidate_number > number), None)
        segment = candidate[starts[number]:starts[end_number] if end_number else len(candidate)]
        first_option = re.search(r"(?m)^[ \t]*1[ \t]*$", segment)
        if first_option:
            segment = segment[:first_option.start()]
        segment = re.sub(r"^Grade Pre-2.*?\d+\s+\d+\s*", "", segment, flags=re.S)
        contexts[number] = clean_text(segment)
    # Q19 and Q20 share one dialogue; both should show that complete dialogue.
    if 19 in starts:
        q19_markers = list(re.finditer(r"\(\s*19\s*\)", candidate))
        dialogue_marker = q19_markers[-2] if len(q19_markers) >= 2 else q19_markers[-1]
        shared_start = candidate.rfind("A :", 0, dialogue_marker.start())
        shared = candidate[shared_start if shared_start >= 0 else starts[19]:]
        first_option = re.search(r"(?m)^[ \t]*1[ \t]*$", shared)
        if first_option:
            shared = shared[:first_option.start()]
        contexts[19] = clean_text(shared)
        contexts[20] = contexts[19]
    return {question["q"]: contexts.get(question["q"], "") for question in page_questions}


def build_round(grade: str, round_id: str) -> dict:
    config = CONFIG[grade]
    round_folder = f"{round_id[:4]}年度第{round_id[-1]}回"
    folder = SOURCE_ROOT / config["folder"] / round_folder
    problem = folder / config["problem"](round_id)
    answer = folder / config["answer"](round_id)
    pages = page_text(problem, config["pages"][round_id])
    keys = answer_key(answer, config["numbers"])
    questions = []
    for page_index, page in enumerate(pages, 1):
        context = context_before_options(page, f"{grade}/{round_id}/page{page_index}", config["page_ranges"][page_index - 1])
        page_questions = parse_questions(page, config["page_ranges"][page_index - 1], keys, context)
        if grade == "pre2" and page_index == 1:
            contexts = pre2_page_contexts(page, page_questions, config["page_ranges"][page_index - 1])
            for question in page_questions:
                question["context"] = contexts[question["q"]]
        questions.extend(page_questions)
    start, end = config["numbers"]
    questions = [question for question in questions if start <= question["q"] <= end]
    if [question["q"] for question in questions] != list(range(start, end + 1)):
        raise ValueError(f"question numbers are incomplete: {grade} {round_id}")
    # Reuse a single context string for questions on the same page, rather than
    # duplicating the page body into every record at authoring time.
    for question in questions:
        question["context"] = re.sub(r"\s+\(\d+\)$", "", clean_text(question["context"]))
    return {
        "meta": {
            "grade": config["label"],
            "round": round_id,
            "label": f"{config['label']} {round_id[:4]}年度第{round_id[-1]}回",
            "section": "Reading 大問2（空所補充）",
            "sourcePdf": problem.name,
            "sourceNote": "英検公式の過去問PDFをローカル学習用に構造化",
        },
        "questions": questions,
    }


def main() -> None:
    for grade in CONFIG:
        for round_id in ROUNDS:
            output = OUTPUT_ROOT / f"q2_{'p2_' if grade == 'pre2' else ''}{round_id}.json"
            output.write_text(json.dumps(build_round(grade, round_id), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(output, "questions", len(json.loads(output.read_text(encoding="utf-8"))["questions"]))


if __name__ == "__main__":
    main()
