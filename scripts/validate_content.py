#!/usr/bin/env python3
"""content/ の回ごとの JSON と問題画像を検証する。問題があれば終了コード 1 で終わる。

既定では「骨組み」（正解・画像）だけを見る。--complete を付けると、問題文・肢・図表の区分・解説も必須にする。
content/exams.json（一覧に出す回）は、--complete を満たす回だけを載せる。
"""

from __future__ import annotations

import argparse
import json
import sys

from PIL import Image

from exams import CONTENT, EXAMS, Exam, select
from extract_answers import CHOICES, read_answers

VISUALS = {"figure", "table", "image"}
MAX_IMAGE_HEIGHT = 4000


def check_exam(exam: Exam, complete: bool) -> list[str]:
    errors: list[str] = []
    if not exam.json_path.is_file():
        return [f"{exam.json_path.name}: ファイルがありません"]
    data = json.loads(exam.json_path.read_text(encoding="utf-8"))
    if data.get("id") != exam.id:
        errors.append("id が回の定義と一致しません")
    if data.get("title") != exam.title:
        errors.append("title が回の定義と一致しません")
    expected_excluded = [{"no": no, "reason": reason} for no, reason in exam.excluded.items()]
    if data.get("excluded", []) != expected_excluded:
        errors.append("excluded が回の定義と一致しません")
    questions = data.get("questions", [])
    if [item.get("no") for item in questions] != exam.question_nos:
        errors.append(f"questions の問番号が {exam.question_nos} になっていません")
        return [f"{exam.id}: {message}" for message in errors]

    official = read_answers(exam)
    for item in questions:
        no = item["no"]
        label = f"{exam.id} 問{no}"
        if item.get("answer") not in CHOICES:
            errors.append(f"{label}: answer がア〜エではありません")
        elif item["answer"] != official[no]:
            errors.append(f"{label}: answer が解答例 PDF と一致しません")
        if item.get("image") != f"{exam.id}/q{no:02d}.webp":
            errors.append(f"{label}: image のパスが規則に合いません")
        else:
            path = CONTENT / item["image"]
            if not path.is_file():
                errors.append(f"{label}: 画像がありません")
            else:
                with Image.open(path) as image:
                    if image.height > MAX_IMAGE_HEIGHT or image.height < 100:
                        errors.append(f"{label}: 画像の高さが不自然です ({image.height}px)")
        if not complete:
            continue
        if not item.get("stem", "").strip():
            errors.append(f"{label}: stem が空です")
        choices = item.get("choices", {})
        if list(choices) != list(CHOICES) or not all(str(v).strip() for v in choices.values()):
            errors.append(f"{label}: choices がア〜エの4肢そろっていません")
        visuals = item.get("visuals")
        if not isinstance(visuals, list) or not set(visuals) <= VISUALS:
            errors.append(f"{label}: visuals が不正です")
        if not item.get("explanation", "").strip():
            errors.append(f"{label}: explanation が空です")
    return errors


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("ids", nargs="*", help="回の id。省略時は JSON がある全回")
    parser.add_argument("--complete", action="store_true", help="問題文・肢・解説も必須にする")
    args = parser.parse_args()

    errors: list[str] = []
    checked = 0
    for exam in select(args.ids):
        if not exam.json_path.is_file():
            continue
        checked += 1
        errors += check_exam(exam, args.complete)

    index_path = CONTENT / "exams.json"
    if index_path.is_file():
        entries = json.loads(index_path.read_text(encoding="utf-8"))
        listed = [item["id"] for item in entries]
        known = {exam.id: exam for exam in EXAMS}
        for exam_id in listed:
            if exam_id not in known:
                errors.append(f"exams.json: 未定義の回 {exam_id}")
            else:
                errors += check_exam(known[exam_id], complete=True)
        for item in entries:
            exam = known.get(item["id"])
            if exam and (item.get("title") != exam.title or item.get("count") != len(exam.question_nos)):
                errors.append(f"exams.json: {item['id']} の title または count が定義と一致しません")
        expected = [exam.id for exam in EXAMS if exam.id in listed]
        if listed != expected:
            errors.append("exams.json の並びが定義の順（新しい順）ではありません")

    for message in errors:
        print(message)
    if errors:
        print(f"{len(errors)} 件の問題があります。")
        sys.exit(1)
    print(f"{checked} 回を検証しました。問題はありません。")


if __name__ == "__main__":
    main()
