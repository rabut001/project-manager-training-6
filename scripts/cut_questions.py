#!/usr/bin/env python3
"""午前Ⅱの問題冊子（ページ全体が画像）を、問と問のあいだの余白で1問ずつ切り出す。

問番号の位置は OCR（tesseract、日本語データ）で探す。切り出した画像は content/<回の id>/qNN.webp に置く。
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import tempfile
from pathlib import Path

import pymupdf
from PIL import Image

from exams import QUESTION_COUNT, Exam, select

THRESH = 180
MIN_RUN = 9
STRAY_ROWS = 12
PAD_X = 40
PAD_Y = 36
RENDER_SCALE = 200 / 72
HEADER_RE = re.compile(r"[問間]\d+")
OCR_MODES = (6, 4, 11)


def dark_runs(row: bytes) -> list[tuple[int, int]]:
    runs: list[tuple[int, int]] = []
    start = None
    for x, pixel in enumerate(row):
        if pixel < THRESH:
            if start is None:
                start = x
        elif start is not None:
            if x - start >= MIN_RUN:
                runs.append((start, x))
            start = None
    if start is not None and len(row) - start >= MIN_RUN:
        runs.append((start, len(row)))
    return runs


def is_page_number(runs: list[tuple[int, int]], width: int) -> bool:
    if not runs:
        return False
    x0 = runs[0][0]
    x1 = runs[-1][1]
    span = x1 - x0
    center = (x0 + x1) / 2
    return 40 < span < 160 and abs(center - width / 2) < 120


def footer_top(samples: bytes, width: int, height: int) -> int:
    """下端から見て、ページ番号「- n -」の上端を返す。"""
    y = height - 1
    limit = int(height * 0.75)
    while y > limit:
        runs = dark_runs(samples[y * width : (y + 1) * width])
        if is_page_number(runs, width):
            while y > limit:
                above = samples[(y - 1) * width : y * width]
                center_band = above[width // 2 - 80 : width // 2 + 80]
                if not any(pixel < THRESH for pixel in center_band):
                    break
                y -= 1
            return y
        y -= 1
    return int(height * 0.90)


def content_bounds(
    samples: bytes, width: int, y0: int, y1: int
) -> tuple[int, int, int, int] | None:
    ink_rows: list[int] = []
    for y in range(y0, y1):
        row = samples[y * width : (y + 1) * width]
        if sum(pixel < THRESH for pixel in row) >= MIN_RUN:
            ink_rows.append(y)
    if not ink_rows:
        return None
    # ページ番号の手前にある孤立した汚れは、問の本文から大きく離れた小さな塊なので捨てる。
    # 図と選択肢のあいだの大きな余白では切らない。
    groups: list[list[int]] = [[ink_rows[0]]]
    for y in ink_rows[1:]:
        if y - groups[-1][-1] > 160:
            groups.append([])
        groups[-1].append(y)
    while len(groups) > 1 and len(groups[-1]) <= STRAY_ROWS:
        groups.pop()
    ink_rows = [y for group in groups for y in group]
    columns = [0] * width
    for y in ink_rows:
        row = samples[y * width : (y + 1) * width]
        for x, pixel in enumerate(row):
            if pixel < THRESH:
                columns[x] += 1
    clusters: list[list[int]] = []
    start = None
    for x, count in enumerate(columns):
        if count >= 3:
            if start is None:
                start = x
        elif start is not None:
            clusters.append([start, x])
            start = None
    if start is not None:
        clusters.append([start, width])
    merged: list[list[int]] = []
    for cluster in clusters:
        # 選択肢が左右に離れて並ぶ行も、一つの問として残す。
        if not merged or cluster[0] - merged[-1][1] > 180:
            merged.append(cluster)
        else:
            merged[-1][1] = cluster[1]
    main = max(merged, key=lambda item: item[1] - item[0])
    return main[0], ink_rows[0], main[1], ink_rows[-1] + 1


def ink_rows_below(samples: bytes, width: int, y_from: int, y_to: int) -> int:
    """切り出した範囲より下に、文字や図の行がいくつ残っているかを返す。"""
    count = 0
    for y in range(y_from, y_to):
        row = samples[y * width : (y + 1) * width]
        if sum(pixel < THRESH for pixel in row) >= MIN_RUN:
            count += 1
    return count


def header_ys(page: pymupdf.Page, psm: int) -> list[float]:
    """問番号の行の上端を、ページ上のポイント座標で返す。psm は tesseract のページ分割モード。"""
    clip = pymupdf.Rect(20, 30, 150, page.rect.height - 30)
    pix = page.get_pixmap(
        matrix=pymupdf.Matrix(3, 3),
        colorspace=pymupdf.csGRAY,
        alpha=False,
        clip=clip,
    )
    fd, path = tempfile.mkstemp(suffix=".png")
    os.close(fd)
    pix.save(path)
    try:
        proc = subprocess.run(
            ["tesseract", path, "stdout", "-l", "jpn", "--psm", str(psm), "tsv"],
            capture_output=True,
            text=True,
            check=False,
        )
    finally:
        os.remove(path)
    lines: dict[tuple[str, str, str], list[list[str]]] = {}
    for row in proc.stdout.splitlines()[1:]:
        cols = row.split("\t")
        if len(cols) < 12 or cols[0] != "5" or not cols[11].strip():
            continue
        lines.setdefault((cols[2], cols[3], cols[4]), []).append(cols)
    ys: list[float] = []
    for words in lines.values():
        words.sort(key=lambda word: int(word[6]))
        text = "".join(word[11].strip() for word in words).replace(" ", "")
        text = text.lstrip("・･.．-* ")
        if HEADER_RE.match(text):
            top = min(int(word[7]) for word in words)
            ys.append(30 + top / 3)
    return merge_ys(ys)


def merge_ys(found: list[float]) -> list[float]:
    found = sorted(found)
    merged: list[float] = []
    for y in found:
        if not merged or y - merged[-1] > 8:
            merged.append(y)
    return merged


def find_headers(doc: pymupdf.Document) -> list[list[float]]:
    """ページごとの問番号の位置を返す。数が足りなければ、別のページ分割モードの結果も合わせる。"""
    per_page: list[list[float]] = [[] for _ in range(doc.page_count)]
    for psm in OCR_MODES:
        for index, page in enumerate(doc):
            per_page[index] = merge_ys(per_page[index] + header_ys(page, psm))
        if sum(len(ys) for ys in per_page) == QUESTION_COUNT:
            break
    return per_page


def cut_exam(exam: Exam) -> int:
    doc = pymupdf.open(exam.question_pdf)
    # 表紙・表記ルール・メモ用紙には問番号がない。ページは正立で描く。
    pages: list[tuple[pymupdf.Pixmap, list[int], int]] = []
    for page, ys in zip(doc, find_headers(doc)):
        if not ys:
            continue
        pix = page.get_pixmap(
            matrix=pymupdf.Matrix(RENDER_SCALE, RENDER_SCALE),
            colorspace=pymupdf.csGRAY,
            alpha=False,
        )
        tops = [max(0, round(y * RENDER_SCALE)) for y in ys]
        pages.append((pix, tops, footer_top(pix.samples, pix.width, pix.height)))
    doc.close()
    total = sum(len(tops) for _, tops, _ in pages)
    if total != QUESTION_COUNT:
        raise SystemExit(f"{exam.id}: 問の先頭が {total} 個でした。{QUESTION_COUNT} 個である必要があります。")

    exam.image_dir.mkdir(parents=True, exist_ok=True)
    number = 1
    for pix, tops, footer in pages:
        samples = pix.samples
        width = pix.width
        limits = tops + [footer]
        for index, top in enumerate(tops):
            bottom_limit = limits[index + 1]
            bounds = content_bounds(samples, width, top, bottom_limit)
            if bounds is None:
                raise SystemExit(f"{exam.id}: 問{number} の領域が空です。")
            x0, y0, x1, y1 = bounds
            if ink_rows_below(samples, width, y1, bottom_limit) > 3:
                print(f"警告 {exam.id} 問{number}: 切り出しより下にも内容があります。画像を確認してください。")
            x0 = max(0, x0 - PAD_X)
            y0 = max(0, y0 - PAD_Y)
            x1 = min(width, x1 + PAD_X)
            y1 = min(bottom_limit, y1 + PAD_Y)
            if index + 1 < len(tops):
                y1 = min(y1, tops[index + 1] - 8)
            crop = bytearray()
            for y in range(y0, y1):
                crop += samples[y * width + x0 : y * width + x1]
            if number in exam.excluded:
                number += 1
                continue
            image = Image.frombytes("L", (x1 - x0, y1 - y0), bytes(crop))
            path = exam.image_dir / f"q{number:02d}.webp"
            image.save(path, "WEBP", lossless=True, method=6)
            number += 1
    return total


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("ids", nargs="*", help="回の id。省略時は全回")
    args = parser.parse_args()
    for exam in select(args.ids):
        if not exam.question_pdf.is_file():
            raise SystemExit(f"問題冊子がありません: {exam.question_pdf}")
        count = cut_exam(exam)
        print(f"{exam.id}: {count} 問を切り出しました")


if __name__ == "__main__":
    main()
