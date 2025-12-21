// Content script - runs on YouTube pages to extract transcript

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getYouTubeTranscript') {
    getTranscriptFromPage(request.videoId)
      .then(transcript => sendResponse({ success: true, transcript }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async
  }

  if (request.action === 'checkYouTubePage') {
    const videoId = getVideoIdFromUrl(window.location.href);
    sendResponse({
      isYouTube: true,
      videoId: videoId,
      url: window.location.href
    });
    return true;
  }
});

function getVideoIdFromUrl(url) {
  const match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : null;
}

async function getTranscriptFromPage(videoId) {
  console.log('Content script: Getting transcript for', videoId);

  // Method 1: Try to get from ytInitialPlayerResponse (already loaded in page)
  try {
    const playerResponse = await getPlayerResponseFromPage();
    if (playerResponse) {
      const captions = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (captions && captions.length > 0) {
        console.log('Found captions:', captions.length);

        // Find Japanese or English caption
        let selectedCaption = captions.find(c => c.languageCode === 'ja' || c.vssId?.includes('ja'));
        if (!selectedCaption) {
          selectedCaption = captions.find(c => c.languageCode === 'en' || c.vssId?.includes('en'));
        }
        if (!selectedCaption) {
          selectedCaption = captions[0];
        }

        console.log('Selected caption:', selectedCaption.languageCode);

        // Fetch the caption XML - this works from the page context!
        const transcript = await fetchAndParseCaption(selectedCaption.baseUrl);
        return transcript;
      }
    }
  } catch (e) {
    console.error('Method 1 failed:', e);
  }

  // Method 2: Try to extract from page script tags
  try {
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const text = script.textContent;
      if (text && text.includes('captionTracks')) {
        const match = text.match(/"captionTracks":\s*(\[.*?\])/);
        if (match) {
          const captions = JSON.parse(match[1]);
          if (captions.length > 0) {
            let selectedCaption = captions.find(c => c.languageCode === 'ja');
            if (!selectedCaption) selectedCaption = captions.find(c => c.languageCode === 'en');
            if (!selectedCaption) selectedCaption = captions[0];

            const transcript = await fetchAndParseCaption(selectedCaption.baseUrl);
            return transcript;
          }
        }
      }
    }
  } catch (e) {
    console.error('Method 2 failed:', e);
  }

  throw new Error('この動画には字幕がありません');
}

async function getPlayerResponseFromPage() {
  // Try to get ytInitialPlayerResponse from window
  return new Promise((resolve) => {
    // Inject script to access page's window object
    const script = document.createElement('script');
    script.textContent = `
      window.postMessage({
        type: 'YT_PLAYER_RESPONSE',
        data: window.ytInitialPlayerResponse || null
      }, '*');
    `;
    document.documentElement.appendChild(script);
    script.remove();

    // Listen for response
    const handler = (event) => {
      if (event.data && event.data.type === 'YT_PLAYER_RESPONSE') {
        window.removeEventListener('message', handler);
        resolve(event.data.data);
      }
    };
    window.addEventListener('message', handler);

    // Timeout
    setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve(null);
    }, 1000);
  });
}

async function fetchAndParseCaption(baseUrl) {
  // Add format parameter if not present
  let url = baseUrl;
  if (!url.includes('fmt=')) {
    url += (url.includes('?') ? '&' : '?') + 'fmt=srv3';
  }

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

  return parseTranscriptXml(text);
}

function parseTranscriptXml(xml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    // Try as HTML
    const htmlDoc = parser.parseFromString(xml, 'text/html');
    const textElements = htmlDoc.querySelectorAll('text');
    if (textElements.length > 0) {
      return extractTextFromElements(textElements);
    }
    throw new Error('字幕の解析に失敗しました');
  }

  // Try various formats
  let textElements = doc.querySelectorAll('text');

  if (textElements.length === 0) {
    textElements = doc.querySelectorAll('transcript text');
  }

  if (textElements.length === 0) {
    // srv3 format uses body > p
    const bodyElements = doc.querySelectorAll('body p');
    if (bodyElements.length > 0) {
      const segments = [];
      bodyElements.forEach(p => {
        const text = decodeHtmlEntities(p.textContent || '');
        if (text.trim()) {
          segments.push(text.trim());
        }
      });
      if (segments.length > 0) {
        return segments.join('\n');
      }
    }
  }

  if (textElements.length === 0) {
    // Check if it's JSON
    if (xml.trim().startsWith('{')) {
      try {
        const data = JSON.parse(xml);
        if (data.events) {
          const segments = [];
          data.events.forEach(event => {
            if (event.segs) {
              const text = event.segs.map(seg => seg.utf8 || '').join('');
              if (text.trim()) {
                segments.push(text.trim());
              }
            }
          });
          if (segments.length > 0) {
            return segments.join('\n');
          }
        }
      } catch (e) {}
    }
    throw new Error('字幕データの解析に失敗しました');
  }

  return extractTextFromElements(textElements);
}

function extractTextFromElements(elements) {
  const segments = [];
  elements.forEach(element => {
    const text = decodeHtmlEntities(element.textContent || '');
    if (text.trim()) {
      segments.push(text.trim());
    }
  });

  if (segments.length === 0) {
    throw new Error('字幕が空です');
  }

  return segments.join('\n');
}

function decodeHtmlEntities(text) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n/g, ' ')
    .trim();
}

console.log('YouTube transcript content script loaded');
