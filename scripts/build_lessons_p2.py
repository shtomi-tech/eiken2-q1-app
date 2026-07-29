"""英検準2級リスニング（2026年度 第1回）を設問ごとに分割し data/lessons-p2.json を生成する。

構成:
  第1部 No.1-10  … 対話への応答選択。選択肢(1/2/3)は放送されるため台本から取得。
  第2部 No.11-20 … 対話の内容一致。選択肢は問題冊子(4択)、Question は台本から。
  第3部 No.21-30 … 英文の内容一致。選択肢は問題冊子(4択)、Question は台本から。

音声は各部1ファイル。ffmpeg silencedetect で約10秒の解答無音を検出し、各設問クリップを書き出す。
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
DESKTOP = Path(r"C:\Users\shtom\OneDrive\デスクトップ\eikenn")

SCRIPT_PDF = DESKTOP / "2026-1-1ji_p2kyuscript.pdf"
QUESTION_PDF = DESKTOP / "2026-1-1ji-p2kyu.pdf"
ANSWER_PDF = DESKTOP / "202601Fp2kyu.pdf"

AUDIO = {
    1: ROOT / "assets" / "audio" / "2026-1-p2-part1.mp3",
    2: ROOT / "assets" / "audio" / "2026-1-p2-part2.mp3",
    3: ROOT / "assets" / "audio" / "2026-1-p2-part3.mp3",
}

OUTPUT = ROOT / "data" / "lessons-p2.json"
CLIPS_DIR = ROOT / "assets" / "clips" / "p2"

# 各部の最初の設問の開始秒。直前の無音（日本語説明の後の間）内に置き、"No.X" 読み上げを確実に含める。
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


def parse_answers() -> dict[int, int]:
    """解答PDFの「準2級リスニング」欄から No.1-30 の正解番号を取得する。"""
    text = normalize_text(extract_pdf_text(ANSWER_PDF))
    text = text[text.find("準2級リスニング"):]
    answers: dict[int, int] = {}
    for number, answer in re.findall(r"No\.\s*(\d+)\s+([1-4])", text):
        n = int(number)
        if 1 <= n <= 30:
            answers[n] = int(answer)
    return answers


def parse_printed_choices() -> dict[int, list[str]]:
    """問題冊子(第2部・第3部)の4択選択肢を No.11-30 について取得する。"""
    text = normalize_text(extract_pdf_text(QUESTION_PDF, range(12, 16)))
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
        # ページ見出し等はスキップ。選択肢の折り返しのみ結合。
        if current is not None and choices[current] and not re.match(r"(Grade|2026|Listening|第|無断|公益)", line):
            choices[current][-1] += " " + line
    return {n: c for n, c in choices.items() if 11 <= n <= 30 and len(c) == 4}


def split_blocks() -> dict[int, str]:
    """台本を No.X ごとのブロックに分割。日本語説明中の 'No. 1〜No. 10' 等の言及より
    後方（本体）の出現が最後に上書きされるため、各番号の本体ブロックが残る。"""
    text = normalize_text(extract_pdf_text(SCRIPT_PDF))
    text = re.sub(r"2026\s*年度.*?禁じます", "", text, flags=re.S)
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
    """第1部ブロックを対話(script)と応答選択肢3つ(choices)に分ける。"""
    conversation: list[str] = []
    options: list[str] = []
    for raw in block.splitlines():
        raw = raw.strip()
        if not raw:
            continue
        body = strip_speaker(raw)
        if not body:  # ☆☆ などの話者記号のみの行
            continue
        if re.search(r"[ぁ-んァ-ヶ一-龠]", body):  # 次セクションの和文説明に到達
            break
        opt = re.match(r"([123])\s+(.+)$", body)
        if opt and int(opt.group(1)) == len(options) + 1:
            options.append(opt.group(2).strip())
        elif options:  # 折り返した選択肢
            options[-1] += " " + body
        else:
            conversation.append(raw)
    return "\n".join(conversation).strip(), [o.strip() for o in options]


def parse_part23(block: str) -> tuple[str, str]:
    """第2部・第3部ブロックを本文(script)と Question に分ける。"""
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
            events.append({"start": current_start, "end": float(em.group(1)),
                           "duration": float(em.group(2))})
            current_start = None
    return events


def build_segments() -> dict[int, tuple[int, float, float]]:
    """各設問の (part, sourceStart, sourceEnd) を無音検出から算出する。"""
    segments: dict[int, tuple[int, float, float]] = {}
    for part, base_no, count in ((1, 1, 10), (2, 11, 10), (3, 21, 10)):
        gaps = [e for e in silence_events(AUDIO[part]) if e["duration"] >= 6.0][:count]
        if len(gaps) < count:
            raise RuntimeError(f"part{part}: 解答無音を{count}個検出できず({len(gaps)}個)")
        starts = [FIRST_START[part]] + [gaps[i]["end"] - 0.3 for i in range(count - 1)]
        for i in range(count):
            number = base_no + i
            segments[number] = (part, round(starts[i], 2), round(gaps[i]["start"] + 0.2, 2))
    return segments


def clip_audio(number: int, part: int, start: float, end: float) -> tuple[str, float]:
    CLIPS_DIR.mkdir(parents=True, exist_ok=True)
    output = CLIPS_DIR / f"no-{number:02d}.mp3"
    duration = max(0.1, end - start)
    completed = subprocess.run(
        ["ffmpeg", "-hide_banner", "-y", "-ss", f"{start:.2f}", "-t", f"{duration:.2f}",
         "-i", str(AUDIO[part]), "-vn", "-codec:a", "libmp3lame", "-q:a", "3", str(output)],
        capture_output=True, text=True, encoding="utf-8", errors="replace", check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(f"ffmpeg failed for No.{number}: {completed.stderr}")
    return (f"assets/clips/p2/{output.name}", round(duration, 2))


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
    answers = parse_answers()
    printed = parse_printed_choices()
    blocks = split_blocks()
    segments = build_segments()

    lessons = []
    for number in range(1, 31):
        part, start, end = segments[number]
        if part == 1:
            script, choices = parse_part1(blocks[number])
            question = ""
        else:
            script, question = parse_part23(blocks[number])
            choices = printed[number]
        audio_path, duration = clip_audio(number, part, start, end)
        lessons.append({
            "id": number,
            "part": part,
            "audio": audio_path,
            "start": 0,
            "end": duration,
            "sourceAudio": f"assets/audio/2026-1-p2-part{part}.mp3",
            "sourceStart": start,
            "sourceEnd": end,
            "question": question,
            "choices": choices,
            "answer": answers[number],
            "script": script,
            "tips": tips_for(number, part, script, question),
        })

    payload = {
        "title": "英検準2級 2026年度 第1回 リスニング",
        "source": {
            "scriptPdf": str(SCRIPT_PDF),
            "questionPdf": str(QUESTION_PDF),
            "answerPdf": str(ANSWER_PDF),
            "segmentation": "ffmpeg silencedetectで約10秒の解答無音を検出し、各設問ごとのMP3クリップを生成。第1部の選択肢は放送されるため台本から取得。",
        },
        "lessons": lessons,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUTPUT} ({len(lessons)} lessons)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
