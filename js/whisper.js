// Whisper API integration for audio transcription (Premium feature)

class WhisperTranscriber {
  constructor() {
    this.apiUrl = 'https://api.openai.com/v1/audio/transcriptions';
    this.maxFileSize = 25 * 1024 * 1024; // 25MB limit for Whisper API
    this.maxChunkDuration = 600; // 10 minutes per chunk (safe limit for ~20MB WAV)
  }

  // Main transcribe function - handles large files by splitting
  async transcribe(file, apiKey, onProgress = null) {
    if (!apiKey) {
      throw new Error('OpenAI APIキーが設定されていません');
    }

    if (onProgress) onProgress(5, 'ファイルを確認中...');

    // Extract audio and get duration
    const audioData = await this.extractAudioData(file, onProgress);
    const duration = audioData.duration;

    if (onProgress) onProgress(15, `音声を解析中... (${Math.round(duration)}秒)`);

    // Check if we need to split
    if (duration > this.maxChunkDuration) {
      // Split and process in chunks
      return await this.transcribeInChunks(audioData, apiKey, onProgress);
    } else {
      // Process as single file
      const wavBlob = this.audioBufferToWav(audioData.buffer);
      const wavFile = new File([wavBlob], 'audio.wav', { type: 'audio/wav' });

      if (onProgress) onProgress(25, `音声ファイル準備完了 (${Math.round(wavFile.size / 1024 / 1024 * 10) / 10}MB)`);

      return await this.sendToWhisper(wavFile, apiKey, onProgress, 30, 90);
    }
  }

  // Transcribe large audio in chunks
  async transcribeInChunks(audioData, apiKey, onProgress = null) {
    const { buffer, duration } = audioData;
    const numChunks = Math.ceil(duration / this.maxChunkDuration);
    const transcripts = [];

    if (onProgress) onProgress(20, `${numChunks}個のパートに分割して処理します...`);

    for (let i = 0; i < numChunks; i++) {
      const startTime = i * this.maxChunkDuration;
      const endTime = Math.min((i + 1) * this.maxChunkDuration, duration);

      if (onProgress) {
        const baseProgress = 20 + (i / numChunks) * 60;
        onProgress(baseProgress, `パート ${i + 1}/${numChunks} を処理中... (${Math.round(startTime)}秒〜${Math.round(endTime)}秒)`);
      }

      // Extract chunk
      const chunkBuffer = this.extractChunk(buffer, startTime, endTime);
      const wavBlob = this.audioBufferToWav(chunkBuffer);
      const wavFile = new File([wavBlob], `chunk_${i}.wav`, { type: 'audio/wav' });

      // Send to Whisper
      const chunkProgress = (p, t) => {
        if (onProgress) {
          const baseProgress = 20 + (i / numChunks) * 60;
          const chunkContribution = (p / 100) * (60 / numChunks);
          onProgress(baseProgress + chunkContribution, `パート ${i + 1}/${numChunks}: ${t}`);
        }
      };

      const transcript = await this.sendToWhisper(wavFile, apiKey, chunkProgress, 0, 100);
      transcripts.push(transcript);
    }

    if (onProgress) onProgress(85, '全パートの文字起こし完了、結合中...');

    // Combine all transcripts
    return transcripts.join('\n\n');
  }

  // Extract a chunk from audio buffer
  extractChunk(audioBuffer, startTime, endTime) {
    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(startTime * sampleRate);
    const endSample = Math.floor(endTime * sampleRate);
    const length = endSample - startSample;

    // Create new buffer for chunk
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const chunkBuffer = audioContext.createBuffer(1, length, sampleRate);
    const chunkData = chunkBuffer.getChannelData(0);
    const sourceData = audioBuffer.getChannelData(0);

    // Copy data
    for (let i = 0; i < length; i++) {
      chunkData[i] = sourceData[startSample + i] || 0;
    }

    audioContext.close();
    return chunkBuffer;
  }

  // Send file to Whisper API
  async sendToWhisper(file, apiKey, onProgress, progressStart, progressEnd) {
    if (onProgress) onProgress(progressStart + (progressEnd - progressStart) * 0.2, 'Whisper APIに送信中...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', 'whisper-1');
    formData.append('language', 'ja');
    formData.append('response_format', 'text');

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `APIエラー: ${response.status}`);
      }

      if (onProgress) onProgress(progressEnd, '完了');

      return await response.text();
    } catch (error) {
      console.error('Whisper API error:', error);
      throw error;
    }
  }

  // Extract audio data from file
  async extractAudioData(file, onProgress = null) {
    return new Promise(async (resolve, reject) => {
      try {
        if (onProgress) onProgress(8, 'オーディオを読み込み中...');

        const arrayBuffer = await file.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();

        if (onProgress) onProgress(10, 'オーディオをデコード中...');

        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const duration = audioBuffer.duration;

        if (onProgress) onProgress(12, '音声を圧縮中...');

        // Compress to 16kHz mono
        const compressedBuffer = this.compressAudioBuffer(audioBuffer, audioContext);

        audioContext.close();

        resolve({
          buffer: compressedBuffer,
          duration: duration
        });
      } catch (error) {
        reject(new Error('オーディオファイルの読み込みに失敗しました: ' + error.message));
      }
    });
  }

  // Compress audio buffer - reduce sample rate and convert to mono
  compressAudioBuffer(audioBuffer, audioContext) {
    // Target: 16kHz mono (Whisper works well with this)
    const targetSampleRate = 16000;
    const numChannels = 1; // Mono

    const originalSampleRate = audioBuffer.sampleRate;
    const originalLength = audioBuffer.length;
    const duration = audioBuffer.duration;

    // Calculate new length based on target sample rate
    const newLength = Math.round(duration * targetSampleRate);

    // Create offline context for resampling
    const offlineContext = new OfflineAudioContext(numChannels, newLength, targetSampleRate);

    // Create buffer source
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start(0);

    // We can't use offline rendering synchronously, so we'll do manual resampling
    // Get audio data from all channels and mix to mono
    const inputData = [];
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      inputData.push(audioBuffer.getChannelData(channel));
    }

    // Create output buffer
    const outputBuffer = audioContext.createBuffer(numChannels, newLength, targetSampleRate);
    const outputData = outputBuffer.getChannelData(0);

    // Resample and mix to mono
    const ratio = originalSampleRate / targetSampleRate;
    for (let i = 0; i < newLength; i++) {
      const srcIndex = Math.floor(i * ratio);
      let sample = 0;
      for (let channel = 0; channel < inputData.length; channel++) {
        sample += inputData[channel][Math.min(srcIndex, originalLength - 1)] || 0;
      }
      outputData[i] = sample / inputData.length;
    }

    return outputBuffer;
  }

  // Convert AudioBuffer to WAV Blob
  audioBufferToWav(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    const data = audioBuffer.getChannelData(0);
    const dataLength = data.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    // WAV header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // Write audio data
    let offset = 44;
    for (let i = 0; i < data.length; i++) {
      const sample = Math.max(-1, Math.min(1, data[i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  // Helper to write string to DataView
  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // Transcribe from URL (for Google Drive)
  async transcribeFromUrl(url, apiKey, onProgress = null) {
    if (onProgress) onProgress(5, 'ファイルをダウンロード中...');

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('ファイルのダウンロードに失敗しました');
      }

      if (onProgress) onProgress(15, 'ファイルを処理中...');

      const blob = await response.blob();
      const contentType = response.headers.get('content-type') || 'video/mp4';
      const extension = this.getExtensionFromMimeType(contentType);
      const file = new File([blob], `media.${extension}`, { type: contentType });

      return await this.transcribe(file, apiKey, onProgress);
    } catch (error) {
      console.error('Transcribe from URL error:', error);
      throw error;
    }
  }

  // Get file extension from MIME type
  getExtensionFromMimeType(mimeType) {
    const mimeToExt = {
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov',
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/wav': 'wav',
      'audio/x-wav': 'wav',
      'audio/mp4': 'm4a',
      'audio/x-m4a': 'm4a',
      'audio/ogg': 'ogg',
      'audio/webm': 'webm'
    };
    return mimeToExt[mimeType] || 'mp4';
  }

  // Supported file types
  getSupportedTypes() {
    return [
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'video/x-m4v',
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/x-wav',
      'audio/mp4',
      'audio/x-m4a',
      'audio/ogg',
      'audio/webm',
      '' // Allow files without type
    ];
  }

  // Check if file type is supported
  isSupported(file) {
    // Accept if type is in list or if it's a video/audio file
    if (this.getSupportedTypes().includes(file.type)) return true;
    if (file.type.startsWith('video/') || file.type.startsWith('audio/')) return true;
    // Check by extension
    const ext = file.name.split('.').pop().toLowerCase();
    const supportedExts = ['mp4', 'webm', 'mov', 'm4v', 'mp3', 'wav', 'm4a', 'ogg', 'flac'];
    return supportedExts.includes(ext);
  }
}

// Export singleton instance
const whisperTranscriber = new WhisperTranscriber();
