#!/usr/bin/env python3
"""content/exams.json を作る。問題文・肢・解説までそろった回だけを、新しい順に載せる。"""

from __future__ import annotations

import json

from exams import CONTENT, EXAMS
from validate_content import check_exam


def main() -> None:
    listed = []
    for exam in EXAMS:
        if exam.json_path.is_file() and not check_exam(exam, complete=True):
            listed.append({"id": exam.id, "title": exam.title, "count": len(exam.question_nos)})
    CONTENT.mkdir(parents=True, exist_ok=True)
    (CONTENT / "exams.json").write_text(
        json.dumps(listed, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"exams.json に {len(listed)} 回を載せました。")


if __name__ == "__main__":
    main()
