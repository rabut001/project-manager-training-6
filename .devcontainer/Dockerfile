FROM mcr.microsoft.com/devcontainers/javascript-node:24-bookworm

# 問題冊子の切り出しで、問番号の位置を OCR で探す。
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-jpn \
    && rm -rf /var/lib/apt/lists/*

# Python は uv が pyproject.toml の requires-python に合わせて用意する。
COPY --from=ghcr.io/astral-sh/uv:0.13.3 /uv /uvx /usr/local/bin/
