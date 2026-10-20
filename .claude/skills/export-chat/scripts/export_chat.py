#!/usr/bin/env python3
"""Claude Code のトランスクリプト（jsonl）を、chat-exports/<開始時刻>/chat.md に書き出す。

ユーザーとアシスタントの本文だけを書く。ツール呼び出し、ツールの結果、思考、ハーネスが挟んだ通知
（system-reminder、タスク通知、サブエージェントの報告）は含めない。
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

JST = ZoneInfo("Asia/Tokyo")

# 本文から取り除く、ハーネスが挟んだ部分。
STRIP_PATTERNS = [
    re.compile(r"<system-reminder[^>]*>.*?</system-reminder[^>]*>", re.S),
    re.compile(r"\[SYSTEM NOTIFICATION - NOT USER INPUT\].*?</task-notification>", re.S),
    re.compile(r"<task-notification>.*?</task-notification>", re.S),
    re.compile(r"<pasted_content[^>]*>|</pasted_content[^>]*>"),
]
# これを含む、または先頭にあるユーザー発言は、サブエージェントやハーネスの通知なので捨てる。
NOTICE_MARKERS = (
    "Another Claude session sent a message",
    "<agent-message from=",
    "[SYSTEM NOTIFICATION",
    "<ci-monitor-event>",
    "[Request interrupted by user",
)
# 書き出した本文に残してはいけない秘密の形。
SECRET_RE = re.compile(r"gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-ant-[A-Za-z0-9_-]{20,}")


def repo_root(start: Path) -> Path:
    for candidate in (start.resolve(), *start.resolve().parents):
        if (candidate / "AGENTS.md").is_file():
            return candidate
    raise SystemExit("AGENTS.md が見つかりません。リポジトリ直下で実行してください。")


def text_blocks(entry: dict) -> list[str]:
    content = (entry.get("message") or {}).get("content")
    if isinstance(content, str):
        return [content]
    if not isinstance(content, list):
        return []
    return [b["text"] for b in content if b.get("type") == "text" and isinstance(b.get("text"), str)]


def clean_user(text: str) -> str:
    if any(marker in text for marker in NOTICE_MARKERS) and not text.lstrip().startswith("<"):
        # 通知が本文に混ざっている場合は、通知より前だけを残す。
        positions = [text.find(m) for m in NOTICE_MARKERS if m in text]
        text = text[: min(positions)]
    for pattern in STRIP_PATTERNS:
        text = pattern.sub("", text)
    if any(marker in text for marker in NOTICE_MARKERS):
        return ""
    return text.strip()


def load(paths: list[Path]) -> list[dict]:
    entries: list[dict] = []
    for path in paths:
        for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if not line.strip():
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError as exc:
                raise SystemExit(f"{path}:{line_no}: JSON として読めません: {exc}") from exc
            if entry.get("type") in ("user", "assistant") and not entry.get("isSidechain") and entry.get("timestamp"):
                entries.append(entry)
    entries.sort(key=lambda e: e["timestamp"])
    return entries


def stamp(entry: dict) -> datetime:
    return datetime.fromisoformat(entry["timestamp"].replace("Z", "+00:00")).astimezone(JST)


def build(entries: list[dict]) -> tuple[datetime, str]:
    sections: list[str] = []
    start: datetime | None = None
    last_user = ""
    for entry in entries:
        role = entry["type"]
        if role == "user":
            if entry.get("isMeta"):
                continue
            body = "\n\n".join(t for t in (clean_user(b) for b in text_blocks(entry)) if t)
            # トランスクリプトには、同じ発言が二重に記録されることがある。直前と同じ発言は捨てる。
            if not body or body == last_user:
                continue
            last_user = body
            when = stamp(entry)
            start = start or when
            sections.append(f"## ユーザー\n\n*{when:%Y-%m-%d %H:%M} (UTC+9)*\n\n{body}")
        else:
            body = "\n\n".join(b.strip() for b in text_blocks(entry) if b.strip())
            if body:
                sections.append(f"## アシスタント\n\n{body}")
    if start is None:
        raise SystemExit("ユーザーの発言が見つかりません。")
    head = f"# チャット書き出し\n\nセッション開始: {start:%Y-%m-%d %H:%M}\n"
    return start, head + "\n" + "\n\n".join(sections) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--transcript", action="append", required=True, type=Path,
                        help="トランスクリプトの jsonl。会話が複数のファイルに分かれているときは、繰り返し指定する")
    args = parser.parse_args()
    for path in args.transcript:
        if not path.is_file():
            raise SystemExit(f"トランスクリプトがありません: {path}")

    start, markdown = build(load(args.transcript))
    leaked = SECRET_RE.search(markdown)
    if leaked:
        raise SystemExit("書き出す本文に秘密らしき文字列が含まれています。書き出しを中止しました。")

    out = repo_root(Path.cwd()) / "chat-exports" / f"{start:%Y-%m-%d-%H%M}" / "chat.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(markdown, encoding="utf-8")
    print(out)


if __name__ == "__main__":
    sys.exit(main())
