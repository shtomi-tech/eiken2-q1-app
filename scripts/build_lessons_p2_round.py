"""英検準2級リスニング（2026-1以外の回）を設問ごとに分割し data/lessons-p2_{round}.json を生成する。

build_lessons_p2.py（2026-1固定）を汎用化したもの。使い方:
    py scripts/build_lessons_p2_round.py 2025-3
    py scripts/build_lessons_p2_round.py 2025-2
"""
from __future__ import annotations

import re
import subprocess
import sys
import json
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "materials" / "英検準2級"

ROUND_FOLDERS = {
    "2025-3": "2025年度第3回",
    "2025-2": "2025年度第2回",
}
ROUND_TITLES = {
    "2025-3": "英検準2級 2025年度 第3回 リスニング",
    "2025-2": "英検準2級 2025年度 第2回 リスニング",
}
ROUND_FILES = {
    "2025-3": {
        "script": "2025-3-1ji-p2kyuscript.pdf",
        "question": "2025-3-1ji-p2kyu.pdf",
        "answer": "202503Fp2kyu.pdf",
    },
    "2025-2": {
        "script": "2025-2-1ji-p2kyu_script.pdf",
        "question": "2025-2-1ji-p2kyu.pdf",
        "answer": "202502Fp2kyu.pdf",
    },
}

# 2026-1 の分析で判明した、日本語説明の後・各Part開始（No.X読み上げ）までの秒数。
# 説明音声は毎回共通の定型文のため、他の回でも同じ位置に現れる前提で流用する。
FIRST_START = {1: 147.0, 2: 26.0, 3: 31.0}

SPEAKER_RE = re.compile(r"^[★☆・�\s]+")


def extract_pdf_text(path: Path, pages: range | None = None) -> str:
    with pdfplumber.open(str(path), password="") as doc:
        selected = doc.pages if pages is None else [doc.pages[i - 1] for i in pages]
        return "\n".join(page.extract_text(x_tolerance=1, y_tolerance=3) or "" for page in selected)


def normalize_text(value: str) -> str:
    value = value.replace("\xad", "")
    value = value.replace("’", "'").replace("“", '"').replace("”", '"')
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def strip_speaker(line: str) -> str:
    return SPEAKER_RE.sub("", line).strip()


def parse_answers(answer_pdf: Path) -> dict[int, int]:
    text = normalize_text(extract_pdf_text(answer_pdf))
    if "準2級リスニング" in text:
        text = text[text.find("準2級リスニング"):]
    answers: dict[int, int] = {}
    for number, answer in re.findall(r"No\.\s*(\d+)\s+([1-4])", text):
        n = int(number)
        if 1 <= n <= 30:
            answers[n] = int(answer)
    return answers


def parse_printed_choices(question_pdf: Path) -> dict[int, list[str]]:
    text = normalize_text(extract_pdf_text(question_pdf, range(12, 16)))
    lines = [strip_speaker(l) for l in text.splitlines() if l.strip()]
    choices: dict[int, list[str]] = {}
    current: int | None = None
    for line in lines:
        head = re.match(r"No\s*\.\s*(\d+)\s+1\s+(.+)$", line)
        if head:
            current = int(head.group(1))
            choices[current] = [head.group(2).strip()]
            continue
        opt = re.match(r"([1-4])\s+(.+)$", line)
        if current is not None and opt and int(opt.group(1)) == len(choices[current]) + 1:
            choices[current].append(opt.group(2).strip())
            continue
        if current is not None and choices[current] and not re.match(r"(Grade|20\d\d|Listening|第|無断|公益)", line):
            choices[current][-1] += " " + line
    return {n: c for n, c in choices.items() if 11 <= n <= 30 and len(c) == 4}


def split_blocks(script_pdf: Path) -> dict[int, str]:
    text = normalize_text(extract_pdf_text(script_pdf))
    text = re.sub(r"20\d\d\s*年度.*?禁じます", "", text, flags=re.S)
    matches = list(re.finditer(r"No\.\s*(\d+)", text))
    blocks: dict[int, str] = {}
    for i, m in enumerate(matches):
        number = int(m.group(1))
        if not 1 <= number <= 30:
            continue
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        blocks[number] = text[start:end]
    return blocks


def parse_part1(block: str) -> tuple[str, list[str]]:
    conversation: list[str] = []
    options: list[str] = []
    for raw in block.splitlines():
        raw = raw.strip()
        if not raw:
            continue
        body = strip_speaker(raw)
        if not body:
            continue
        if re.search(r"[ぁ-んァ-ヶ一-龠]", body):
            break
        opt = re.match(r"([123])\s+(.+)$", body)
        if opt and int(opt.group(1)) == len(options) + 1:
            options.append(opt.group(2).strip())
        elif options:
            options[-1] += " " + body
        else:
            conversation.append(raw)
    return "\n".join(conversation).strip(), [o.strip() for o in options]


def parse_part23(block: str) -> tuple[str, str]:
    qm = re.search(r"Question:\s*(.+)", block, flags=re.S)
    question = ""
    if qm:
        question = strip_speaker(qm.group(1).strip().splitlines()[0]).strip()
        block = block[: qm.start()]
    lines = [l.strip() for l in block.splitlines() if l.strip()]
    return "\n".join(lines).strip(), question


def silence_events(audio: Path) -> list[dict[str, float]]:
    completed = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(audio),
         "-af", "silencedetect=noise=-35dB:d=0.8", "-f", "null", "-"],
        capture_output=True, text=True, encoding="utf-8", errors="replace", check=False,
    )
    events: list[dict[str, float]] = []
    current_start: float | None = None
    for line in completed.stderr.splitlines():
        sm = re.search(r"silence_start: ([0-9.]+)", line)
        if sm:
            current_start = float(sm.group(1))
        em = re.search(r"silence_end: ([0-9.]+).*silence_duration: ([0-9.]+)", line)
        if em and current_start is not None:
            events.append({"start": current_start, "end": float(em.group(1)), "duration": float(em.group(2))})
            current_start = None
    return events


def build_segments(audio: dict[int, Path]) -> dict[int, tuple[int, float, float]]:
    segments: dict[int, tuple[int, float, float]] = {}
    for part, base_no, count in ((1, 1, 10), (2, 11, 10), (3, 21, 10)):
        gaps = [e for e in silence_events(audio[part]) if e["duration"] >= 6.0][:count]
        if len(gaps) < count:
            raise RuntimeError(f"part{part}: 解答無音を{count}個検出できず({len(gaps)}個)")
        starts = [FIRST_START[part]] + [gaps[i]["end"] - 0.3 for i in range(count - 1)]
        for i in range(count):
            number = base_no + i
            segments[number] = (part, round(starts[i], 2), round(gaps[i]["start"] + 0.2, 2))
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


def tips_for(number: int, part: int, script: str, question: str) -> list[str]:
    lower = script.lower()
    tips: list[str] = []
    contractions = sorted(set(re.findall(r"\b\w+'(?:m|re|ve|d|ll|s|t)\b", script)))
    if contractions:
        tips.append("短縮形は弱く速く出ます: " + ", ".join(contractions[:5]))
    for phrase in ["going to", "want to", "have to", "used to", "would like to", "need to"]:
        if phrase in lower:
            tips.append(f"{phrase} は語の切れ目より、ひとまとまりの音で拾う。")
            break
    if re.search(r"\b(?:street|avenue|airport|flight|platform|mall|library|theater|"
                 r"museum|station|park|store|shop|office)\b", lower):
        tips.append("場所・施設名は内容理解の柱です。前置詞とセットで聞き取る。")
    if re.search(r"\b(?:minute|hour|o'clock|percent|first|next|last|today|tomorrow|week|year|month)\b", lower):
        tips.append("数字・時制表現は選択肢の根拠になりやすいので、単語だけでなく周辺表現も確認する。")
    if part == 1:
        tips.append("第1部は対話の最後の一文への応答を選ぶ。最後の発話の意図を特に丁寧に聞く。")
    elif part == 2:
        tips.append("第2部は対話の目的・依頼を先に押さえると、選択肢を絞りやすい。")
    else:
        tips.append("第3部は1文目で場面、最後の文で結論が出やすい。冒頭と末尾を特に丁寧に聞く。")
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
        1: ROOT / "assets" / "audio" / f"{round_id}-p2-part1.mp3",
        2: ROOT / "assets" / "audio" / f"{round_id}-p2-part2.mp3",
        3: ROOT / "assets" / "audio" / f"{round_id}-p2-part3.mp3",
    }
    for p in audio.values():
        if not p.exists():
            raise FileNotFoundError(p)

    output = ROOT / "data" / f"lessons-p2_{round_id}.json"
    clips_dir = ROOT / "assets" / "clips" / "p2" / round_id

    answers = parse_answers(answer_pdf)
    printed = parse_printed_choices(question_pdf)
    blocks = split_blocks(script_pdf)
    segments = build_segments(audio)

    lessons = []
    for number in range(1, 31):
        part, start, end = segments[number]
        if part == 1:
            script, choices = parse_part1(blocks[number])
            question = ""
        else:
            script, question = parse_part23(blocks[number])
            choices = printed[number]
        audio_path, duration = clip_audio(clips_dir, number, part, start, end, audio)
        lessons.append({
            "id": number,
            "part": part,
            "audio": audio_path,
            "start": 0,
            "end": duration,
            "sourceAudio": f"assets/audio/{round_id}-p2-part{part}.mp3",
            "sourceStart": start,
            "sourceEnd": end,
            "question": question,
            "choices": choices,
            "answer": answers[number],
            "script": script,
            "tips": tips_for(number, part, script, question),
        })

    payload = {
        "title": ROUND_TITLES[round_id],
        "source": {
            "scriptPdf": str(script_pdf),
            "questionPdf": str(question_pdf),
            "answerPdf": str(answer_pdf),
            "segmentation": "ffmpeg silencedetectで約10秒の解答無音を検出し、各設問ごとのMP3クリップを生成。第1部の選択肢は放送されるため台本から取得。",
        },
        "lessons": lessons,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {output} ({len(lessons)} lessons)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
