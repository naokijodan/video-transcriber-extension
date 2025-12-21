// Background service worker - opens app in independent window

let appWindowId = null;

// Handle messages from popup for YouTube API requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchYouTubeData') {
    fetchYouTubeData(request.videoId)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }

  if (request.action === 'fetchTranscript') {
    fetchTranscriptData(request.url)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Fetch YouTube video data - try multiple methods
async function fetchYouTubeData(videoId) {
  // Method 1: Try fetching the watch page and extracting caption data
  try {
    const pageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'Accept-Language': 'ja,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (pageResponse.ok) {
      const html = await pageResponse.text();

      // Extract ytInitialPlayerResponse from page - find the JSON object properly
      const startMarker = 'var ytInitialPlayerResponse = ';
      const startIndex = html.indexOf(startMarker);

      if (startIndex !== -1) {
        const jsonStart = startIndex + startMarker.length;
        // Find matching closing brace
        let braceCount = 0;
        let jsonEnd = jsonStart;
        let inString = false;
        let escapeNext = false;

        for (let i = jsonStart; i < html.length; i++) {
          const char = html[i];

          if (escapeNext) {
            escapeNext = false;
            continue;
          }

          if (char === '\\' && inString) {
            escapeNext = true;
            continue;
          }

          if (char === '"' && !escapeNext) {
            inString = !inString;
            continue;
          }

          if (!inString) {
            if (char === '{') braceCount++;
            if (char === '}') {
              braceCount--;
              if (braceCount === 0) {
                jsonEnd = i + 1;
                break;
              }
            }
          }
        }

        if (jsonEnd > jsonStart) {
          try {
            const jsonStr = html.substring(jsonStart, jsonEnd);
            const playerData = JSON.parse(jsonStr);
            if (playerData.captions || playerData.playabilityStatus) {
              console.log('Successfully parsed ytInitialPlayerResponse');
              return playerData;
            }
          } catch (e) {
            console.log('Failed to parse ytInitialPlayerResponse:', e.message);
          }
        }
      }
    }
  } catch (e) {
    console.log('Method 1 (page scraping) failed:', e.message);
  }

  // Method 2: Try Innertube API with ANDROID client (more reliable for captions)
  try {
    const response = await fetch('https://www.youtube.com/youtubei/v1/player?key=AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.youtube/17.36.4 (Linux; U; Android 12; JP) gzip',
      },
      body: JSON.stringify({
        videoId: videoId,
        context: {
          client: {
            hl: 'ja',
            gl: 'JP',
            clientName: 'ANDROID',
            clientVersion: '17.36.4',
            androidSdkVersion: 31,
            osName: 'Android',
            osVersion: '12',
            platform: 'MOBILE'
          }
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Innertube API response received');
      return data;
    }
  } catch (e) {
    console.log('Method 2 (Innertube ANDROID) failed:', e.message);
  }

  // Method 3: Try with WEB client as fallback
  try {
    const response = await fetch('https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoId: videoId,
        context: {
          client: {
            hl: 'ja',
            gl: 'JP',
            clientName: 'WEB',
            clientVersion: '2.20231219.04.00'
          }
        }
      })
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.log('Method 3 (Innertube WEB) failed:', e.message);
  }

  throw new Error('YouTube APIへの接続に失敗しました。動画ページを開いて再度お試しください。');
}

// Fetch transcript XML data
async function fetchTranscriptData(url) {
  console.log('Background: Fetching transcript from:', url);

  const response = await fetch(url, {
    headers: {
      'Accept': '*/*',
      'Accept-Language': 'ja,en;q=0.9',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  console.log('Background: Response status:', response.status);

  if (!response.ok) {
    throw new Error(`字幕データの取得に失敗しました (${response.status})`);
  }

  const text = await response.text();
  console.log('Background: Response length:', text.length);
  console.log('Background: Response preview:', text.substring(0, 200));

  if (!text || text.length === 0) {
    throw new Error('字幕データが空です');
  }

  return text;
}

// When extension icon is clicked, open independent window
chrome.action.onClicked.addListener(async (tab) => {
  // Check if window already exists
  if (appWindowId !== null) {
    try {
      const existingWindow = await chrome.windows.get(appWindowId);
      if (existingWindow) {
        // Focus existing window
        await chrome.windows.update(appWindowId, { focused: true });
        return;
      }
    } catch (e) {
      // Window doesn't exist anymore
      appWindowId = null;
    }
  }

  // Get current tab URL to pass to the app
  const currentUrl = tab?.url || '';

  // Create new independent window
  const window = await chrome.windows.create({
    url: chrome.runtime.getURL('popup.html') + '?sourceUrl=' + encodeURIComponent(currentUrl),
    type: 'popup',
    width: 480,
    height: 700,
    top: 100,
    left: 100
  });

  appWindowId = window.id;
});

// Clean up when window is closed
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === appWindowId) {
    appWindowId = null;
  }
});
