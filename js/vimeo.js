// Vimeo transcript fetching via Content Script (Premium feature)

class VimeoTranscript {
  constructor() {
    // Transcript is fetched via content script running on Vimeo page
  }

  // Get transcript from Vimeo video
  async getTranscript(videoId) {
    try {
      // Try to get transcript via content script
      const transcript = await this.getTranscriptViaContentScript(videoId);
      if (transcript) {
        return {
          hasCaption: true,
          transcript: transcript,
          requiresUpload: false
        };
      }
    } catch (error) {
      console.log('Content script method failed:', error.message);
    }

    // If content script fails, return message to upload file
    return {
      hasCaption: false,
      transcript: null,
      requiresUpload: true,
      message: `Vimeoの字幕を取得できませんでした。\n\n以下の方法で文字起こしできます：\n\n1. 動画をダウンロードして「ファイル」タブからアップロード\n2. 画面録画して音声ファイルを作成\n\n※ Whisper APIで高精度な文字起こしを行います`
    };
  }

  // Get transcript via content script running on Vimeo page
  async getTranscriptViaContentScript(videoId) {
    return new Promise(async (resolve, reject) => {
      try {
        // Find Vimeo tab
        const tabs = await chrome.tabs.query({ url: ['*://vimeo.com/*', '*://player.vimeo.com/*'] });

        if (tabs.length === 0) {
          reject(new Error('Vimeoのタブを開いてください。動画ページを開いた状態で再度お試しください。'));
          return;
        }

        // Find the tab with matching video ID or use the first Vimeo tab
        let targetTab = tabs.find(tab => tab.url && tab.url.includes(videoId));
        if (!targetTab) {
          targetTab = tabs[0];
        }

        console.log('Sending message to Vimeo tab:', targetTab.id, targetTab.url);

        // Send message to content script
        chrome.tabs.sendMessage(
          targetTab.id,
          { action: 'getVimeoTranscript', videoId: videoId },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('Vimeo content script error:', chrome.runtime.lastError.message);
              reject(new Error('Vimeoページとの通信に失敗しました。ページを再読み込みしてから再度お試しください。'));
              return;
            }

            if (!response) {
              reject(new Error('Vimeoページからの応答がありません。ページを再読み込みしてください。'));
              return;
            }

            if (!response.success) {
              reject(new Error(response.error || '字幕の取得に失敗しました'));
              return;
            }

            resolve(response.transcript);
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  // Get video info using oEmbed
  async getVideoInfo(videoId) {
    try {
      const response = await fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}`);
      if (!response.ok) {
        throw new Error('動画情報の取得に失敗しました');
      }
      return await response.json();
    } catch (error) {
      console.error('Vimeo info error:', error);
      throw error;
    }
  }
}

// Export singleton instance
const vimeoTranscript = new VimeoTranscript();
