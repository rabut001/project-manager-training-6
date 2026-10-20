FROM mcr.microsoft.com/devcontainers/javascript-node:24-bookworm

# 問題冊子の切り出しで、問番号の位置を OCR で探す。
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-jpn \
    && rm -rf /var/lib/apt/lists/*

# 公開（リポジトリ作成、push、Pages の設定）に GitHub CLI を使う。認証は利用者が `gh auth login` で行う。
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# Python は uv が pyproject.toml の requires-python に合わせて用意する。
COPY --from=ghcr.io/astral-sh/uv:0.13.3 /uv /uvx /usr/local/bin/
