"""収録する回の定義。回の id、表示名、IPA の年度ページ名は、ここだけに持つ。"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "sources"
CONTENT = ROOT / "content"

IPA_BASE = "https://www.ipa.go.jp"
QUESTION_COUNT = 25


@dataclass(frozen=True)
class Exam:
    id: str
    title: str
    ipa_page: str  # https://www.ipa.go.jp/shiken/mondai-kaiotu/<ipa_page>.html

    @property
    def source_dir(self) -> Path:
        return SOURCES / self.id

    @property
    def question_pdf(self) -> Path:
        return self.source_dir / "am2-mondai.pdf"

    @property
    def answer_pdf(self) -> Path:
        return self.source_dir / "am2-kaitou.pdf"

    @property
    def json_path(self) -> Path:
        return CONTENT / f"{self.id}.json"

    @property
    def image_dir(self) -> Path:
        return CONTENT / self.id

    @property
    def excluded(self) -> dict[int, str]:
        """収録しない問と、その理由。"""
        return EXCLUDED.get(self.id, {})

    @property
    def question_nos(self) -> list[int]:
        return [no for no in range(1, QUESTION_COUNT + 1) if no not in self.excluded]


# 新しい順。一覧の並びもこの順になる。
EXAMS: list[Exam] = [
    Exam("2025-r07-aki", "令和7年度秋期", "2025r07"),
    Exam("2024-r06-aki", "令和6年度秋期", "2024r06"),
    Exam("2023-r05-aki", "令和5年度秋期", "2023r05"),
    Exam("2022-r04-aki", "令和4年度秋期", "2022r04"),
    Exam("2021-r03-aki", "令和3年度秋期", "2021r03"),
    Exam("2020-r02-oct", "令和2年度10月", "2020r02"),
    Exam("2019-h31-haru", "平成31年度春期", "2019h31"),
    Exam("2018-h30-haru", "平成30年度春期", "2018h30"),
    Exam("2017-h29-haru", "平成29年度春期", "2017h29"),
    Exam("2016-h28-haru", "平成28年度春期", "2016h28"),
    Exam("2015-h27-haru", "平成27年度春期", "2015h27"),
    Exam("2014-h26-haru", "平成26年度春期", "2014h26"),
    Exam("2013-h25-haru", "平成25年度春期", "2013h25"),
    Exam("2012-h24-haru", "平成24年度春期", "2012h24"),
    Exam("2011-h23-tokubetsu", "平成23年度特別", "2011h23"),
    Exam("2010-h22-haru", "平成22年度春期", "2010h22"),
    Exam("2009-h21-haru", "平成21年度春期", "2009h21"),
]

# IPA が問題として成立しないとした問は、収録しない。画面にも理由を出す。
EXCLUDED: dict[str, dict[int, str]] = {
    "2016-h28-haru": {2: "IPA の解答例に「誤りにより問題として成立しない」とあるため、問2は収録していません。"},
}

EXAMS_BY_ID = {exam.id: exam for exam in EXAMS}


def select(ids: list[str]) -> list[Exam]:
    """コマンドラインの id 指定から回を選ぶ。指定がなければ全回。"""
    if not ids:
        return EXAMS
    unknown = [item for item in ids if item not in EXAMS_BY_ID]
    if unknown:
        raise SystemExit(f"未定義の回です: {', '.join(unknown)}")
    return [EXAMS_BY_ID[item] for item in ids]
