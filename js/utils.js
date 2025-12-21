// Utility Functions

// Premium code hash (SHA-256 of "MGOOSE2025")
const PREMIUM_CODE_HASH = '7b45ab691a0f9478bba6ccab58a1a63188e89174c1864582a97b6c2d4b616703';

// Hash function using Web Crypto API
async function hashCode(code) {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Verify premium code
async function verifyPremiumCode(code) {
  const hash = await hashCode(code);
  return hash === PREMIUM_CODE_HASH;
}

// Check if user has premium access
async function isPremiumUser() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['isPremium'], (result) => {
      resolve(result.isPremium === true);
    });
  });
}

// Set premium status
async function setPremiumStatus(status) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ isPremium: status }, resolve);
  });
}

// Get API keys
async function getApiKeys() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['openaiKey', 'claudeKey', 'geminiKey'], (result) => {
      resolve({
        openai: result.openaiKey || '',
        claude: result.claudeKey || '',
        gemini: result.geminiKey || ''
      });
    });
  });
}

// Save API keys
async function saveApiKeys(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.set({
      openaiKey: keys.openai || '',
      claudeKey: keys.claude || '',
      geminiKey: keys.gemini || ''
    }, resolve);
  });
}

// Get settings
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['defaultProvider', 'defaultTemplate', 'defaultCustomPrompt'], (result) => {
      resolve({
        defaultProvider: result.defaultProvider || 'openai',
        defaultTemplate: result.defaultTemplate || 'blog',
        defaultCustomPrompt: result.defaultCustomPrompt || ''
      });
    });
  });
}

// Save settings
async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.local.set(settings, resolve);
  });
}

// Show toast notification
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast ' + type;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Extract YouTube video ID from URL
function extractYouTubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Extract Vimeo video ID from URL
function extractVimeoId(url) {
  const patterns = [
    /vimeo\.com\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Extract Google Drive file ID from URL
function extractDriveId(url) {
  const patterns = [
    /drive\.google\.com\/file\/d\/([^\/]+)/,
    /drive\.google\.com\/open\?id=([^&]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Get prompt template
function getPromptTemplate(templateId, customPrompt = '') {
  const templates = {
    blog: `以下の文字起こしを元に、読みやすいブログ記事を作成してください。

要件：
- 魅力的なタイトルを付ける
- 導入、本文、まとめの構成にする
- 重要なポイントは箇条書きにする
- HTMLタグを使用して整形する（h1, h2, p, ul, li など）
- 日本語で出力する

文字起こし：
`,
    conversation: `あなたは優秀な編集者です。以下の文字起こしを「会話形式の記事」に書き換えてください。

【重要な指示】
- 文字起こしをそのまま出力するのではなく、必ず会話形式に「再構成」してください
- 内容を理解した上で、読みやすい対話形式に編集してください

【記事の形式】
1. まず魅力的なタイトル（h1）を付ける
2. 簡単な導入文を書く
3. 本文は以下のような会話形式で書く：

<div class="conversation">
  <p class="speaker-a"><strong>インタビュアー：</strong>〇〇について教えていただけますか？</p>
  <p class="speaker-b"><strong>解説者：</strong>はい、〇〇というのは△△のことです。具体的には...</p>
</div>

【話者の設定】
- 2人以上の会話が識別できる場合：それぞれの話者名を使う
- 1人の講義/解説の場合：「インタビュアー」と「解説者」の対話形式に再構成する
- インタビュアーは要点を質問し、解説者が答える形にする

【必須ルール】
- 元の情報は保持しつつ、会話として自然に読めるよう編集する
- 長い説明は適度に区切り、質問を挟む
- 重要なポイントは強調（<strong>）する
- 文字起こしのコピペは禁止。必ず会話形式に変換すること

文字起こし：
`,
    summary: `以下の文字起こしを簡潔に要約してください。

要件：
- 主要なポイントを3-5個に絞る
- 各ポイントは2-3文で説明
- HTMLタグを使用して整形する（h1, h2, p, ul, li など）
- 日本語で出力する

文字起こし：
`,
    tutorial: `以下の文字起こしを元に、ステップバイステップのチュートリアル記事を作成してください。

要件：
- わかりやすい手順を番号付きで示す
- 各ステップに詳しい説明を加える
- 必要に応じて注意点やTipsを追加
- HTMLタグを使用して整形する（h1, h2, p, ol, li など）
- 日本語で出力する

文字起こし：
`,
    custom: customPrompt + '\n\n文字起こし：\n'
  };

  return templates[templateId] || templates.blog;
}

// Format transcript for display
function formatTranscript(transcript) {
  if (!transcript) return '';
  return transcript.replace(/\n/g, '<br>');
}

// Generate HTML article
function wrapInHtmlDocument(content, title = '生成された記事') {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.8;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #333;
    }
    h1 { font-size: 2em; margin-bottom: 0.5em; color: #1a1a1a; }
    h2 { font-size: 1.5em; margin-top: 1.5em; color: #2a2a2a; }
    h3 { font-size: 1.2em; margin-top: 1.2em; color: #3a3a3a; }
    p { margin: 1em 0; }
    ul, ol { margin: 1em 0; padding-left: 2em; }
    li { margin: 0.5em 0; }
    blockquote {
      border-left: 4px solid #ddd;
      padding-left: 1em;
      margin: 1em 0;
      color: #666;
    }
    code {
      background: #f5f5f5;
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-size: 0.9em;
    }
    pre {
      background: #f5f5f5;
      padding: 1em;
      border-radius: 5px;
      overflow-x: auto;
    }
    /* 会話形式用スタイル */
    .conversation {
      background: #f9f9f9;
      border-radius: 8px;
      padding: 1em;
      margin: 1em 0;
    }
    .conversation p {
      margin: 0.8em 0;
      padding: 0.8em 1em;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .conversation p strong {
      color: #4F46E5;
    }
    .speaker-a { border-left: 3px solid #4F46E5; }
    .speaker-b { border-left: 3px solid #10B981; }
  </style>
</head>
<body>
${content}
</body>
</html>`;
}

// Download file
function downloadFile(content, filename, type = 'text/html') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Copy to clipboard
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
}
