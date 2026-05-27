# Switching from Anthropic to Local Ollama

## Overview
This document outlines the steps and troubleshooting process taken to transition the Visual Response Engine from using a cloud-based Anthropic provider to a local, privacy-first inference engine using Ollama.

## Problem Context
Initially, the project relied on the Anthropic SDK (`@ai-sdk/anthropic`) for structured object generation. When attempting to use Ollama via the community `ollama-ai-provider` package, the application threw a 500 Server Error:
> \`Unsupported model version v1 for provider "ollama.chat"... AI SDK 5 only supports models that implement specification version "v2".\`

This occurred because the Vercel AI SDK updated its underlying provider specification requirements (v2 spec), breaking older, community-maintained provider wrappers.

## The Solution: OpenAI Compatibility
Instead of relying on third-party provider wrappers, we leveraged Ollama's native **OpenAI-Compatible API**. Ollama exposes an endpoint (`/v1`) that behaves exactly like the OpenAI REST API.

### 1. Package Installation
We uninstalled the outdated `ollama-ai-provider` and installed the official `@ai-sdk/openai` package.
\`\`\`bash
npm uninstall ollama-ai-provider
npm install @ai-sdk/openai --legacy-peer-deps
\`\`\`

### 2. Provider Configuration (\`lib/ai.ts\`)
We reconfigured the AI core to route through the OpenAI provider, overriding the base URL to point to the local Ollama instance port (default `11434`).

\`\`\`typescript
import { createOpenAI } from '@ai-sdk/openai';

const ollama = createOpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama', // Required by the SDK, but safely ignored by local Ollama
});

export const getModel = () => {
  return ollama('qwen2.5-coder:latest'); // Changed from minicpm-v2.6 for better JSON structuring
};
\`\`\`

## Model Selection Notes
- **MiniCPM-V 2.6**: Initially tested. While great for vision tasks, it is a smaller model that occasionally hallucinates JSON structures, breaking the strict Zod validation required by `generateObject()`.
- **Qwen2.5-Coder (latest)**: We switched to this model for the final integration. Because it is highly tuned for coding and logical structuring, it generates the complex nested JSON needed for the Kanban boards and Gravity Visualizers flawlessly.
