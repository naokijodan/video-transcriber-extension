// AI Provider integrations for article generation

class AIProviders {
  constructor() {
    this.providers = {
      openai: {
        name: 'OpenAI',
        url: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4o-mini'
      },
      claude: {
        name: 'Claude',
        url: 'https://api.anthropic.com/v1/messages',
        model: 'claude-3-5-sonnet-20241022'
      },
      gemini: {
        name: 'Gemini',
        urlTemplate: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
        model: 'gemini-1.5-flash'
      }
    };
  }

  // Generate article using selected provider
  async generateArticle(provider, apiKey, prompt, transcript, onProgress = null) {
    if (!apiKey) {
      throw new Error(`${this.providers[provider].name}のAPIキーが設定されていません`);
    }

    const fullPrompt = prompt + transcript;

    if (onProgress) onProgress(50, '記事を生成中...');

    switch (provider) {
      case 'openai':
        return await this.generateWithOpenAI(apiKey, fullPrompt, onProgress);
      case 'claude':
        return await this.generateWithClaude(apiKey, fullPrompt, onProgress);
      case 'gemini':
        return await this.generateWithGemini(apiKey, fullPrompt, onProgress);
      default:
        throw new Error('不明なAIプロバイダーです');
    }
  }

  // OpenAI GPT
  async generateWithOpenAI(apiKey, prompt, onProgress) {
    const config = this.providers.openai;

    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: 'system',
              content: 'あなたは優秀なライターです。与えられた文字起こしを元に、読みやすく構成された記事をHTMLで作成します。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 4096,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `OpenAI APIエラー: ${response.status}`);
      }

      if (onProgress) onProgress(90, '完了...');

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI error:', error);
      throw error;
    }
  }

  // Anthropic Claude
  async generateWithClaude(apiKey, prompt, onProgress) {
    const config = this.providers.claude;

    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          system: 'あなたは優秀なライターです。与えられた文字起こしを元に、読みやすく構成された記事をHTMLで作成します。'
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `Claude APIエラー: ${response.status}`);
      }

      if (onProgress) onProgress(90, '完了...');

      const data = await response.json();
      return data.content[0].text;
    } catch (error) {
      console.error('Claude error:', error);
      throw error;
    }
  }

  // Google Gemini
  async generateWithGemini(apiKey, prompt, onProgress) {
    const config = this.providers.gemini;
    const url = `${config.urlTemplate}?key=${apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `あなたは優秀なライターです。与えられた文字起こしを元に、読みやすく構成された記事をHTMLで作成します。\n\n${prompt}`
                }
              ]
            }
          ],
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.7
          }
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `Gemini APIエラー: ${response.status}`);
      }

      if (onProgress) onProgress(90, '完了...');

      const data = await response.json();
      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('Gemini error:', error);
      throw error;
    }
  }

  // Get provider info
  getProviderInfo(provider) {
    return this.providers[provider] || null;
  }

  // Check if API key is valid format
  validateApiKey(provider, key) {
    if (!key || key.trim() === '') {
      return false;
    }

    switch (provider) {
      case 'openai':
        return key.startsWith('sk-');
      case 'claude':
        return key.startsWith('sk-ant-');
      case 'gemini':
        return key.startsWith('AIza');
      default:
        return true;
    }
  }
}

// Export singleton instance
const aiProviders = new AIProviders();
