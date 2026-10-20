#!/usr/bin/env python3
"""IPA の過去問題ページから、プロジェクトマネージャ試験の午前Ⅱの問題冊子と解答例を取得する。

取得したファイルは sources/<回の id>/ に置き、URL・サイズ・sha256 を sources/manifest.json に記録する。
既にあるファイルは取得し直さない（--force で上書き）。
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import urllib.request
from datetime import date

from exams import EXAMS_BY_ID, IPA_BASE, SOURCES, Exam, select

PAGE_URL = IPA_BASE + "/shiken/mondai-kaiotu/{page}.html"
LINK_RE = re.compile(r'href="([^"]*_pm_am2_(qs|ans)\.pdf)"')
MANIFEST = SOURCES / "manifest.json"


def download(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "project-manager-training-6"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def pdf_links(exam: Exam) -> dict[str, str]:
    html = download(PAGE_URL.format(page=exam.ipa_page)).decode("utf-8", errors="ignore")
    links = {kind: path for path, kind in LINK_RE.findall(html)}
    if set(links) != {"qs", "ans"}:
        raise SystemExit(f"{exam.id}: 午前Ⅱの問題冊子と解答例のリンクを取れませんでした。")
    return links


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("ids", nargs="*", help="回の id。省略時は全回")
    parser.add_argument("--force", action="store_true", help="取得済みのファイルも上書きする")
    args = parser.parse_args()

    manifest: dict[str, dict] = {}
    if MANIFEST.is_file():
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))

    for exam in select(args.ids):
        if not args.force and exam.question_pdf.is_file() and exam.answer_pdf.is_file() and exam.id in manifest:
            print(f"{exam.id}: 取得済み")
            continue
        links = pdf_links(exam)
        exam.source_dir.mkdir(parents=True, exist_ok=True)
        entry = {"title": exam.title, "page": PAGE_URL.format(page=exam.ipa_page), "files": {}}
        for kind, target in (("qs", exam.question_pdf), ("ans", exam.answer_pdf)):
            url = IPA_BASE + links[kind]
            data = download(url)
            target.write_bytes(data)
            entry["files"][target.name] = {
                "url": url,
                "original": url.rsplit("/", 1)[1],
                "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
                "retrieved": date.today().isoformat(),
            }
        manifest[exam.id] = entry
        print(f"{exam.id}: 取得しました")

    ordered = {exam_id: manifest[exam_id] for exam_id in EXAMS_BY_ID if exam_id in manifest}
    MANIFEST.write_text(json.dumps(ordered, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
