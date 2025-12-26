# Chrome Web Store 公開手順ガイド

## 事前準備チェックリスト

### 完了済み
- [x] Manifest V3対応
- [x] プライバシーポリシー作成 (`PRIVACY_POLICY.md`)
- [x] ストア用説明文作成 (`STORE_LISTING.md`)
- [x] アイコン準備（16x16, 48x48, 128x128）
- [x] 多言語対応（日本語・英語）

### あなたが準備するもの
- [ ] Chrome Web Store開発者アカウント（$5 登録料）
- [ ] スクリーンショット（1〜5枚、1280x800 または 640x400）
- [ ] プライバシーポリシーの公開URL
- [ ] プロモーション画像（440x280、任意）

---

## Step 1: 開発者アカウントの作成

1. https://chrome.google.com/webstore/devconsole にアクセス
2. Googleアカウントでログイン
3. 開発者として登録（$5 一回のみ）
4. 開発者情報を入力

---

## Step 2: プライバシーポリシーの公開

プライバシーポリシーは公開URLが必要です。以下のいずれかの方法で公開：

### オプション A: GitHubで公開（推奨）
```
https://github.com/naokijodan/video-transcriber-extension/blob/main/PRIVACY_POLICY.md
```

### オプション B: GitHub Pagesで公開
1. リポジトリのSettingsでGitHub Pagesを有効化
2. PRIVACY_POLICY.mdをHTMLに変換、または
3. 直接HTMLファイルを作成

### オプション C: 他のホスティングサービス
- Notion (公開ページ)
- Google Sites
- 自分のウェブサイト

---

## Step 3: スクリーンショットの準備

### 必要なスクリーンショット（最低1枚）

1. **メイン画面**
   - ポップアップを開いた状態
   - YouTube URLが入力されている状態

2. **AI選択画面**
   - OpenAI/Claude/Geminiの選択ボタン

3. **生成結果画面**
   - 記事が生成された状態
   - 複数のタブ（ブログ/会話/要約/チュートリアル）

4. **設定画面**
   - APIキー入力フィールド

### スクリーンショット撮影方法

```bash
# Chromeで拡張機能を開発モードでロード
1. chrome://extensions を開く
2. 「デベロッパーモード」を有効化
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. video-transcriber-extension フォルダを選択

# スクリーンショット撮影
- macOS: Cmd + Shift + 4 でエリア選択
- Windows: Win + Shift + S
```

---

## Step 4: ZIPファイルの作成

```bash
cd /Users/naokijodan/Desktop

# 不要ファイルを除外してZIP作成
zip -r video-transcriber-extension.zip video-transcriber-extension \
  -x "*.git*" \
  -x "*.DS_Store" \
  -x "*PUBLISH_GUIDE.md" \
  -x "*STORE_LISTING.md"
```

含めるファイル:
- manifest.json
- popup.html
- options.html
- css/
- js/
- icons/
- _locales/
- PRIVACY_POLICY.md

---

## Step 5: ストアへのアップロード

1. https://chrome.google.com/webstore/devconsole を開く

2. 「新しいアイテム」をクリック

3. ZIPファイルをアップロード

4. ストア掲載情報を入力:
   - **言語**: 日本語（メイン）、英語（追加）
   - **説明文**: `STORE_LISTING.md` からコピー
   - **カテゴリ**: 仕事効率化（Productivity）
   - **スクリーンショット**: アップロード

5. プライバシープラクティスを入力:
   - **シングルパーパス**: 動画を文字起こしして記事を生成する
   - **権限の正当性**:
     - `activeTab`: 現在のページのURLを取得するため
     - `storage`: APIキーと設定を保存するため
     - `tabs`: 動画ページを検出するため
     - `scripting`: 字幕を抽出するため
   - **リモートコード**: 使用していない
   - **データ使用**: ユーザーが選択したAI APIにのみ送信

6. プライバシーポリシーURLを入力

7. 「審査のため送信」をクリック

---

## Step 6: 審査待ち

- 通常: 1〜3営業日
- 初回や権限が多い場合: 最大1〜2週間

### 審査で見られるポイント
- プライバシーポリシーの完全性
- 権限の必要性と説明
- 機能説明の正確性
- セキュリティ問題がないか

### よくあるリジェクト理由と対策

| 理由 | 対策 |
|------|------|
| 権限が過剰 | 必要な権限のみに制限（済） |
| プライバシーポリシー不足 | 詳細なポリシーを作成（済） |
| 機能説明が不明確 | 明確な説明文を用意（済） |
| スクリーンショット不足 | 機能がわかる画像を追加 |

---

## Step 7: 公開後

### 公開されたら
- ストアURLを共有
- GitHubのREADMEにバッジを追加

```markdown
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/YOUR_EXTENSION_ID)](https://chrome.google.com/webstore/detail/YOUR_EXTENSION_ID)
```

### アップデート時
1. manifest.jsonのversionを更新
2. 新しいZIPを作成
3. Developer Dashboardでアップロード

---

## トラブルシューティング

### Q: 審査に落ちた
A: 理由を確認し、該当箇所を修正して再提出

### Q: YouTubeへのアクセス権限が問題視された
A: 「YouTube字幕取得のため」と明記し、データは保存しないことを説明

### Q: APIキーの取り扱いが問題視された
A: 「ローカル保存のみ、外部サーバーへの送信なし」と明記

---

## 参考リンク

- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- [Chrome拡張機能公開ガイド](https://developer.chrome.com/docs/webstore/publish/)
- [プログラムポリシー](https://developer.chrome.com/docs/webstore/program-policies/)
