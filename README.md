# 動画文字起こし & 記事生成 Chrome拡張機能

YouTube、Vimeo、ローカル動画を文字起こしして、AIで記事を自動生成するChrome拡張機能です。

## 主な機能

### 対応動画ソース
- **YouTube** - URLまたは現在のタブから自動取得
- **Vimeo** - URLから取得（有料機能）
- **ローカルファイル** - MP4, MP3, WAV, M4A, WebM対応（有料機能）
- **Google Drive** - 共有リンクから取得（有料機能）
- **テキスト入力** - 既存の文字起こしテキストから記事生成

### 対応AI
- **OpenAI** (GPT-4, GPT-4o-mini等)
- **Claude** (Claude 3 Opus, Sonnet, Haiku)
- **Gemini** (Gemini Pro, Flash)

### 記事生成タイプ
1. **ブログ記事** - SEO対策済みの構造化された記事
2. **会話形式** - インタビュー・対談形式の読みやすい記事
3. **要約** - 重要ポイントをまとめた簡潔な要約
4. **チュートリアル** - ステップバイステップの解説記事
5. **カスタム** - 自由なプロンプトで記事生成

## 使い方

1. 拡張機能アイコンをクリック
2. 動画ソースを選択（YouTube, Vimeo等）
3. URLを入力（YouTubeの場合は自動取得）
4. 使用するAIを選択
5. 「全形式で記事を生成」ボタンをクリック
6. 生成された記事をコピーまたはダウンロード

## 設定

設定ページでAPIキーを登録：
- OpenAI API Key
- Anthropic API Key (Claude用)
- Google AI Studio API Key (Gemini用)

## ファイル構成

```
video-transcriber-extension/
├── manifest.json      # 拡張機能マニフェスト
├── popup.html         # メインUI
├── options.html       # 設定ページ
├── css/
│   └── style.css      # スタイル
├── js/
│   ├── popup.js       # メインロジック
│   ├── background.js  # Service Worker
│   ├── content.js     # YouTube用コンテンツスクリプト
│   ├── content-vimeo.js # Vimeo用コンテンツスクリプト
│   ├── youtube.js     # YouTube API
│   ├── vimeo.js       # Vimeo API
│   ├── whisper.js     # OpenAI Whisper文字起こし
│   ├── ai-providers.js # AI API連携
│   ├── options.js     # 設定ページロジック
│   └── utils.js       # ユーティリティ
├── icons/             # アイコン
└── _locales/          # 多言語対応
```

## プライバシー

- APIキーはブラウザのローカルストレージに保存
- 動画データは処理のためのみ使用し、保存しません
- 外部サーバーへの送信はAI API呼び出しのみ

## バージョン

- **v1.0.0** (2025年12月)
  - 初回リリース
  - YouTube/Vimeo対応
  - OpenAI, Claude, Gemini対応
  - 4種類の記事形式対応

## ライセンス

個人利用・商用利用ともに自由に使用できます。

---

**開発者**: naokijodan
