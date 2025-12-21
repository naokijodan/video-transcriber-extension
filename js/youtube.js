// YouTube transcript fetching via Content Script

class YouTubeTranscript {
  constructor() {
    // Transcript is fetched via content script running on YouTube page
  }

  // Fetch transcript from YouTube video
  async getTranscript(videoId, preferredLang = 'ja') {
    try {
      // Get transcript via content script (runs on YouTube page)
      const transcript = await this.getTranscriptViaContentScript(videoId);
      if (transcript) {
        return transcript;
      }

      throw new Error('この動画には字幕がありません。字幕付きの動画を選択するか、「ファイル」タブから動画をアップロードしてWhisperで文字起こしをしてください。');
    } catch (error) {
      console.error('YouTube transcript error:', error);
      throw error;
    }
  }

  // Get transcript via content script running on YouTube page
  async getTranscriptViaContentScript(videoId) {
    return new Promise(async (resolve, reject) => {
      try {
        // Find YouTube tab
        const tabs = await chrome.tabs.query({ url: ['*://www.youtube.com/*', '*://youtube.com/*'] });

        if (tabs.length === 0) {
          reject(new Error('YouTubeのタブを開いてください。動画ページを開いた状態で再度お試しください。'));
          return;
        }

        // Find the tab with matching video ID or use the first YouTube tab
        let targetTab = tabs.find(tab => tab.url && tab.url.includes(videoId));
        if (!targetTab) {
          targetTab = tabs[0];
        }

        console.log('Sending message to tab:', targetTab.id, targetTab.url);

        // Send message to content script
        chrome.tabs.sendMessage(
          targetTab.id,
          { action: 'getYouTubeTranscript', videoId: videoId },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('Content script error:', chrome.runtime.lastError.message);
              reject(new Error('YouTubeページとの通信に失敗しました。YouTubeページを再読み込みしてから再度お試しください。'));
              return;
            }

            if (!response) {
              reject(new Error('YouTubeページからの応答がありません。ページを再読み込みしてください。'));
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

  // Check if video has captions (simplified version)
  async hasCaptions(videoId) {
    try {
      await this.getTranscript(videoId);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
const youtubeTranscript = new YouTubeTranscript();
