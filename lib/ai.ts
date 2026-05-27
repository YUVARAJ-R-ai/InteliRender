import { createOpenAI } from '@ai-sdk/openai';

// Use Ollama's local OpenAI-compatible API endpoint
const ollama = createOpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama', // apiKey is technically required by the SDK but ignored by local Ollama
});

export const getModel = () => {
  return ollama('intellirender-coder');
};
