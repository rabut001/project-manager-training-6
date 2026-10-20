#!/usr/bin/env python3
"""解答例 PDF のテキストから正解を取り、content/<回の id>.json の各問の answer と image に反映する。

既にある stem・choices・visuals・explanation は消さない。
"""

from __future__ import annotations

import argparse
import json
import re

import pymupdf

from exams import Exam, select

CHOICES = ("ア", "イ", "ウ", "エ")
ANSWER_RE = re.compile(r"問\s*(\d+)\s*([ア-エ])")


def read_answers(exam: Exam) -> dict[int, str]:
    doc = pymupdf.open(exam.answer_pdf)
    text = "\n".join(page.get_text() for page in doc)
    doc.close()
    answers: dict[int, str] = {}
    for no, choice in ANSWER_RE.findall(text):
        answers[int(no)] = choice
    missing = [no for no in exam.question_nos if no not in answers]
    if missing:
        raise SystemExit(f"{exam.id}: 解答例から取れなかった問があります: {missing}")
    return {no: answers[no] for no in exam.question_nos}


def build(exam: Exam) -> dict:
    answers = read_answers(exam)
    existing: dict[int, dict] = {}
    if exam.json_path.is_file():
        old = json.loads(exam.json_path.read_text(encoding="utf-8"))
        existing = {item["no"]: item for item in old.get("questions", [])}
    questions = []
    for no in exam.question_nos:
        old = existing.get(no, {})
        questions.append(
            {
                "no": no,
                "answer": answers[no],
                "image": f"{exam.id}/q{no:02d}.webp",
                "stem": old.get("stem", ""),
                "choices": old.get("choices", {}),
                "visuals": old.get("visuals", []),
                "explanation": old.get("explanation", ""),
            }
        )
    data = {"id": exam.id, "title": exam.title}
    if exam.excluded:
        data["excluded"] = [{"no": no, "reason": reason} for no, reason in exam.excluded.items()]
    data["questions"] = questions
    return data


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("ids", nargs="*", help="回の id。省略時は全回")
    args = parser.parse_args()
    for exam in select(args.ids):
        if not exam.answer_pdf.is_file():
            raise SystemExit(f"解答例がありません: {exam.answer_pdf}")
        data = build(exam)
        exam.json_path.parent.mkdir(parents=True, exist_ok=True)
        exam.json_path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"{exam.id}: 正解 {len(data['questions'])} 問を反映しました")


if __name__ == "__main__":
    main()
