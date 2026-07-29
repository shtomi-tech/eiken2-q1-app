from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = Path(r"C:\Users\shtom\Downloads")

SCRIPT_PDF = DOWNLOADS / "2026-1-1ji_2kyuscript.pdf"
QUESTION_PDF = DOWNLOADS / "2026-1-1ji-2kyu.pdf"
ANSWER_PDF = DOWNLOADS / "202601F2kyu.pdf"

AUDIO = {
    1: ROOT / "assets" / "audio" / "2026-1-2q-part1.mp3",
    2: ROOT / "assets" / "audio" / "2026-1-2q-part2.mp3",
}

OUTPUT = ROOT / "data" / "lessons.json"
CLIPS_DIR = ROOT / "assets" / "clips"


def extract_pdf_text(path: Path, pages: range | None = None) -> str:
    with pdfplumber.open(str(path), password="") as doc:
        selected = doc.pages if pages is None else [doc.pages[i - 1] for i in pages]
        return "\n".join(page.extract_text(x_tolerance=1, y_tolerance=3) or "" for page in selected)


def normalize_text(value: str) -> str:
    value = value.replace("\xad", "")
    value = value.replace("\ufffdf", "'")
    value = value.replace("\ufffdg", '"').replace("\ufffdh", '"')
    value = value.replace("�f", "'").replace("�g", '"').replace("�h", '"')
    value = value.replace("’", "'").replace("“", '"').replace("”", '"')
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def parse_choices() -> dict[int, list[str]]:
    text = normalize_text(extract_pdf_text(QUESTION_PDF, range(16, 24)))
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
        if current is not None and current_choice is not None and not line.startswith(("Grade", "2026", "copyright", "無断")):
            choices[current][-1] += " " + line
    return choices


def parse_answers() -> dict[int, int]:
    text = normalize_text(extract_pdf_text(ANSWER_PDF))
    answers: dict[int, int] = {}
    for number, answer in re.findall(r"No\.\s*(\d+)\s+([1-4])", text):
        n = int(number)
        if 1 <= n <= 30:
            answers[n] = int(answer)
    return answers


def parse_scripts() -> dict[int, dict[str, str]]:
    text = normalize_text(extract_pdf_text(SCRIPT_PDF))
    text = re.sub(r"2026.*?禁止します", "", text)
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
    line = re.sub(r"^[\ufffd・\s]+", "", line)
    line = re.sub(r"^Question:\s*", "", line)
    return line.strip()


def silence_events(audio: Path) -> list[dict[str, float]]:
    completed = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-i",
            str(audio),
            "-af",
            "silencedetect=noise=-35dB:d=0.8",
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    events: list[dict[str, float]] = []
    current_start: float | None = None
    for line in completed.stderr.splitlines():
        start_match = re.search(r"silence_start: ([0-9.]+)", line)
        if start_match:
            current_start = float(start_match.group(1))
        end_match = re.search(r"silence_end: ([0-9.]+).*silence_duration: ([0-9.]+)", line)
        if end_match and current_start is not None:
            events.append(
                {
                    "start": current_start,
                    "end": float(end_match.group(1)),
                    "duration": float(end_match.group(2)),
                }
            )
            current_start = None
    return events


def build_segments() -> dict[int, tuple[float, float]]:
    segments: dict[int, tuple[float, float]] = {}

    part1_long = [event for event in silence_events(AUDIO[1]) if event["duration"] >= 8.0][:15]
    # Skip the opening Japanese instructions and the "No. 1" cue.
    part1_starts = [111.94] + [event["end"] + 0.55 for event in part1_long[:-1]]
    for offset, event in enumerate(part1_long):
        number = offset + 1
        segments[number] = (round(part1_starts[offset], 2), round(event["start"] + 0.15, 2))

    part2_long = [event for event in silence_events(AUDIO[2]) if event["duration"] >= 8.0][:15]
    # Skip the part intro and the "No. 16" cue.
    part2_starts = [33.94] + [event["end"] + 0.55 for event in part2_long[:-1]]
    for offset, event in enumerate(part2_long):
        number = offset + 16
        segments[number] = (round(part2_starts[offset], 2), round(event["start"] + 0.15, 2))

    return segments


def clip_audio(number: int, part: int, start: float, end: float) -> tuple[str, float]:
    CLIPS_DIR.mkdir(parents=True, exist_ok=True)
    output = CLIPS_DIR / f"no-{number:02d}.mp3"
    duration = max(0.1, end - start)
    completed = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-y",
            "-ss",
            f"{start:.2f}",
            "-t",
            f"{duration:.2f}",
            "-i",
            str(AUDIO[part]),
            "-vn",
            "-codec:a",
            "libmp3lame",
            "-q:a",
            "3",
            str(output),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(f"ffmpeg failed for No.{number}: {completed.stderr}")
    return (f"assets/clips/{output.name}", round(duration, 2))


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
    choices = parse_choices()
    answers = parse_answers()
    scripts = parse_scripts()
    segments = build_segments()
    lessons = []
    for number in range(1, 31):
        part = 1 if number <= 15 else 2
        script = scripts[number]["script"]
        question = scripts[number]["question"]
        start, end = segments[number]
        audio_path, duration = clip_audio(number, part, start, end)
        lessons.append(
            {
                "id": number,
                "part": part,
                "audio": audio_path,
                "start": 0,
                "end": duration,
                "sourceAudio": f"assets/audio/2026-1-2q-part{part}.mp3",
                "sourceStart": start,
                "sourceEnd": end,
                "question": question,
                "choices": choices[number],
                "answer": answers[number],
                "script": script,
                "tips": tips_for(number, script, question),
            }
        )
    payload = {
        "title": "英検2級 2026年度 第1回 リスニング",
        "source": {
            "scriptPdf": str(SCRIPT_PDF),
            "questionPdf": str(QUESTION_PDF),
            "answerPdf": str(ANSWER_PDF),
            "segmentation": "ffmpeg silencedetectで約10秒の解答無音を検出し、各設問ごとのMP3クリップを生成。",
        },
        "lessons": lessons,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUTPUT} ({len(lessons)} lessons)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
