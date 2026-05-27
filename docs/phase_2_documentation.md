# Phase 2 Documentation: Widget Protocol Design

This document summarizes the steps taken to complete Phase 2 of the Visual Response Engine.

## Objective
Establish a strictly-typed communication protocol between the AI model and the frontend by migrating from text streaming to structured JSON generation using Zod.

## Completed Tasks

### 1. Zod Schema Definitions (`types/widget.ts`)
- Installed `zod` for robust schema declaration and validation.
- Defined schemas for all interactive widgets:
  - `GravityParamsSchema`
  - `KanbanParamsSchema`
  - `DashboardParamsSchema`
  - `TextParamsSchema`
- Designed a **Discriminated Union** (`WidgetSchema`) combining all schemas under a single `type` field, allowing TypeScript to accurately narrow types based on the widget type.
- Defined the overarching `AIResponseSchema` combining a conversational `text` response with a `widget` payload.

### 2. AI Structured Output Integration (`app/api/chat/route.ts`)
- Replaced the `streamText()` function with `generateObject()` from the Vercel AI SDK.
- Enforced structured JSON output by passing `AIResponseSchema` directly into the AI generation call.
- Authored a comprehensive `SYSTEM_PROMPT` instructing the AI:
  - When to select specific widget types.
  - The strict requirement to return JSON matching the provided schema.
  - The necessity of mocking rich sample data for the widget parameters.

### 3. Widget Parser Utility (`lib/widget-parser.ts`)
- Created a validation wrapper that takes the raw AI JSON payload and runs `.parse()` using the Zod schema, throwing typed errors if the LLM hallucinates an invalid structure.

## Key Learnings
- **Schema-Driven Development**: By defining Zod schemas first, we establish a single source of truth that dictates both the LLM's output shape and the frontend's TypeScript interfaces. 
- **Generate Object vs Stream Text**: While `streamText` returns raw characters continuously, `generateObject` waits for the AI to construct a complete, valid JSON object (unless using experimental object streaming).
