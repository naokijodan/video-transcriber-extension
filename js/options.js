// Options page script

document.addEventListener('DOMContentLoaded', async () => {
  // Load saved data
  await loadSavedData();

  // Setup event listeners
  setupEventListeners();
});

async function loadSavedData() {
  // Load API keys
  const keys = await getApiKeys();
  document.getElementById('openaiKey').value = keys.openai;
  document.getElementById('claudeKey').value = keys.claude;
  document.getElementById('geminiKey').value = keys.gemini;

  // Load settings
  const settings = await getSettings();
  document.getElementById('defaultProvider').value = settings.defaultProvider;
  document.getElementById('defaultTemplate').value = settings.defaultTemplate;
  document.getElementById('defaultCustomPrompt').value = settings.defaultCustomPrompt;

  // Load premium status
  const isPremium = await isPremiumUser();
  updatePremiumStatusDisplay(isPremium);
}

function setupEventListeners() {
  // Toggle password visibility
  document.querySelectorAll('.toggle-visibility').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
      } else {
        input.type = 'password';
        btn.textContent = '👁';
      }
    });
  });

  // Activate premium code
  document.getElementById('activateBtn').addEventListener('click', async () => {
    const code = document.getElementById('premiumCode').value.trim();
    if (!code) {
      showToast('コードを入力してください', 'error');
      return;
    }

    const isValid = await verifyPremiumCode(code);
    if (isValid) {
      await setPremiumStatus(true);
      updatePremiumStatusDisplay(true);
      showToast('プレミアム機能が有効化されました！', 'success');
      document.getElementById('premiumCode').value = '';
    } else {
      showToast('無効なコードです', 'error');
    }
  });

  // Save API keys
  document.getElementById('saveKeysBtn').addEventListener('click', async () => {
    const keys = {
      openai: document.getElementById('openaiKey').value.trim(),
      claude: document.getElementById('claudeKey').value.trim(),
      gemini: document.getElementById('geminiKey').value.trim()
    };

    await saveApiKeys(keys);
    showToast('APIキーを保存しました', 'success');
  });

  // Save settings
  document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    const settings = {
      defaultProvider: document.getElementById('defaultProvider').value,
      defaultTemplate: document.getElementById('defaultTemplate').value,
      defaultCustomPrompt: document.getElementById('defaultCustomPrompt').value
    };

    await saveSettings(settings);
    showToast('設定を保存しました', 'success');
  });
}

function updatePremiumStatusDisplay(isPremium) {
  const statusDiv = document.getElementById('premiumStatus');
  if (isPremium) {
    statusDiv.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; padding: 12px; background: #e8f5e9; border-radius: 6px; color: #2e7d32;">
        <span style="font-size: 20px;">✅</span>
        <div>
          <strong>プレミアム有効</strong>
          <p style="margin: 0; font-size: 12px; color: #388e3c;">全機能が利用可能です</p>
        </div>
      </div>
    `;
  } else {
    statusDiv.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; padding: 12px; background: #fff3e0; border-radius: 6px; color: #e65100;">
        <span style="font-size: 20px;">🔒</span>
        <div>
          <strong>無料版</strong>
          <p style="margin: 0; font-size: 12px; color: #ff8f00;">YouTube字幕のみ利用可能</p>
        </div>
      </div>
    `;
  }
}
