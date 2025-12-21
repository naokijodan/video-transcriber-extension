// Content script - runs on Vimeo pages to extract transcript

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getVimeoTranscript') {
    getTranscriptFromPage(request.videoId)
      .then(transcript => sendResponse({ success: true, transcript }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async
  }

  if (request.action === 'checkVimeoPage') {
    const videoId = getVideoIdFromUrl(window.location.href);
    sendResponse({
      isVimeo: true,
      videoId: videoId,
      url: window.location.href
    });
    return true;
  }
});

function getVideoIdFromUrl(url) {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
}

async function getTranscriptFromPage(videoId) {
  console.log('Vimeo content script: Getting transcript for', videoId);

  // Method 1: Try to get from Vimeo player config
  try {
    const playerConfig = await getPlayerConfig();
    if (playerConfig) {
      const textTracks = playerConfig.request?.text_tracks ||
                         playerConfig.video?.text_tracks ||
                         [];

      if (textTracks.length > 0) {
        console.log('Found text tracks:', textTracks.length);

        // Find Japanese or English caption
        let selectedTrack = textTracks.find(t => t.lang === 'ja');
        if (!selectedTrack) {
          selectedTrack = textTracks.find(t => t.lang === 'en');
        }
        if (!selectedTrack) {
          selectedTrack = textTracks[0];
        }

        console.log('Selected track:', selectedTrack.lang);

        // Fetch the caption file
        if (selectedTrack.url) {
          const transcript = await fetchAndParseCaption(selectedTrack.url);
          return transcript;
        }
      }
    }
  } catch (e) {
    console.error('Method 1 failed:', e);
  }

  // Method 2: Try to find captions in page scripts
  try {
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const text = script.textContent;
      if (text && text.includes('text_tracks')) {
        // Try to extract text tracks from script
        const match = text.match(/"text_tracks"\s*:\s*(\[.*?\])/s);
        if (match) {
          try {
            const tracks = JSON.parse(match[1]);
            if (tracks.length > 0) {
              let selectedTrack = tracks.find(t => t.lang === 'ja');
              if (!selectedTrack) selectedTrack = tracks.find(t => t.lang === 'en');
              if (!selectedTrack) selectedTrack = tracks[0];

              if (selectedTrack.url) {
                const transcript = await fetchAndParseCaption(selectedTrack.url);
                return transcript;
              }
            }
          } catch (parseErr) {
            console.log('Failed to parse text_tracks');
          }
        }
      }
    }
  } catch (e) {
    console.error('Method 2 failed:', e);
  }

  // Method 3: Check for embedded captions in video element
  try {
    const tracks = document.querySelectorAll('track[kind="captions"], track[kind="subtitles"]');
    if (tracks.length > 0) {
      const trackUrl = tracks[0].src;
      if (trackUrl) {
        const transcript = await fetchAndParseCaption(trackUrl);
        return transcript;
      }
    }
  } catch (e) {
    console.error('Method 3 failed:', e);
  }

  throw new Error('この動画には字幕がありません。動画をダウンロードして「ファイル」タブからアップロードしてください。');
}

async function getPlayerConfig() {
  return new Promise((resolve) => {
    // Try to access Vimeo player config from window
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        let config = null;

        // Try different locations where Vimeo stores player config
        if (window.vimeo && window.vimeo.clip_page_config) {
          config = window.vimeo.clip_page_config;
        } else if (window.playerConfig) {
          config = window.playerConfig;
        }

        // Also try to find in scripts
        if (!config) {
          const scripts = document.querySelectorAll('script');
          for (const s of scripts) {
            const text = s.textContent || '';
            if (text.includes('window.playerConfig')) {
              const match = text.match(/window\\.playerConfig\\s*=\\s*({.*?});/s);
              if (match) {
                try {
                  config = JSON.parse(match[1]);
                } catch(e) {}
              }
            }
          }
        }

        window.postMessage({
          type: 'VIMEO_PLAYER_CONFIG',
          data: config
        }, '*');
      })();
    `;
    document.documentElement.appendChild(script);
    script.remove();

    // Listen for response
    const handler = (event) => {
      if (event.data && event.data.type === 'VIMEO_PLAYER_CONFIG') {
        window.removeEventListener('message', handler);
        resolve(event.data.data);
      }
    };
    window.addEventListener('message', handler);

    // Timeout
    setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve(null);
    }, 2000);
  });
}

async function fetchAndParseCaption(url) {
  console.log('Fetching caption from:', url);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('字幕の取得に失敗しました');
  }

  const text = await response.text();
  console.log('Caption response length:', text.length);

  if (!text || text.length === 0) {
    throw new Error('字幕データが空です');
  }

  // Vimeo typically uses WebVTT format
  return parseWebVTT(text);
}

function parseWebVTT(vttContent) {
  const lines = vttContent.split('\n');
  const segments = [];
  let currentText = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip WEBVTT header, empty lines, and timestamps
    if (line === 'WEBVTT' || line === '' || line.includes('-->')) {
      if (currentText) {
        segments.push(currentText);
        currentText = '';
      }
      continue;
    }

    // Skip numeric cue identifiers
    if (/^\d+$/.test(line)) {
      continue;
    }

    // Skip style/region definitions
    if (line.startsWith('STYLE') || line.startsWith('REGION') || line.startsWith('NOTE')) {
      continue;
    }

    // Remove VTT tags like <c>, </c>, etc.
    const cleanedLine = line.replace(/<[^>]+>/g, '');

    // Add text content
    if (cleanedLine) {
      currentText += (currentText ? ' ' : '') + cleanedLine;
    }
  }

  // Add last segment
  if (currentText) {
    segments.push(currentText);
  }

  if (segments.length === 0) {
    throw new Error('字幕の解析に失敗しました');
  }

  return segments.join('\n');
}

console.log('Vimeo transcript content script loaded');
