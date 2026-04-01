export const MODELS_DEV_SNAPSHOT = {
  anthropic: {
    name: 'Anthropic',
    api: 'https://api.anthropic.com/v1',
    env: ['ANTHROPIC_API_KEY'],
    id: 'anthropic',
    models: {
      'claude-sonnet-4-6': {
        id: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6',
        family: 'claude',
        release_date: '2025-10-01',
        attachment: true,
        reasoning: true,
        temperature: true,
        tool_call: true,
        limit: { context: 1000000, output: 64000 },
        modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
        options: {}
      },
      'claude-opus-4-6': {
        id: 'claude-opus-4-6',
        name: 'Claude Opus 4.6',
        family: 'claude',
        release_date: '2025-10-01',
        attachment: true,
        reasoning: true,
        temperature: true,
        tool_call: true,
        limit: { context: 1000000, output: 64000 },
        modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
        options: {}
      },
      'claude-haiku-4-5': {
        id: 'claude-haiku-4-5',
        name: 'Claude Haiku 4.5',
        family: 'claude',
        release_date: '2025-10-01',
        attachment: true,
        reasoning: false,
        temperature: true,
        tool_call: true,
        limit: { context: 200000, output: 16000 },
        modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
        options: {}
      }
    }
  },
  openai: {
    name: 'OpenAI',
    api: 'https://api.openai.com/v1',
    env: ['OPENAI_API_KEY'],
    id: 'openai',
    npm: '@ai-sdk/openai',
    models: {
      'gpt-5': {
        id: 'gpt-5',
        name: 'GPT-5',
        family: 'gpt',
        release_date: '2025-01-01',
        attachment: true,
        reasoning: true,
        temperature: true,
        tool_call: true,
        limit: { context: 400000, output: 128000 },
        modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
        options: {}
      },
      'gpt-5-mini': {
        id: 'gpt-5-mini',
        name: 'GPT-5 Mini',
        family: 'gpt',
        release_date: '2025-01-01',
        attachment: true,
        reasoning: true,
        temperature: true,
        tool_call: true,
        limit: { context: 400000, output: 64000 },
        modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
        options: {}
      },
      'gpt-5-nano': {
        id: 'gpt-5-nano',
        name: 'GPT-5 Nano',
        family: 'gpt',
        release_date: '2025-01-01',
        attachment: false,
        reasoning: false,
        temperature: true,
        tool_call: true,
        limit: { context: 128000, output: 32000 },
        modalities: { input: ['text'], output: ['text'] },
        options: {}
      }
    }
  },
  gemini: {
    name: 'Google Gemini',
    api: 'https://generativelanguage.googleapis.com',
    env: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    id: 'gemini',
    npm: '@ai-sdk/google',
    models: {
      'gemini-2.5-pro': {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        family: 'gemini',
        release_date: '2025-01-01',
        attachment: true,
        reasoning: true,
        temperature: true,
        tool_call: true,
        limit: { context: 1048576, output: 65536 },
        modalities: { input: ['text', 'image', 'pdf', 'audio', 'video'], output: ['text'] },
        options: {}
      },
      'gemini-2.5-flash': {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        family: 'gemini',
        release_date: '2025-01-01',
        attachment: true,
        reasoning: true,
        temperature: true,
        tool_call: true,
        limit: { context: 1048576, output: 65536 },
        modalities: { input: ['text', 'image', 'pdf', 'audio', 'video'], output: ['text'] },
        options: {}
      }
    }
  }
} as const
