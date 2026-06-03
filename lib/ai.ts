import { createOpenAI } from '@ai-sdk/openai';

function siliconflowClient(apiKey?: string) {
  return createOpenAI({
    baseURL: 'https://api.siliconflow.com/v1',
    // Per-user key from DB takes priority over env var
    apiKey: apiKey || process.env.SILICONFLOW_API_KEY,
  });
}

/** Main chat model — DeepSeek-V4-Flash. Accepts an optional per-user API key. */
export function getModel(apiKey?: string) {
  // Use .chat() to force the Chat Completions API (/v1/chat/completions)
  // instead of the default Responses API (/v1/responses) which SiliconFlow doesn't support
  return siliconflowClient(apiKey).chat('deepseek-ai/DeepSeek-V4-Flash');
}

/** Cheap fast model for title generation — no full reasoning needed. */
export function getTitleModel(apiKey?: string) {
  return siliconflowClient(apiKey).chat('Qwen/Qwen2.5-7B-Instruct');
}
