import { createOpenAI } from '@ai-sdk/openai';

function siliconflowClient(apiKey?: string) {
  return createOpenAI({
    baseURL: 'https://api.siliconflow.com/v1',
    // Per-user key from DB takes priority over env var
    apiKey: apiKey || process.env.SILICONFLOW_API_KEY,
    // Disable "thinking" mode on every chat completion. SiliconFlow reasoning
    // models (e.g. DeepSeek-V4-Flash) emit reasoning_content that MUST be echoed
    // back on the next turn (error 20015) — which the AI SDK doesn't do, so the
    // multi-step tool loop 400s right after a tool call. We don't use reasoning
    // tokens; turning thinking off keeps tool calling working (and is harmless
    // for non-thinking models, which ignore the flag).
    fetch: async (url, options) => {
      if (typeof url === 'string' && url.includes('/chat/completions') && typeof options?.body === 'string') {
        try {
          const body = JSON.parse(options.body);
          body.enable_thinking = false;
          options = { ...options, body: JSON.stringify(body) };
        } catch {
          /* not JSON — leave untouched */
        }
      }
      return fetch(url, options);
    },
  });
}

/**
 * Selectable chat models. `id` is what the UI/API exchange; `model` is the
 * SiliconFlow model string. Add new models here — the switcher reads this list.
 */
export const CHAT_MODELS = [
  { id: 'deepseek-v4-flash', label: 'DeepSeek-V4-Flash', model: 'deepseek-ai/DeepSeek-V4-Flash' },
  { id: 'nex-n2-pro', label: 'Nex-N2-Pro (free)', model: 'nex-agi/Nex-N2-Pro' },
] as const;

export type ChatModelId = (typeof CHAT_MODELS)[number]['id'];

/** Default model id — used when none is selected or an invalid id is sent. */
export const DEFAULT_CHAT_MODEL_ID: ChatModelId = 'deepseek-v4-flash';

/** Resolve a model id to its SiliconFlow model string, falling back to the default. */
function resolveModelString(modelId?: string): string {
  const found = CHAT_MODELS.find((m) => m.id === modelId);
  return (found ?? CHAT_MODELS.find((m) => m.id === DEFAULT_CHAT_MODEL_ID)!).model;
}

/**
 * Main chat model. Accepts an optional per-user API key and an optional model id
 * (from CHAT_MODELS). Unknown/missing ids fall back to the default model.
 */
export function getModel(apiKey?: string, modelId?: string) {
  // Use .chat() to force the Chat Completions API (/v1/chat/completions)
  // instead of the default Responses API (/v1/responses) which SiliconFlow doesn't support
  return siliconflowClient(apiKey).chat(resolveModelString(modelId));
}

/** Cheap fast model for title generation — no full reasoning needed. */
export function getTitleModel(apiKey?: string) {
  return siliconflowClient(apiKey).chat('Qwen/Qwen2.5-7B-Instruct');
}
