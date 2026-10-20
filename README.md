# プロジェクトマネージャ 午前Ⅱ 演習

IPA が公開しているプロジェクトマネージャ試験の午前Ⅱを、1問ずつ解く静的サイトです。公開先は <https://rabut001.github.io/project-manager-training-6/> です。

平成21年度春期から令和7年度秋期まで 17回（各回25問。平成28年度春期は問2が出題の誤りで成立しないため24問）を収録します。問題は切り出した画像で表示し、ア〜エを選んで結果を確認します。解説は AI が学習用に書いたもので、IPA の公式解説ではなく、誤りを含む可能性があります。進捗はブラウザの `localStorage` に残し、アカウントや端末間の同期はしません。

仕様は [AGENTS.md](AGENTS.md) に書いてあります。アプリの修正は [specs/](specs/README.md) の手順で進めます。

## フォルダ

| パス | 内容 |
| --- | --- |
| `sources/` | 午前Ⅱの問題冊子・解答例の PDF と `manifest.json`（URL・sha256） |
| `scripts/` | PDF の取得、問題画像の切り出し、正解の抽出、データの検証（Python） |
| `content/` | 回ごとの JSON、問題画像、一覧 `exams.json`。サイトが読む元データ |
| `app/` | 演習サイト（Vite + React + TypeScript） |
| `.devcontainer/` | 開発コンテナ（Node.js 24、uv、tesseract、GitHub CLI） |
| `.github/workflows/` | 検証と GitHub Pages への公開 |
| `specs/` | アプリを修正するときの管理資料 |
| `chat-exports/` | 開発時のチャットのログ（資産ではなく、仕様の参照先でもない） |

## 開発

開発は `.devcontainer/` の開発コンテナで行います。VS Code では「Reopen in Container」で開きます。初回は `npm ci` と `uv sync` が自動で走ります。ホストに Node.js や Python は要りません。

```sh
npm run dev --prefix app
```

開発サーバは <http://localhost:5173/project-manager-training-6/> です。

| 作業 | コマンド |
| --- | --- |
| 型の検査 | `npm run typecheck --prefix app` |
| 単体テスト | `npm test --prefix app` |
| ビルド（成果物は `app/dist`） | `npm run build --prefix app` |
| データの検証 | `uv run scripts/validate_content.py --complete` |

`main` への push で `app/`、`content/`、または公開用ワークフローが変わったとき、GitHub Actions が検証して GitHub Pages へ載せます。プルリクエストでは検証とビルドだけを行います。

## データの作り方

IPA の PDF から、問題画像と正解を作ります。解説と問題文のテキストは `content/<id>.json` に書きます（手順と観点は [specs/0001-initial-content](specs/0001-initial-content/README.md)）。

```sh
uv run scripts/fetch_sources.py            # PDF を sources/ に取得し manifest.json に記録する
uv run scripts/cut_questions.py            # 問題画像を content/<id>/qNN.webp に切り出す
uv run scripts/extract_answers.py          # 解答例から正解を取り content/<id>.json に反映する
uv run scripts/validate_content.py         # 検証する（--complete で問題文・解説も必須にする）
uv run scripts/build_index.py              # 一覧 content/exams.json を作る
```

各スクリプトは回の `id` を引数に取れます（省略時は全回）。回の定義は `scripts/exams.py` にあります。

## 出典

独立行政法人情報処理推進機構（IPA）が公開しているプロジェクトマネージャ試験の午前Ⅱの問題冊子と解答例を使っています。取得日は `sources/manifest.json` に記録しています。

出典: [過去問題 | IPA](https://www.ipa.go.jp/shiken/mondai-kaiotu/index.html)

IPA は、公表している過去の試験問題について、法令に特別の定めがある場合を除き許諾や使用料は不要であり、ダウンロードでの利用も問題ないとしています。著作権は放棄されていません。出典の明記など、使用時の留意点は [試験制度に関するよくある質問](https://www.ipa.go.jp/shiken/faq.html) の「その他」を確認してください。

令和2年度は10月に実施された試験です。令和8年度の過去問題は、取得時点では未掲載でした。
