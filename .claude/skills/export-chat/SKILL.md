---
name: export-chat
description: >-
  このリポジトリのチャットを chat-exports へ Markdown で書き出す。ユーザーがチャットのエクスポート、
  会話ログの出力、chat-exports への保存を頼んだときに使う。
---

# チャットの書き出し

会話本文の変換はスクリプトで行う。手で Markdown を組み立てない。

## 手順

1. このセッションのトランスクリプト（jsonl）を探す。場所は `~/.claude/projects/<作業ディレクトリのパスの `/` を `-` に変えた名前>/<セッションID>.jsonl`。会話が `/clear` や再開で複数のファイルに分かれているときは、同じ会話のものをすべて渡す。
2. リポジトリ直下で実行する。

```bash
python3 .claude/skills/export-chat/scripts/export_chat.py --transcript "<jsonl>" [--transcript "<jsonl>" ...]
```

3. 標準出力に出たパスを、書き出したファイルとしてユーザーに伝える。
4. 頼まれない限りコミットしない。

`chat-exports/` はログであり、アプリの資産ではない。実装や仕様の根拠にしない。仕様は `AGENTS.md` を参照する。

## 出力

最初のユーザー発言の時刻（日本時間）のフォルダに書く。同名フォルダがあれば `chat.md` を置き換える。

```text
chat-exports/YYYY-MM-DD-HHMM/chat.md
```

ユーザーとアシスタントの本文だけを書く。ツール呼び出し、ツールの結果、思考、system-reminder、サブエージェントの報告や通知、中断の印、二重に記録された同じ発言は含めない。トークンなどの秘密らしき文字列が本文に残っていたら、書き出しを中止する。
