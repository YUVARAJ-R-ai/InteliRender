# Phase 1 Documentation: Streaming Chat Core

This document summarizes the steps taken to complete Phase 1 of the Visual Response Engine.

## Objective
Implement a streaming AI chat interface that dynamically renders tokens as they arrive, utilizing the Vercel AI SDK and Server-Sent Events (SSE).

## Completed Tasks

### 1. Vercel AI SDK Integration
- Installed `ai` and `@ai-sdk/anthropic`.
- **Model Config (`lib/ai.ts`)**: Created a centralized function to initialize the LLM. It currently targets the `claude-3-5-sonnet-latest` model for highly reliable structured generation.
- **API Route (`app/api/chat/route.ts`)**: Implemented a Next.js App Router POST handler using `streamText()`. The endpoint handles the incoming message array, passes it to the Anthropic model, and returns a `toDataStreamResponse()` stream.

### 2. Chat Interface Architecture
- **Chat Window (`components/chat/ChatWindow.tsx`)**:
  - Implemented the `useChat()` hook to manage local chat state and automatically handle API fetching/streaming.
  - Added an auto-scroll `useEffect` hook with a `useRef` pointing to the bottom of the message list.
  - Designed the layout using `shadcn` components (`ScrollArea`, `Input`, `Button`).
  - Added a bouncing three-dot loading state while the request is pending.
- **Message Bubble (`components/chat/MessageBubble.tsx`)**:
  - Constructed a reusable UI wrapper that styles messages dynamically depending on the role (`user` vs `assistant`).

### 3. Real-Time Markdown Rendering
- Installed `react-markdown` and `remark-gfm`.
- **Streaming Text (`components/chat/StreamingText.tsx`)**:
  - Engineered a component that receives the dynamically updating `content` string.
  - Configured custom HTML tags for markdown nodes to seamlessly utilize Tailwind utility classes (e.g., customized `pre`, `code`, `a`, `ul` blocks).

## Key Learnings Checkpoint
- **Why `useChat` requires `'use client'`**: The `useChat` hook maintains reactive component state (messages, active input) and directly interfaces with browser APIs to manage the Server-Sent Events (SSE) data stream. Server Components execute entirely server-side and lack access to React lifecycles and the DOM, making them incompatible with interactive streaming hooks.

## Next Steps
In **Phase 2**, we will upgrade this text-only chat structure into a schema-driven architecture by replacing `streamText()` with `generateObject()` and Zod schemas, effectively laying the groundwork for the interactive Widget Protocol.
