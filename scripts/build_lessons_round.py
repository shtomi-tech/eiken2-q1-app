"""英検2級リスニング（2026-1以外の回）を設問ごとに分割し data/lessons_{round}.json を生成する。

build_lessons.py（2026-1固定）を汎用化したもの。使い方:
    py scripts/build_lessons_round.py 2025-3
    py scripts/build_lessons_round.py 2025-2

元PDF・音声は materials/英検2級/{年度フォルダ}/ にある想定。
"""
from __future__ import annotations

import re
import subprocess
import sys
import json
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "materials" / "英検2級"

ROUND_FOLDERS = {
    "2025-3": "2025年度第3回",
    "2025-2": "2025年度第2回",
}
ROUND_TITLES = {
    "2025-3": "英検2級 2025年度 第3回 リスニング",
    "2025-2": "英検2級 2025年度 第2回 リスニング",
}
# 各回のPDFファイル名は命名が微妙に揺れる（アンダースコアの有無等）ため個別指定。
ROUND_FILES = {
    "2025-3": {
        "script": "2025-3-1ji-2kyuscript.pdf",
        "question": "2025-3-1ji-2kyu.pdf",
        "answer": "202503F2kyu.pdf",
    },
    "2025-2": {
        "script": "2025-2-1ji-2kyu_script.pdf",
        "question": "2025-2-1ji-2kyu.pdf",
        "answer": "202502F2kyu.pdf",
    },
}

# 2026-1 の分析で判明した「日本語説明の後、Part開始（No.1の読み上げ）までの秒数」。
# 英検リスニングの説明音声は毎回共通の定型文のため、他の回でも同じ位置に現れる前提で流用する。
# ずれがあった場合は build_lessons.py の FIRST_START 相当をこの回だけ上書きすればよい。
FIRST_START = {1: 111.94, 2: 33.94}


def extract_pdf_text(path: Path, pages: range | None = None) -> str:
    with pdfplumber.open(str(path), password="") as doc:
        selected = doc.pages if pages is None else [doc.pages[i - 1] for i in pages]
        return "\n".join(page.extract_text(x_tolerance=1, y_tolerance=3) or "" for page in selected)


def normalize_text(value: str) -> str:
    value = value.replace("\xad", "")
    value = value.replace("�f", "'")
    value = value.replace("�g", '"').replace("�h", '"')
    value = value.replace("�f", "'").replace("�g", '"').replace("�h", '"')
    value = value.replace("’", "'").replace("“", '"').replace("”", '"')
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def parse_choices(question_pdf: Path) -> dict[int, list[str]]:
    text = normalize_text(extract_pdf_text(question_pdf, range(16, 24)))
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    choices: dict[int, list[str]] = {}
    current: int | None = None
    current_choice: int | None = None
    for line in lines:
        match = re.match(r"No\s*\.\s*(\d+)\s+1\s+(.+)$", line)
        if match:
            current = int(match.group(1))
            choices[current] = [match.group(2).strip()]
            current_choice = 1
            continue
        match = re.match(r"([1-4])\s+(.+)$", line)
        if current is not None and match:
            index = int(match.group(1))
            if index == len(choices[current]) + 1:
                choices[current].append(match.group(2).strip())
                current_choice = index
            elif current_choice is not None:
                choices[current][-1] += " " + line
            continue
        if current is not None and current_choice is not None and not line.startswith(("Grade", "2025", "2026", "copyright", "無断")):
            choices[current][-1] += " " + line
    return choices


def parse_answers(answer_pdf: Path) -> dict[int, int]:
    text = normalize_text(extract_pdf_text(answer_pdf))
    text = text[text.find("リスニング"):] if "リスニング" in text else text
    answers: dict[int, int] = {}
    for number, answer in re.findall(r"No\.\s*(\d+)\s+([1-4])", text):
        n = int(number)
        if 1 <= n <= 30:
            answers[n] = int(answer)
    return answers


def parse_scripts(script_pdf: Path) -> dict[int, dict[str, str]]:
    text = normalize_text(extract_pdf_text(script_pdf))
    text = re.sub(r"20\d\d.*?禁止します", "", text)
    text = re.sub(r"20\d\d.*?禁じます", "", text)
    matches = list(re.finditer(r"No\.\s*(\d+)", text))
    scripts: dict[int, dict[str, str]] = {}
    for index, match in enumerate(matches):
        number = int(match.group(1))
        if not 1 <= number <= 30:
            continue
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        block = text[start:end]
        question_match = re.search(r"Question:\s*(.+)", block, flags=re.S)
        question = ""
        if question_match:
            question = question_match.group(1).strip().splitlines()[0].strip()
            block = block[: question_match.start()]
        block = "\n".join(clean_script_line(line) for line in block.splitlines())
        block = "\n".join(line for line in block.splitlines() if line)
        scripts[number] = {"script": block.strip(), "question": question}
    return scripts


def clean_script_line(line: str) -> str:
    line = line.strip()
    line = re.sub(r"^[�・\s]+", "", line)
    line = re.sub(r"^Question:\s*", "", line)
    return line.strip()


def silence_events(audio: Path) -> list[dict[str, float]]:
    completed = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(audio), "-af", "silencedetect=noise=-35dB:d=0.8", "-f", "null", "-"],
        capture_output=True, text=True, encoding="utf-8", errors="replace", check=False,
    )
    events: list[dict[str, float]] = []
    current_start: float | None = None
    for line in completed.stderr.splitlines():
        start_match = re.search(r"silence_start: ([0-9.]+)", line)
        if start_match:
            current_start = float(start_match.group(1))
        end_match = re.search(r"silence_end: ([0-9.]+).*silence_duration: ([0-9.]+)", line)
        if end_match and current_start is not None:
            events.append({"start": current_start, "end": float(end_match.group(1)), "duration": float(end_match.group(2))})
            current_start = None
    return events


def build_segments(audio: dict[int, Path]) -> dict[int, tuple[float, float]]:
    segments: dict[int, tuple[float, float]] = {}

    part1_long = [event for event in silence_events(audio[1]) if event["duration"] >= 8.0][:15]
    if len(part1_long) < 15:
        raise RuntimeError(f"part1: 解答無音を15個検出できず({len(part1_long)}個)")
    part1_starts = [FIRST_START[1]] + [event["end"] + 0.55 for event in part1_long[:-1]]
    for offset, event in enumerate(part1_long):
        number = offset + 1
        segments[number] = (round(part1_starts[offset], 2), round(event["start"] + 0.15, 2))

    part2_long = [event for event in silence_events(audio[2]) if event["duration"] >= 8.0][:15]
    if len(part2_long) < 15:
        raise RuntimeError(f"part2: 解答無音を15個検出できず({len(part2_long)}個)")
    part2_starts = [FIRST_START[2]] + [event["end"] + 0.55 for event in part2_long[:-1]]
    for offset, event in enumerate(part2_long):
        number = offset + 16
        segments[number] = (round(part2_starts[offset], 2), round(event["start"] + 0.15, 2))

    return segments


def clip_audio(clips_dir: Path, number: int, part: int, start: float, end: float, audio: dict[int, Path]) -> tuple[str, float]:
    clips_dir.mkdir(parents=True, exist_ok=True)
    output = clips_dir / f"no-{number:02d}.mp3"
    duration = max(0.1, end - start)
    completed = subprocess.run(
        ["ffmpeg", "-hide_banner", "-y", "-ss", f"{start:.2f}", "-t", f"{duration:.2f}",
         "-i", str(audio[part]), "-vn", "-codec:a", "libmp3lame", "-q:a", "3", str(output)],
        capture_output=True, text=True, encoding="utf-8", errors="replace", check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(f"ffmpeg failed for No.{number}: {completed.stderr}")
    rel = clips_dir.relative_to(ROOT).as_posix()
    return (f"{rel}/{output.name}", round(duration, 2))


def tips_for(number: int, script: str, question: str) -> list[str]:
    lower = script.lower()
    tips: list[str] = []
    contractions = sorted(set(re.findall(r"\b\w+'(?:m|re|ve|d|ll|s|t)\b", script)))
    if contractions:
        tips.append("短縮形は弱く速く出ます: " + ", ".join(contractions[:5]))
    for phrase in ["going to", "want to", "have to", "used to", "would like to", "need to"]:
        if phrase in lower:
            tips.append(f"{phrase} は語の切れ目より、ひとまとまりの音で拾う。")
            break
    if re.search(r"\b(?:street|avenue|airport|flight|platform|mall|library|theater|university)\b", lower):
        tips.append("場所・施設名は内容理解の柱です。前置詞とセットで聞き取る。")
    if re.search(r"\b(?:minute|hour|p\.m\.|percent|first|next|last|today|tomorrow|week|year)\b", lower):
        tips.append("数字・時制表現は選択肢の根拠になりやすいので、単語だけでなく周辺表現も確認する。")
    if number <= 15:
        tips.append("第1部は話者の目的と困りごとを先に押さえると、選択肢を絞りやすい。")
    else:
        tips.append("第2部は1文目で場面、最後の文で結論が出やすい。冒頭と末尾を特に丁寧に聞く。")
    if question:
        tips.append("Question の疑問詞を確認し、何を答える問題かを先に固定する。")
    return tips[:5]


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in ROUND_FOLDERS:
        print(f"usage: py {Path(__file__).name} <round>  (round は {list(ROUND_FOLDERS)} のいずれか)")
        return 2
    round_id = sys.argv[1]
    folder = SOURCE_ROOT / ROUND_FOLDERS[round_id]
    files = ROUND_FILES[round_id]
    script_pdf = folder / files["script"]
    question_pdf = folder / files["question"]
    answer_pdf = folder / files["answer"]
    for p in (script_pdf, question_pdf, answer_pdf):
        if not p.exists():
            raise FileNotFoundError(p)

    audio = {
        1: ROOT / "assets" / "audio" / f"{round_id}-2q-part1.mp3",
        2: ROOT / "assets" / "audio" / f"{round_id}-2q-part2.mp3",
    }
    for p in audio.values():
        if not p.exists():
            raise FileNotFoundError(p)

    output = ROOT / "data" / f"lessons_{round_id}.json"
    clips_dir = ROOT / "assets" / "clips" / round_id

    choices = parse_choices(question_pdf)
    answers = parse_answers(answer_pdf)
    scripts = parse_scripts(script_pdf)
    segments = build_segments(audio)

    lessons = []
    for number in range(1, 31):
        part = 1 if number <= 15 else 2
        script = scripts[number]["script"]
        question = scripts[number]["question"]
        start, end = segments[number]
        audio_path, duration = clip_audio(clips_dir, number, part, start, end, audio)
        lessons.append({
            "id": number,
            "part": part,
            "audio": audio_path,
            "start": 0,
            "end": duration,
            "sourceAudio": f"assets/audio/{round_id}-2q-part{part}.mp3",
            "sourceStart": start,
            "sourceEnd": end,
            "question": question,
            "choices": choices[number],
            "answer": answers[number],
            "script": script,
            "tips": tips_for(number, script, question),
        })

    payload = {
        "title": ROUND_TITLES[round_id],
        "source": {
            "scriptPdf": str(script_pdf),
            "questionPdf": str(question_pdf),
            "answerPdf": str(answer_pdf),
            "segmentation": "ffmpeg silencedetectで約10秒の解答無音を検出し、各設問ごとのMP3クリップを生成。",
        },
        "lessons": lessons,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {output} ({len(lessons)} lessons)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
