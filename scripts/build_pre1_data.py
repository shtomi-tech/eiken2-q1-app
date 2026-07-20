"""Build local structured data for the Eiken Pre-1 past-exam mode.

The source PDFs are kept outside the public app data flow.  This script reads
the locally downloaded official PDFs under data/eiken_p1 and writes the small
JSON payloads consumed by static/mode-pre1.js.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import fitz


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "data" / "eiken_p1"
OUTPUT_PATTERN = ROOT / "data" / "pre1_{round_id}.json"


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
    }
    for old, new in replacements.items():
        value = value.replace(old, new)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def page_texts(path: Path) -> list[str]:
    document = fitz.open(path)
    return [page.get_text() for page in document]


def answer_key(path: Path) -> dict[int, int]:
    text = clean_text("\n".join(page_texts(path)))
    answers: dict[int, int] = {}
    for number, answer in re.findall(r"\((\d+)\)\s+(\d+)", text):
        answers[int(number)] = int(answer) - 1
    return answers


def parse_numbered_blocks(text: str, marker: str = r"\((\d+)\)") -> list[tuple[int, str]]:
    matches = list(re.finditer(marker, text))
    blocks: list[tuple[int, str]] = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        number = int(match.group(1))
        blocks.append((number, text[match.end():end]))
    return blocks


def parse_choices(block: str) -> tuple[str, list[str]]:
    # The PDFs put each choice number on its own line.  Parsing exact lines is
    # safer than a broad regex because a choice can contain a number of its
    # own (for example, "in the 1970s").
    lines = block.splitlines()
    try:
        first = next(index for index, line in enumerate(lines) if line.strip() == "1")
    except StopIteration:
        raise ValueError(f"choice marker not found: {block[:100]!r}")
    marker_indices = []
    cursor = first
    for expected in ("1", "2", "3", "4"):
        while cursor < len(lines) and lines[cursor].strip() != expected:
            cursor += 1
        if cursor >= len(lines):
            raise ValueError(f"choice {expected} not found: {block[:160]!r}")
        marker_indices.append(cursor)
        cursor += 1
    stem = clean_text(" ".join(lines[:first]))
    choices = []
    for index in range(4):
        choice_lines = lines[marker_indices[index] + 1: marker_indices[index + 1] if index < 3 else len(lines)]
        footer_index = next(
            (line_index for line_index, line in enumerate(choice_lines)
             if re.search(r"20\d{2}年度第|copyright|無断転載|Read each passage", line)),
            len(choice_lines),
        )
        while footer_index > 0 and choice_lines[footer_index - 1].strip().isdigit():
            footer_index -= 1
        choices.append(clean_text(" ".join(choice_lines[:footer_index])))
    if len(choices) != 4:
        raise ValueError(f"expected four choices, got {len(choices)}: {block[:160]!r}")
    return stem, choices


def reading_questions(problem_pages: list[str], answers: dict[int, int]) -> list[dict]:
    blocks = []
    for page_index in (2, 3, 4, 5, 6):
        blocks.extend(parse_numbered_blocks(problem_pages[page_index]))
    contexts = {
        **{number: reading_context(problem_pages[5], (19, 20, 21)) for number in (19, 20, 21)},
        **{number: reading_context(problem_pages[6], (22, 23, 24)) for number in (22, 23, 24)},
    }
    questions = []
    for number, block in blocks:
        if number > 24:
            continue
        stem, choices = parse_choices(block)
        questions.append({
            "q": number,
            "stem": stem or f"空所（{number}）に入る語句を選んでください。",
            "choices": choices,
            "answerIndex": answers[number],
            **({"context": contexts[number]} if number in contexts else {}),
        })
    if [item["q"] for item in questions] != list(range(1, 25)):
        raise ValueError("reading question numbers are incomplete")
    return questions


def reading_context(page: str, question_numbers: tuple[int, ...]) -> str:
    lines = [line.strip() for line in page.splitlines() if line.strip()]
    body = "\n".join(lines[2:])
    marker = "|".join(str(number) for number in question_numbers)
    body = re.sub(
        rf"(?ms)^\(({marker})\)\s*$.*?(?=^\(({marker})\)\s*$|^Read each passage|^20\d{{2}}年度第)",
        "",
        body,
    )
    body = re.split(r"\nRead each passage", body, maxsplit=1)[0]
    body = re.split(r"\n20\d{2}年度第", body, maxsplit=1)[0]
    return clean_text(body)


def article_page(problem_pages: list[str], page_number: int) -> tuple[str, str]:
    raw_lines = problem_pages[page_number - 1].splitlines()
    lines = [line.strip() for line in raw_lines if line.strip()]
    title_index = 2
    title = clean_text(lines[title_index])
    body = " ".join(lines[title_index + 1:])
    body = re.split(r"\s+Read each passage and choose the best answer", body, maxsplit=1)[0]
    body = re.split(r"\s+202\d年度第", body, maxsplit=1)[0]
    return title, clean_text(body)


def long_reading(problem_pages: list[str], answers: dict[int, int]) -> list[dict]:
    question_pages = []
    for index, text in enumerate(problem_pages):
        if re.search(r"\((25|28)\)", text):
            question_pages.append(index)
    if len(question_pages) != 2:
        raise ValueError(f"expected two long-reading question pages, got {question_pages}")

    article_indices = [index - 1 for index in question_pages]
    passages = []
    for passage_index, (article_index, question_index) in enumerate(zip(article_indices, question_pages)):
        title, body = article_page(problem_pages, article_index + 1)
        questions = []
        for number, block in parse_numbered_blocks(problem_pages[question_index]):
            if number < 25:
                continue
            stem, choices = parse_choices(block)
            questions.append({
                "q": number,
                "stem": stem,
                "choices": choices,
                "answerIndex": answers[number],
            })
        passages.append({
            "id": f"{passage_index + 1}",
            "title": title,
            "text": body,
            "questions": questions,
        })
    if sum(len(passage["questions"]) for passage in passages) != 7:
        raise ValueError("long-reading question count is not seven")
    return passages


def listening_questions(problem_pages: list[str], round_id: str) -> list[dict]:
    text = "\n".join(problem_pages[15:23])
    questions = []
    for number, block in re.findall(r"(?ms)No\.\s*(\d+)\s+(.*?)(?=\nNo\.\s*\d+|\Z)", text):
        number = int(number)
        if number > 29:
            continue
        stem, choices = parse_choices(block)
        part = 1 if number <= 12 else 2 if number <= 24 else 3
        questions.append({
            "q": number,
            "part": part,
            "stem": stem,
            "choices": choices,
            "answerIndex": 0,
            "audio": f"data/eiken_p1/{round_id}/audio-part{part}.mp3",
        })
    listening_key = parse_listening_answers(round_id)
    for question in questions:
        question["answerIndex"] = listening_key[question["q"]]
    if [item["q"] for item in questions] != list(range(1, 30)):
        raise ValueError("listening question numbers are incomplete")
    return questions


def parse_listening_answers(round_id: str) -> dict[int, int]:
    # The answer PDF is read separately because the reading and listening
    # answer sections use the same question numbers.
    path = SOURCE_ROOT / round_id / "answer.pdf"
    text = clean_text("\n".join(page_texts(path)))
    answers: dict[int, int] = {}
    for number, answer in re.findall(r"No\.\s*(\d+)\s+(\d+)", text):
        answers[int(number)] = int(answer) - 1
    if len(answers) != 29:
        raise ValueError(f"expected 29 listening answers, got {len(answers)}")
    return answers


def writing_tasks(problem_pages: list[str]) -> list[dict]:
    summary_page = problem_pages[11]
    summary_lines = [line.strip() for line in summary_page.splitlines() if line.strip()]
    summary_start = next(
        index + 1
        for index, line in enumerate(summary_lines)
        if "will not be graded" in line
    )
    summary_end = next(index for index, line in enumerate(summary_lines[summary_start:], summary_start) if line == "English Summary")
    summary_text = clean_text(" ".join(summary_lines[summary_start:summary_end]))

    essay_page = problem_pages[13]
    essay_lines = [line.strip() for line in essay_page.splitlines() if line.strip()]
    topic_index = essay_lines.index("TOPIC")
    points_index = essay_lines.index("POINTS")
    essay_prompt = clean_text(" ".join(essay_lines[topic_index + 1:points_index]))
    points = [clean_text(line.lstrip("●")) for line in essay_lines[points_index + 1:] if line.startswith("●")]

    return [
        {
            "id": "writing-4",
            "number": 4,
            "type": "SUMMARY",
            "label": "英文要約",
            "prompt": summary_text,
            "targetMin": 60,
            "targetMax": 70,
        },
        {
            "id": "writing-5",
            "number": 5,
            "type": "ESSAY",
            "label": "英作文",
            "prompt": essay_prompt,
            "points": points,
            "targetMin": 120,
            "targetMax": 150,
        },
    ]


def build_round(round_id: str) -> dict:
    source = SOURCE_ROOT / round_id
    problem_pages = page_texts(source / "problem.pdf")
    answers = answer_key(source / "answer.pdf")
    reading = reading_questions(problem_pages, answers)
    return {
        "meta": {
            "grade": "準1級",
            "round": round_id,
            "label": f"英検準1級 {round_id.replace('-', '年度第', 1)}回",
            "source": "英検公式の過去問をローカル学習用に構造化",
        },
        "reading": {
            "part1": [question for question in reading if 1 <= question["q"] <= 18],
            "part2": [question for question in reading if 19 <= question["q"] <= 24],
            "part3": long_reading(problem_pages, answers),
        },
        "writing": writing_tasks(problem_pages),
        "listening": listening_questions(problem_pages, round_id),
    }


def main() -> None:
    for round_id in ("2026-1", "2025-3", "2025-2"):
        payload = build_round(round_id)
        output = Path(str(OUTPUT_PATTERN).format(round_id=round_id))
        output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(output, len(payload["reading"]["part1"]), len(payload["reading"]["part2"]), len(payload["reading"]["part3"]), len(payload["listening"]))


if __name__ == "__main__":
    main()
