"""Enrich the Eiken Pre-1 listening data with script text and audio segments.

This script reads the existing data/pre1_{round}.json files (produced by
build_pre1_data.py plus manually-added writing referenceAnswer fields) and
adds, per listening question:

- ``script``: the dialogue/passage text read aloud, extracted from the
  official ``listening-script.pdf`` for each round.
- ``question``: the spoken question text for Part 1/2 (Part 3 already has
  the question printed in ``stem`` from the problem booklet, so it is left
  alone).
- ``tips``: a small number of listening-focus hints, generated from the
  script text (contractions used, part-specific generic advice).
- ``start`` / ``end``: the playback window (in seconds) within the shared
  ``audio-partN.mp3`` file, so a single question's audio can be replayed
  without scrubbing through the whole part.

Audio segmentation is only attempted for Part 1 and Part 2, where the
~10-second "mark your answer" silence reliably brackets each question (this
was verified by hand against the official audio for all three rounds before
writing this script). Part 3's audio interleaves a reading-time silence and
an answering-time silence around each passage in a way that could not be
verified with confidence from silence timing alone, so Part 3 keeps the
existing full-file playback (no ``start``/``end`` are added there).

This script is intentionally separate from build_pre1_data.py: re-running
build_pre1_data.py regenerates reading/writing/listening from the source
PDFs from scratch (which would discard the manually written writing
referenceAnswer text), whereas this script only enriches the already-built
listening array in place.
"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "data" / "eiken_p1"
DATA_PATTERN = ROOT / "data" / "pre1_{round_id}.json"

ROUNDS = ("2026-1", "2025-3", "2025-2")

SPEAKER = r"(?:☆☆|★★|☆|★)"


def clean_text(value: str) -> str:
    replacements = {
        "­": "",
        "ﬁ": "fi",
        "ﬂ": "fl",
        "’": "'",
        "‘": "'",
        "“": '"',
        "”": '"',
        "–": "-",
        "—": "-",
        "−": "-",
        " ": " ",
    }
    for old, new in replacements.items():
        value = value.replace(old, new)
    value = re.sub(r"[ \t]+", " ", value)
    return value.strip()


# ---------------------------------------------------------------------------
# Audio segmentation
# ---------------------------------------------------------------------------

def silence_gaps(audio_path: Path, noise_db: int = -30, min_duration: float = 8.0) -> list[tuple[float, float]]:
    """Return (start, end) of silences at least ``min_duration`` seconds long."""
    result = subprocess.run(
        [
            "ffmpeg", "-i", str(audio_path),
            "-af", f"silencedetect=noise={noise_db}dB:d={min_duration}",
            "-f", "null", "-",
        ],
        capture_output=True, check=False,
    )
    stderr = result.stderr.decode("utf-8", errors="replace")
    starts = [float(m) for m in re.findall(r"silence_start:\s*([\d.]+)", stderr)]
    ends = [float(m) for m in re.findall(r"silence_end:\s*([\d.]+)", stderr)]
    if len(starts) != len(ends):
        raise ValueError(f"unmatched silence markers in {audio_path}: {len(starts)} starts, {len(ends)} ends")
    return list(zip(starts, ends))


def part1_segments(gaps: list[tuple[float, float]], count: int) -> list[tuple[float | None, float | None]]:
    if len(gaps) != count:
        raise ValueError(f"expected {count} silence gaps for part 1, got {len(gaps)}")
    segments: list[tuple[float | None, float | None]] = []
    for index in range(count):
        start = 0.0 if index == 0 else gaps[index - 1][1]
        end = gaps[index][0]
        segments.append((start, end))
    return segments


def part2_segments(gaps: list[tuple[float, float]], count: int) -> list[tuple[float | None, float | None]]:
    if len(gaps) != count:
        raise ValueError(f"expected {count} silence gaps for part 2, got {len(gaps)}")
    # Consecutive gaps whose end-to-next-start interval is short (<15s) are the
    # two questions that share one passage; a longer interval marks a new
    # passage. This was verified against all three rounds' Part 2 audio.
    pair_starts = list(range(0, count, 2))
    segments: list[tuple[float | None, float | None]] = [None] * count  # type: ignore[list-item]
    passage_start = 0.0
    for pair_index, first in enumerate(pair_starts):
        second = first + 1
        if second >= count:
            raise ValueError("part 2 gap count is not even")
        interval = gaps[second][0] - gaps[first][1]
        if interval > 20:
            raise ValueError(
                f"expected a short (<20s) interval between paired gaps at index {first}/{second}, got {interval:.1f}s"
            )
        end = gaps[second][0]
        segments[first] = (passage_start, end)
        segments[second] = (passage_start, end)
        passage_start = gaps[second][1]
    return segments


# ---------------------------------------------------------------------------
# Script text extraction
# ---------------------------------------------------------------------------

def page_texts(path: Path) -> list[str]:
    document = fitz.open(path)
    return [page.get_text() for page in document]


def parse_part1_script(full_text: str) -> dict[int, dict]:
    marker = re.compile(r"(?m)^" + SPEAKER + r"?No\.\s*(\d+)\s*$")
    matches = list(marker.finditer(full_text))
    out: dict[int, dict] = {}
    for index, match in enumerate(matches):
        number = int(match.group(1))
        if number > 12:
            continue
        end = matches[index + 1].start() if index + 1 < len(matches) else len(full_text)
        block = full_text[match.end():end]
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        # Drop the running page header/footer lines that leak into the block.
        lines = [
            line for line in lines
            if not re.match(r"^20\d{2}\s*年度第|^公益財団法人|^無断転載|^\d+$", line)
        ]
        # PDF text wraps each spoken turn across multiple physical lines; a
        # line without its own speaker prefix is a continuation of whichever
        # turn (dialogue or question) came right before it.
        dialogue_turns: list[str] = []
        question_parts: list[str] = []
        in_question = False
        for line in lines:
            question_match = re.match(r"^" + SPEAKER + r"Question:\s*(.+)$", line)
            if question_match:
                question_parts = [question_match.group(1)]
                in_question = True
                continue
            speaker_match = re.match(r"^(" + SPEAKER + r"):\s*(.+)$", line)
            if speaker_match:
                dialogue_turns.append(f"{speaker_match.group(1)}{speaker_match.group(2)}")
                in_question = False
                continue
            if in_question:
                question_parts.append(line)
            elif dialogue_turns:
                dialogue_turns[-1] = f"{dialogue_turns[-1]} {line}"
        question_text = clean_text(" ".join(question_parts))
        if not dialogue_turns or not question_text:
            raise ValueError(f"could not parse Part 1 script for No.{number}: {block[:200]!r}")
        script = "\n".join(clean_text(turn) for turn in dialogue_turns)
        out[number] = {"script": script, "question": question_text}
    if sorted(out) != list(range(1, 13)):
        raise ValueError(f"Part 1 script parsing incomplete: got numbers {sorted(out)}")
    return out


def parse_part2_script(full_text: str) -> dict[int, dict]:
    passage_marker = re.compile(r"(?m)^" + SPEAKER + r"?\(([A-F])\)\s+(.+)$")
    matches = list(passage_marker.finditer(full_text))
    if len(matches) != 6:
        raise ValueError(f"expected 6 Part 2 passages, found {len(matches)}")
    out: dict[int, dict] = {}
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(full_text)
        block = full_text[match.end():end]
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        lines = [
            line for line in lines
            if not re.match(r"^20\d{2}\s*年度第|^公益財団法人|^無断転載|^\d+$", line)
        ]
        narration_lines: list[str] = []
        question_lines: dict[int, str] = {}
        for line in lines:
            no_match = re.match(r"^" + SPEAKER + r"?No\.\s*(\d+)\s+(.+)$", line)
            if no_match:
                question_lines[int(no_match.group(1))] = clean_text(no_match.group(2))
                continue
            if re.match(r"^" + SPEAKER + r"?Questions?$", line):
                continue
            narration_lines.append(line)
        script = clean_text(" ".join(narration_lines))
        if len(question_lines) != 2 or not script:
            raise ValueError(f"could not parse Part 2 passage {match.group(1)}: {block[:200]!r}")
        for number, question_text in question_lines.items():
            out[number] = {"script": script, "question": question_text}
    if sorted(out) != list(range(13, 25)):
        raise ValueError(f"Part 2 script parsing incomplete: got numbers {sorted(out)}")
    return out


def parse_part3_script(full_text: str) -> dict[int, dict]:
    passage_marker = re.compile(
        r"(?m)^" + SPEAKER + r"?\(([G-K])\)\s+You have 10 seconds to read the situation and Question No\.\s*(\d+)\.\s*$"
    )
    matches = list(passage_marker.finditer(full_text))
    if len(matches) != 5:
        raise ValueError(f"expected 5 Part 3 passages, found {len(matches)}")
    out: dict[int, dict] = {}
    for index, match in enumerate(matches):
        number = int(match.group(2))
        end = matches[index + 1].start() if index + 1 < len(matches) else len(full_text)
        block = full_text[match.end():end]
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        lines = [
            line for line in lines
            if not re.match(r"^20\d{2}\s*年度第|^公益財団法人|^無断転載|^\d+$", line)
        ]
        content_lines = [line for line in lines if "Now mark your answer" not in line]
        # Strip a leading speaker marker glued onto the first content line.
        if content_lines:
            content_lines[0] = re.sub(r"^" + SPEAKER, "", content_lines[0])
        script = clean_text(" ".join(content_lines))
        if not script:
            raise ValueError(f"could not parse Part 3 passage {match.group(1)}: {block[:200]!r}")
        out[number] = {"script": script}
    if sorted(out) != [25, 26, 27, 28, 29]:
        raise ValueError(f"Part 3 script parsing incomplete: got numbers {sorted(out)}")
    return out


# ---------------------------------------------------------------------------
# Tips (lightweight, generated -- not sourced from an official document)
# ---------------------------------------------------------------------------

CONTRACTION_PATTERN = re.compile(
    r"\b\w+(?:'(?:ll|re|ve|d|s|m|t))\b", re.IGNORECASE
)

PART_TIPS = {
    1: "第1部は対話。最後の質問の疑問詞(What/Why/How など)を先に確認し、話者の目的や困りごとを押さえる。",
    2: "第2部は1人が話すパッセージ。同じ講義・説明に2問続くので、1回の音声で両方の設問に関係する情報を拾う意識を持つ。",
    3: "第3部は状況・設問が問題冊子に印刷されている。先に状況と設問を読んでから音声を聞き、条件に一致する選択肢を絞り込む。",
}


def contraction_tip(script: str) -> str | None:
    found = sorted({match.group(0) for match in CONTRACTION_PATTERN.finditer(script)}, key=str.lower)
    if not found:
        return None
    sample = ", ".join(found[:6])
    return f"短縮形は弱く速く発音されます。この音声には {sample} が出てきます。"


def build_tips(part: int, script: str) -> list[str]:
    tips = []
    generic = PART_TIPS.get(part)
    if generic:
        tips.append(generic)
    contraction = contraction_tip(script)
    if contraction:
        tips.append(contraction)
    tips.append("数字・日時・固有名詞は選択肢の根拠になりやすいので、書き取りでも正確に拾う。")
    return tips


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

def enrich_round(round_id: str) -> None:
    source = SOURCE_ROOT / round_id
    script_text = clean_text_join(page_texts(source / "listening-script.pdf"))

    part1_data = parse_part1_script(script_text)
    part2_data = parse_part2_script(script_text)
    part3_data = parse_part3_script(script_text)
    merged = {**part1_data, **part2_data, **part3_data}

    part1_gaps = silence_gaps(source / "audio-part1.mp3")
    part2_gaps = silence_gaps(source / "audio-part2.mp3")
    part1_segs = part1_segments(part1_gaps, 12)
    part2_segs = part2_segments(part2_gaps, 12)
    segments = {number: part1_segs[number - 1] for number in range(1, 13)}
    segments.update({number: part2_segs[number - 13] for number in range(13, 25)})

    data_path = Path(str(DATA_PATTERN).format(round_id=round_id))
    payload = json.loads(data_path.read_text(encoding="utf-8"))
    for item in payload["listening"]:
        number = item["q"]
        extra = merged[number]
        item["script"] = extra["script"]
        if "question" in extra:
            item["question"] = extra["question"]
        item["tips"] = build_tips(item["part"], extra["script"])
        if number in segments:
            start, end = segments[number]
            item["start"] = round(start, 2)
            item["end"] = round(end, 2)
    payload["meta"]["listeningNote"] = (
        "listening[].script/question/tipsはlistening-script.pdfから抽出・エージェントが整形したもの"
        "(公式配布物そのものではない)。start/endはPart1・2のみ音声の無音区間から算出(Part3は解答時間と"
        "読解時間の無音が入り組み精度を確認できなかったため未設定、Part単位の音声をそのまま再生する)。"
    )
    data_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{round_id}: enriched {len(payload['listening'])} listening items")


def clean_text_join(pages: list[str]) -> str:
    return "\n".join(pages)


def main() -> None:
    for round_id in ROUNDS:
        enrich_round(round_id)


if __name__ == "__main__":
    main()
