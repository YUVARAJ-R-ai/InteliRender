# Graph Report - /mnt/drive1/projects/IntelliRender  (2026-05-25)

## Corpus Check
- Corpus is ~5,357 words - fits in a single context window. You may not need a graph.

## Summary
- 209 nodes · 265 edges · 30 communities (18 shown, 12 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 32 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Chat UI Layer|Chat UI Layer]]
- [[_COMMUNITY_Docs & PRD|Docs & PRD]]
- [[_COMMUNITY_Component Configuration|Component Configuration]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Dev Dependencies|Dev Dependencies]]
- [[_COMMUNITY_Runtime Dependencies|Runtime Dependencies]]
- [[_COMMUNITY_Phase 1 Implementation|Phase 1 Implementation]]
- [[_COMMUNITY_Streaming Chat Pipeline|Streaming Chat Pipeline]]
- [[_COMMUNITY_Project Setup|Project Setup]]
- [[_COMMUNITY_Widget System Core|Widget System Core]]
- [[_COMMUNITY_App Layout & Fonts|App Layout & Fonts]]
- [[_COMMUNITY_Agent Configuration|Agent Configuration]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_LLM Widget Decision|LLM Widget Decision]]
- [[_COMMUNITY_File Icon|File Icon]]
- [[_COMMUNITY_Globe Icon|Globe Icon]]
- [[_COMMUNITY_Window Icon|Window Icon]]
- [[_COMMUNITY_Package Scripts|Package Scripts]]
- [[_COMMUNITY_TS Compiler Options|TS Compiler Options]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_ESLint Config Root|ESLint Config Root]]
- [[_COMMUNITY_PostCSS Config Root|PostCSS Config Root]]
- [[_COMMUNITY_Chat API Max Duration|Chat API Max Duration]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 21 edges
2. `Visual Response Engine PRD` - 17 edges
3. `compilerOptions` - 16 edges
4. `Project Scaffolding (Phase 0)` - 12 edges
5. `ChatWindow()` - 8 edges
6. `tailwind` - 6 edges
7. `aliases` - 6 edges
8. `MessageBubble()` - 6 edges
9. `Button()` - 6 edges
10. `getModel()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `cn()` --calls--> `clsx`  [INFERRED]
  lib/utils.ts → package.json
- `Next.js Wordmark Logo SVG` --conceptually_related_to--> `Next.js Framework`  [INFERRED]
  public/next.svg → README.md
- `Vercel Triangle Logo SVG` --conceptually_related_to--> `Vercel Deployment Platform`  [INFERRED]
  public/vercel.svg → README.md
- `StreamingText()` --implements--> `Streaming Chat Pipeline`  [INFERRED]
  components/chat/StreamingText.tsx → app/api/chat/route.ts
- `Package Dependencies` --references--> `getModel()`  [INFERRED]
  package.json → lib/ai.ts

## Hyperedges (group relationships)
- **Widget Rendering Pipeline** — prd_llm_widget_decision, prd_widget_parser, prd_widget_renderer [EXTRACTED 0.95]
- **Type-Safe Widget Protocol System** — prd_widget_types, prd_discriminated_union, prd_zod_schemas, prd_widget_parser [EXTRACTED 0.95]
- **Streaming Chat Core Architecture** — prd_chat_api_route, prd_stream_text, prd_use_chat_hook, prd_chat_window [EXTRACTED 0.95]
- **Streaming AI Response Flow: useChat -> API Route -> streamText -> toDataStreamResponse** — chat_chatwindow_usechat, api_chat_route_post, lib_ai_getmodel, concept_streaming_chat_pipeline [INFERRED 0.95]
- **UI Primitive Wrapper Pattern: Base UI + CVA variants + cn utility** — ui_button_button, ui_input_input, ui_scrollarea_scrollarea, lib_utils_cn, concept_shadcn_baseui_pattern [INFERRED 0.90]
- **Widget System Stub Cluster: parser + types + renderer + widget components** — lib_widgetparser_parser, types_widget_widgettypes, widgets_widgetrenderer_widgetrenderer, widgets_chartdashboard_chartdashboard, widgets_gravityscene_gravityscene, widgets_kanbanboard_kanbanboard [INFERRED 0.85]

## Communities (30 total, 12 thin omitted)

### Community 0 - "Chat UI Layer"
Cohesion: 0.12
Nodes (25): Home(), ChatWindow(), MessageBubble(), MessageBubbleProps, StreamingText(), StreamingTextProps, shadcn/ui Components Config, shadcn + Base UI Primitive Pattern (+17 more)

### Community 1 - "Docs & PRD"
Cohesion: 0.10
Nodes (34): docs/AGENTS.md (Phase 0 Documentation), Project Scaffolding (Phase 0), shadcn/ui Component Library, lib/ai.ts Model Config, ChartDashboard Widget, DashboardParams Type, Discriminated Union Widget Types, Framer Motion (+26 more)

### Community 2 - "Component Configuration"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 3 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 4 - "Dev Dependencies"
Cohesion: 0.11
Nodes (17): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node, @types/react, @types/react-dom (+9 more)

### Community 5 - "Runtime Dependencies"
Cohesion: 0.13
Nodes (15): dependencies, ai, @ai-sdk/anthropic, @base-ui/react, class-variance-authority, clsx, lucide-react, next (+7 more)

### Community 6 - "Phase 1 Implementation"
Cohesion: 0.23
Nodes (13): claude-3-5-sonnet-latest Model, Phase 1 Documentation: Streaming Chat Core, react-markdown + remark-gfm, Server-Sent Events (SSE) Streaming, use client Directive Rationale, Vercel AI SDK Integration (Phase 1), app/api/chat/route.ts, ChatWindow Component (+5 more)

### Community 7 - "Streaming Chat Pipeline"
Cohesion: 0.33
Nodes (7): Chat API POST Handler, useChat Hook Usage, POST(), Streaming Chat Pipeline, claude-3-5-sonnet-latest Model, getModel(), Package Dependencies

### Community 8 - "Project Setup"
Cohesion: 0.29
Nodes (7): Next.js Wordmark Logo SVG, Vercel Triangle Logo SVG, create-next-app CLI, Geist Font, IntelliRender Project README, Next.js Framework, Vercel Deployment Platform

### Community 9 - "Widget System Core"
Cohesion: 0.43
Nodes (7): Widget System (pluggable visual components), Widget Parser (stub), Widget Type Definitions (stub), ChartDashboard Widget (stub), GravityScene Widget (stub), KanbanBoard Widget (stub), WidgetRenderer Component (stub)

### Community 10 - "App Layout & Fonts"
Cohesion: 0.40
Nodes (5): geistMono, geistSans, metadata, RootLayout(), Visual Response Engine (App Concept)

### Community 11 - "Agent Configuration"
Cohesion: 0.67
Nodes (3): Next.js Agent Rules, Next.js Breaking Changes Warning, CLAUDE.md Agents Reference

## Knowledge Gaps
- **98 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+93 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Chat UI Layer` to `Runtime Dependencies`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Runtime Dependencies` to `Dev Dependencies`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `clsx` connect `Runtime Dependencies` to `Chat UI Layer`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `cn()` (e.g. with `clsx` and `shadcn + Base UI Primitive Pattern`) actually correct?**
  _`cn()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _99 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Chat UI Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.12436974789915967 - nodes in this community are weakly interconnected._
- **Should `Docs & PRD` be split into smaller, more focused modules?**
  _Cohesion score 0.09803921568627451 - nodes in this community are weakly interconnected._