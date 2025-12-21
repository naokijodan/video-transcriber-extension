// Main popup script

let currentTab = 'youtube';
let selectedProvider = 'openai';
let selectedFile = null;
let isPremium = false;
let currentTranscript = '';

// Store generated articles for each type
let generatedArticles = {
  blog: null,
  conversation: null,
  summary: null,
  tutorial: null,
  custom: null
};

let currentArticleType = 'blog';

document.addEventListener('DOMContentLoaded', async () => {
  // Load premium status
  isPremium = await isPremiumUser();
  updateUIForPremiumStatus();

  // Load saved settings
  await loadSettings();

  // Get current tab URL
  await getCurrentTabUrl();

  // Setup event listeners
  setupEventListeners();
});

async function loadSettings() {
  const settings = await getSettings();
  selectedProvider = settings.defaultProvider;

  // Update UI
  document.querySelectorAll('.ai-provider-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.provider === selectedProvider);
  });

  if (settings.defaultCustomPrompt) {
    document.getElementById('customPrompt').value = settings.defaultCustomPrompt;
  }
}

async function getCurrentTabUrl() {
  try {
    // First check URL parameters (when opened as independent window)
    const urlParams = new URLSearchParams(window.location.search);
    let url = urlParams.get('sourceUrl') || '';

    // If no URL param, try to get from active tab
    if (!url) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      url = tab?.url || '';
    }

    // Check if YouTube
    if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
      document.getElementById('youtubeUrl').value = url;
    }

    // Check if Vimeo
    if (url.includes('vimeo.com/')) {
      document.getElementById('vimeoUrl').value = url;
    }
  } catch (error) {
    console.error('Error getting current tab:', error);
  }
}

function updateUIForPremiumStatus() {
  const statusBadge = document.getElementById('statusBadge');

  if (isPremium) {
    statusBadge.textContent = 'プレミアム';
    statusBadge.className = 'status-badge premium';

    // Remove lock icons
    document.getElementById('vimeoLock').style.display = 'none';
    document.getElementById('localLock').style.display = 'none';
    document.getElementById('driveLock').style.display = 'none';

    // Enable all tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.disabled = false;
    });
  } else {
    statusBadge.textContent = '無料版';
    statusBadge.className = 'status-badge free';

    // Show lock icons
    document.getElementById('vimeoLock').style.display = 'inline';
    document.getElementById('localLock').style.display = 'inline';
    document.getElementById('driveLock').style.display = 'inline';
  }
}

function setupEventListeners() {
  // Settings button
  document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Tab switching (source tabs)
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;

      // Check premium for restricted tabs
      if (!isPremium && ['vimeo', 'local', 'drive'].includes(tabId)) {
        showToast('この機能はプレミアム会員限定です', 'error');
        return;
      }

      // Switch tab
      currentTab = tabId;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });

  // AI provider selection
  document.querySelectorAll('.ai-provider-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedProvider = btn.dataset.provider;
      document.querySelectorAll('.ai-provider-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Toggle custom prompt area
  document.getElementById('customPromptGroup').style.display = 'none';

  // Add button to show custom prompt
  const aiSection = document.querySelector('.ai-provider-select').parentElement;
  const toggleCustomBtn = document.createElement('button');
  toggleCustomBtn.className = 'btn btn-secondary';
  toggleCustomBtn.style.marginTop = '8px';
  toggleCustomBtn.style.fontSize = '12px';
  toggleCustomBtn.textContent = '+ カスタムプロンプトを追加';
  toggleCustomBtn.addEventListener('click', () => {
    const customGroup = document.getElementById('customPromptGroup');
    if (customGroup.style.display === 'none') {
      customGroup.style.display = 'block';
      toggleCustomBtn.textContent = '- カスタムプロンプトを隠す';
    } else {
      customGroup.style.display = 'none';
      toggleCustomBtn.textContent = '+ カスタムプロンプトを追加';
    }
  });
  aiSection.appendChild(toggleCustomBtn);

  // File drop zone
  const dropZone = document.getElementById('fileDropZone');
  const fileInput = document.getElementById('fileInput');

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    handleFileSelect(file);
  });

  // Generate button - generates ALL article types
  document.getElementById('generateBtn').addEventListener('click', generateAllArticles);

  // Generate custom article button
  document.getElementById('generateCustomBtn').addEventListener('click', generateCustomArticle);

  // Article type tab switching
  document.querySelectorAll('.article-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const type = tab.dataset.type;
      switchArticleView(type);
    });
  });

  // Copy HTML button
  document.getElementById('copyHtmlBtn').addEventListener('click', async () => {
    const html = generatedArticles[currentArticleType];
    if (html) {
      const success = await copyToClipboard(html);
      showToast(success ? 'HTMLをコピーしました' : 'コピーに失敗しました', success ? 'success' : 'error');
    }
  });

  // Download button
  document.getElementById('downloadBtn').addEventListener('click', () => {
    const html = generatedArticles[currentArticleType];
    if (html) {
      const fullHtml = wrapInHtmlDocument(html);
      const timestamp = new Date().toISOString().slice(0, 10);
      downloadFile(fullHtml, `article-${currentArticleType}-${timestamp}.html`);
      showToast('ダウンロードを開始しました', 'success');
    }
  });

  // Copy transcript button
  document.getElementById('copyTranscriptBtn').addEventListener('click', async () => {
    if (currentTranscript) {
      const success = await copyToClipboard(currentTranscript);
      showToast(success ? '文字起こしをコピーしました' : 'コピーに失敗しました', success ? 'success' : 'error');
    }
  });

  // Toggle transcript visibility
  document.getElementById('toggleTranscriptBtn').addEventListener('click', () => {
    const preview = document.getElementById('transcriptPreview');
    const btn = document.getElementById('toggleTranscriptBtn');
    if (preview.style.maxHeight === 'none') {
      preview.style.maxHeight = '200px';
      btn.textContent = '展開する';
    } else {
      preview.style.maxHeight = 'none';
      btn.textContent = '折りたたむ';
    }
  });
}

function handleFileSelect(file) {
  if (!file) return;

  if (!whisperTranscriber.isSupported(file)) {
    showToast('サポートされていないファイル形式です', 'error');
    return;
  }

  selectedFile = file;
  document.getElementById('selectedFile').textContent = `選択: ${file.name} (${Math.round(file.size / 1024 / 1024 * 10) / 10}MB)`;
}

function switchArticleView(type) {
  currentArticleType = type;

  // Update tab active state
  document.querySelectorAll('.article-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.type === type);
  });

  // Update preview content
  const preview = document.getElementById('resultPreview');
  const html = generatedArticles[type];

  if (html) {
    preview.innerHTML = html;
  } else {
    preview.innerHTML = '<p style="color: #999; text-align: center;">生成中...</p>';
  }
}

function updateTabStatus(type, status) {
  const tab = document.querySelector(`.article-tab[data-type="${type}"]`);
  const statusEl = document.getElementById(`status-${type}`);

  if (!tab || !statusEl) return;

  // Remove all status classes
  tab.classList.remove('completed', 'generating', 'error');

  switch (status) {
    case 'generating':
      tab.classList.add('generating');
      statusEl.textContent = '⏳';
      break;
    case 'completed':
      tab.classList.add('completed');
      statusEl.textContent = '✅';
      break;
    case 'error':
      tab.classList.add('error');
      statusEl.textContent = '❌';
      break;
    default:
      statusEl.textContent = '⏳';
  }
}

async function generateAllArticles() {
  const generateBtn = document.getElementById('generateBtn');
  const progressSection = document.getElementById('progressSection');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const resultSection = document.getElementById('resultSection');
  const transcriptSection = document.getElementById('transcriptSection');

  // Get API keys
  const keys = await getApiKeys();

  // Check if required API key exists
  if (!keys[selectedProvider]) {
    showToast(`${selectedProvider}のAPIキーを設定してください`, 'error');
    chrome.runtime.openOptionsPage();
    return;
  }

  // For Whisper transcription, need OpenAI key (not needed for youtube or text input)
  if (!['youtube', 'text'].includes(currentTab) && !keys.openai) {
    showToast('文字起こしにはOpenAI APIキーが必要です', 'error');
    chrome.runtime.openOptionsPage();
    return;
  }

  // Reset state
  generatedArticles = { blog: null, conversation: null, summary: null, tutorial: null, custom: null };
  ['blog', 'conversation', 'summary', 'tutorial'].forEach(type => updateTabStatus(type, 'pending'));

  // Disable button and show progress
  generateBtn.disabled = true;
  progressSection.classList.add('active');
  resultSection.classList.remove('active');
  transcriptSection.classList.remove('active');

  const updateProgress = (percent, text) => {
    progressFill.style.width = `${percent}%`;
    progressText.textContent = text;
  };

  try {
    // Step 1: Get transcript
    updateProgress(5, '文字起こしを取得中...');

    switch (currentTab) {
      case 'youtube':
        currentTranscript = await getYouTubeTranscript(updateProgress);
        break;
      case 'vimeo':
        currentTranscript = await getVimeoTranscript(updateProgress, keys.openai);
        break;
      case 'local':
        currentTranscript = await getLocalFileTranscript(updateProgress, keys.openai);
        break;
      case 'drive':
        currentTranscript = await getDriveTranscript(updateProgress, keys.openai);
        break;
      case 'text':
        currentTranscript = await getTextInput(updateProgress);
        break;
    }

    if (!currentTranscript) {
      throw new Error('文字起こしを取得できませんでした');
    }

    // Show transcript
    transcriptSection.classList.add('active');
    document.getElementById('transcriptPreview').innerHTML = formatTranscript(currentTranscript);

    // Show result section and set first tab active
    resultSection.classList.add('active');
    switchArticleView('blog');

    updateProgress(30, '記事を生成中...');

    // Step 2: Generate all article types in parallel
    const articleTypes = ['blog', 'conversation', 'summary', 'tutorial'];

    // Start all generations
    articleTypes.forEach(type => updateTabStatus(type, 'generating'));

    const generatePromises = articleTypes.map(async (type) => {
      try {
        const prompt = getPromptTemplate(type);
        const html = await aiProviders.generateArticle(
          selectedProvider,
          keys[selectedProvider],
          prompt,
          currentTranscript,
          null // No individual progress for parallel
        );
        generatedArticles[type] = html;
        updateTabStatus(type, 'completed');

        // If this is the currently viewed type, update preview
        if (currentArticleType === type) {
          document.getElementById('resultPreview').innerHTML = html;
        }

        return { type, success: true };
      } catch (error) {
        console.error(`Error generating ${type}:`, error);
        updateTabStatus(type, 'error');
        generatedArticles[type] = `<p style="color: #f44336;">生成エラー: ${error.message}</p>`;
        return { type, success: false, error };
      }
    });

    // Wait for all to complete
    await Promise.all(generatePromises);

    updateProgress(100, '完了！');
    showToast('全ての記事を生成しました！', 'success');

  } catch (error) {
    console.error('Generation error:', error);
    showToast(error.message || 'エラーが発生しました', 'error');
    updateProgress(0, 'エラーが発生しました');
  } finally {
    generateBtn.disabled = false;
  }
}

async function generateCustomArticle() {
  const customPrompt = document.getElementById('customPrompt').value.trim();
  if (!customPrompt) {
    showToast('カスタムプロンプトを入力してください', 'error');
    return;
  }

  if (!currentTranscript) {
    showToast('先に「全形式で記事を生成」を実行してください', 'error');
    return;
  }

  const keys = await getApiKeys();
  if (!keys[selectedProvider]) {
    showToast(`${selectedProvider}のAPIキーを設定してください`, 'error');
    return;
  }

  // Show custom tab
  document.getElementById('customTab').style.display = 'flex';
  updateTabStatus('custom', 'generating');
  switchArticleView('custom');

  try {
    const prompt = getPromptTemplate('custom', customPrompt);
    const html = await aiProviders.generateArticle(
      selectedProvider,
      keys[selectedProvider],
      prompt,
      currentTranscript,
      null
    );

    generatedArticles.custom = html;
    updateTabStatus('custom', 'completed');
    document.getElementById('resultPreview').innerHTML = html;
    showToast('カスタム記事を生成しました！', 'success');

  } catch (error) {
    console.error('Custom generation error:', error);
    updateTabStatus('custom', 'error');
    generatedArticles.custom = `<p style="color: #f44336;">生成エラー: ${error.message}</p>`;
    showToast(error.message || 'エラーが発生しました', 'error');
  }
}

async function getYouTubeTranscript(updateProgress) {
  updateProgress(10, 'YouTube字幕を取得中...');

  const url = document.getElementById('youtubeUrl').value.trim();
  if (!url) {
    throw new Error('YouTube URLを入力してください');
  }

  const videoId = extractYouTubeId(url);
  if (!videoId) {
    throw new Error('有効なYouTube URLを入力してください');
  }

  updateProgress(20, '字幕データを解析中...');

  const transcript = await youtubeTranscript.getTranscript(videoId);

  updateProgress(30, '字幕を取得しました');

  return transcript;
}

async function getVimeoTranscript(updateProgress, openaiKey) {
  updateProgress(10, 'Vimeo動画を確認中...');

  const url = document.getElementById('vimeoUrl').value.trim();
  if (!url) {
    throw new Error('Vimeo URLを入力してください');
  }

  const videoId = extractVimeoId(url);
  if (!videoId) {
    throw new Error('有効なVimeo URLを入力してください');
  }

  const result = await vimeoTranscript.getTranscript(videoId);

  // Vimeo requires file upload due to CORS restrictions
  if (result.requiresUpload) {
    throw new Error(result.message);
  }

  if (result.hasCaption) {
    updateProgress(30, '字幕を取得しました');
    return result.transcript;
  }

  throw new Error('Vimeoから直接文字起こしできません。「ファイル」タブから動画をアップロードしてください。');
}

async function getLocalFileTranscript(updateProgress, openaiKey) {
  if (!selectedFile) {
    throw new Error('ファイルを選択してください');
  }

  updateProgress(10, 'ファイルを処理中...');

  const transcript = await whisperTranscriber.transcribe(selectedFile, openaiKey, updateProgress);

  return transcript;
}

async function getDriveTranscript(updateProgress, openaiKey) {
  updateProgress(10, 'Google Driveファイルを確認中...');

  const url = document.getElementById('driveUrl').value.trim();
  if (!url) {
    throw new Error('Google Drive URLを入力してください');
  }

  const fileId = extractDriveId(url);
  if (!fileId) {
    throw new Error('有効なGoogle Drive URLを入力してください');
  }

  // Create direct download URL
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

  updateProgress(20, 'ファイルをダウンロード中...');

  const transcript = await whisperTranscriber.transcribeFromUrl(downloadUrl, openaiKey, updateProgress);

  return transcript;
}

async function getTextInput(updateProgress) {
  updateProgress(10, 'テキストを読み込み中...');

  const text = document.getElementById('transcriptInput').value.trim();
  if (!text) {
    throw new Error('テキストを入力してください');
  }

  if (text.length < 50) {
    throw new Error('テキストが短すぎます。50文字以上入力してください。');
  }

  updateProgress(30, 'テキストを取得しました');

  return text;
}
