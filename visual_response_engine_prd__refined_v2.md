# Visual Response Engine — Refined PRD (Learning-First Build)

> **Build philosophy:** You're using Claude Code to move fast — but every phase has
> explicit things you're supposed to *understand*, not just ship. Read the "Learn"
> section of each phase before starting it. Don't skip phases.

---

## What This Project Is

A **streaming AI chat interface** that renders **interactive visual components**
inline in chat instead of walls of text.

```
User types a prompt
       ↓
LLM decides: "this needs a visual"
       ↓
Returns structured widget config (JSON)
       ↓
Visual Response Engine renders it
       ↓
Interactive component appears in chat
```

---

## Final Demo

Three prompts that show off the whole system:

| Prompt | Widget Rendered |
|---|---|
| "Show me how gravity works between two planets" | Gravity orbit simulator with sliders |
| "Plan my internship prep for the next 4 weeks" | Kanban board with drag-drop |
| "Give me a dashboard for my portfolio" | KPI cards + charts |

---

## Tech Stack (locked in)

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | You already know React; learn server components + routes |
| AI SDK | Vercel AI SDK | `useChat`, `streamText`, `generateObject` — industry standard |
| Styling | Tailwind CSS + shadcn/ui | Component library you'll use in every future project |
| Charts | Recharts | Simple, composable, React-native |
| 3D | react-three-fiber + @react-three/drei | R3F is how Three.js is done in React |
| Animations | Framer Motion | Motion primitives every frontend dev should know |
| Types | TypeScript | Non-negotiable for schema-driven architectures |

---

## Folder Structure (reference before Phase 3)

```
/app
  /api
    /chat/route.ts          ← AI endpoint
/components
  /chat
    ChatWindow.tsx
    MessageBubble.tsx
    StreamingText.tsx
  /widgets
    WidgetRenderer.tsx      ← the router
    GravityScene.tsx
    KanbanBoard.tsx
    ChartDashboard.tsx
  /ui                       ← shadcn components
/lib
  ai.ts                     ← model config
  widget-parser.ts          ← JSON → widget config
/types
  widget.ts                 ← all widget types
```

---

## Phases

---

### Phase 0 — Project Setup & Foundations
**Estimated time:** 1–2 hours

#### What you'll learn
- How Next.js 14 App Router works (different from Pages Router — layouts, server vs client components)
- How Tailwind utility classes compose into real UI
- Why TypeScript strict mode matters when you're building schema-driven things
- How to wire up `shadcn/ui` (it copies components into your repo, not a black box)

#### Build
- [ ] `npx create-next-app@latest` with TypeScript + Tailwind + App Router
- [ ] Install and init shadcn: `npx shadcn-ui@latest init`
- [ ] Add shadcn components: `button`, `card`, `badge`, `input`, `scroll-area`
- [ ] Create folder structure above (empty files are fine)
- [ ] Set up a basic layout in `app/layout.tsx` — dark mode, centered, max-width container
- [ ] Deploy to Vercel: connect repo, push, confirm it deploys

#### Checkpoint question (answer this yourself before moving on)
> "What's the difference between a Server Component and a Client Component
> in Next.js App Router, and which one can use `useState`?"

---

### Phase 1 — Streaming Chat Core
**Estimated time:** 2–3 hours

#### What you'll learn
- How token streaming works (SSE — Server-Sent Events)
- The Vercel AI SDK's `useChat` hook: what it abstracts and what it exposes
- How to build a chat UI that doesn't re-render the entire message list on every token
- Message data structure (`role: user | assistant`, `content: string`)

#### Build
- [ ] Install: `npm install ai @ai-sdk/anthropic`
- [ ] Create `/app/api/chat/route.ts` — POST handler using `streamText()`
  ```ts
  // The shape you need to understand:
  // request → extract messages → streamText({ model, messages }) → return stream
  ```
- [ ] Build `ChatWindow.tsx` using `useChat()` hook
  - Input box at bottom, messages list that scrolls
  - Auto-scroll to bottom on new message
- [ ] Build `StreamingText.tsx` — renders text token by token (hint: it's just the `content` string, streaming handles it)
- [ ] Add basic markdown rendering with `react-markdown` + `remark-gfm`
- [ ] Add loading state (three-dot animation while AI is responding)

#### Things to poke at manually
- Open Network tab → see the streaming SSE response — watch tokens arrive
- What happens if you send a message before the previous one finishes?
- Understand why `useChat` maintains message history automatically

#### Checkpoint question
> "Why does `useChat` need to be a Client Component (`'use client'`)?
> What would break if you tried to use it in a Server Component?"

---

### Phase 2 — Widget Protocol Design
**Estimated time:** 1–2 hours

#### What you'll learn
- How to use `generateObject()` with Zod schemas to get structured JSON from an LLM
- Why schema design matters — garbage schema → garbage widget data
- TypeScript discriminated unions (the correct way to type "one of many widget types")
- How to write a system prompt that makes the model behave predictably

#### Build
- [ ] Install: `npm install zod`
- [ ] Define your widget types in `/types/widget.ts`:
  ```ts
  // This pattern is called a discriminated union — learn it well
  type Widget =
    | { type: 'gravity'; params: GravityParams }
    | { type: 'kanban'; params: KanbanParams }
    | { type: 'dashboard'; params: DashboardParams }
    | { type: 'text'; params: { content: string } }

  // Define each Params type with Zod schema AND TypeScript type
  ```
- [ ] Write a Zod schema for the full `AIResponse`:
  ```ts
  // { widget: Widget; text: string }
  ```
- [ ] Update `/app/api/chat/route.ts` to use `generateObject()` with your schema
- [ ] Write the system prompt that tells the model:
  - When to pick each widget type
  - Exact JSON shape it must return
  - Fallback to `text` widget for normal conversation
- [ ] Build `/lib/widget-parser.ts` — takes raw AI response, validates against schema,
  returns typed widget config or throws a typed error

#### Test cases to run before moving on
```
"what is 2+2"          → type: 'text'
"explain gravity"      → type: 'gravity'
"plan my week"         → type: 'kanban'
"show my portfolio"    → type: 'dashboard'
```

#### Checkpoint question
> "What's the difference between `streamText()` and `generateObject()`?
> Why can't you easily stream a `generateObject()` response?"

---

### Phase 3 — Widget Renderer Architecture
**Estimated time:** 1 hour

#### What you'll learn
- The **Registry Pattern** — mapping string keys to React components at runtime
- How to write a clean router/switch component that scales to N widgets without
  growing into a mess
- Why this is better than a giant `if/else` chain

#### Build
- [ ] Build `WidgetRenderer.tsx`:
  ```tsx
  // Core idea:
  const WIDGET_REGISTRY = {
    gravity: GravityScene,
    kanban: KanbanBoard,
    dashboard: ChartDashboard,
    text: TextWidget,
  }

  export function WidgetRenderer({ widget }: { widget: Widget }) {
    const Component = WIDGET_REGISTRY[widget.type]
    return <Component params={widget.params} />
  }
  ```
- [ ] Each widget component receives strongly typed `params` — no `any`
- [ ] Wire `WidgetRenderer` into `MessageBubble.tsx` — assistant messages
  render a widget, user messages render plain text
- [ ] Add a fallback for unknown widget types (render error card, don't crash)
- [ ] Create stub components for each widget (just render the widget name + params
  as JSON for now — you'll build the real ones next)

#### Checkpoint question
> "What happens if you add a new widget type but forget to add it to `WIDGET_REGISTRY`?
> How would TypeScript catch this at compile time?"
> (Hint: look up TypeScript `Record<WidgetType, ComponentType>`)

---

### Phase 4 — Kanban Widget
**Estimated time:** 2–3 hours

#### What you'll learn
- How to implement drag-and-drop in React (HTML5 Drag API vs library)
- Controlled vs uncontrolled state in complex UI components
- How to take structured data (columns + tasks from AI) and turn it into interactive UI
- Framer Motion basics: layout animations, presence animations

#### Build
- [ ] Install: `npm install framer-motion`
- [ ] Define `KanbanParams` (this should already exist from Phase 2):
  ```ts
  type KanbanParams = {
    columns: Array<{
      id: string
      title: string
      color: string
      tasks: Array<{ id: string; title: string; priority: 'low' | 'medium' | 'high' }>
    }>
  }
  ```
- [ ] Build `KanbanBoard.tsx`:
  - 4 columns: Todo, Doing, Blocked, Done
  - Task cards with priority badges
  - Drag tasks between columns (use `@hello-pangea/dnd` or HTML5 drag API)
  - `AnimatePresence` from Framer Motion for card enter/exit
- [ ] Add column task count badge
- [ ] Test with the prompt: "Plan my next 2 weeks of LeetCode prep"

#### Intentional challenge (don't skip)
Implement drag-and-drop yourself using the native HTML5 Drag API (`onDragStart`,
`onDragOver`, `onDrop`) before reaching for a library. Even if it's rough — doing
it once makes you understand what DnD libraries actually solve.

#### Checkpoint question
> "When a user drags a card, where does the state live? The `KanbanBoard` component?
> The `ChatWindow`? Why does it matter?"

---

### Phase 5 — Chart Dashboard Widget
**Estimated time:** 2–3 hours

#### What you'll learn
- Recharts API: composable chart components, responsive containers, custom tooltips
- How to display mixed data types (KPI numbers + charts + tables) in one component
- CSS Grid for dashboard-style layouts
- How to make data feel alive with small animation touches

#### Build
- [ ] Define `DashboardParams`:
  ```ts
  type DashboardParams = {
    kpis: Array<{ label: string; value: string; change: string; trend: 'up' | 'down' | 'flat' }>
    chart: { type: 'bar' | 'line' | 'area'; title: string; data: Array<Record<string, unknown>> }
    table?: { headers: string[]; rows: string[][] }
  }
  ```
- [ ] Build `ChartDashboard.tsx`:
  - KPI cards row at top (with trend arrow + color)
  - Recharts `AreaChart` or `BarChart` below
  - Optional data table at bottom
  - Fully responsive using `ResponsiveContainer`
- [ ] Add `ReferenceLine` and `Tooltip` customization to the chart
- [ ] Test with: "Show me a dashboard for my stock portfolio with IRCTC, RVNL, and ITC"

#### Checkpoint question
> "Why does Recharts need `ResponsiveContainer`? What breaks without it?"

---

### Phase 6 — Gravity Visualizer Widget (3D)
**Estimated time:** 3–4 hours

#### What you'll learn
- How react-three-fiber (R3F) maps Three.js concepts to React components
- The R3F render loop: `useFrame` hook, animation per tick
- How to do basic physics simulation in a render loop (not a physics engine — just math)
- `@react-three/drei` helpers: `OrbitControls`, `Stars`, `Html` overlays
- Gravitational physics: F = Gm₁m₂/r² — you'll implement this directly

#### Build
- [ ] Install: `npm install @react-three/fiber @react-three/drei three`
- [ ] Define `GravityParams`:
  ```ts
  type GravityParams = {
    bodies: Array<{
      name: string
      mass: number        // relative units
      radius: number      // display size
      color: string
      initialPosition: [number, number, number]
      initialVelocity: [number, number, number]
    }>
    showForceArrows: boolean
    showOrbitalPaths: boolean
  }
  ```
- [ ] Build `GravityScene.tsx` using R3F `<Canvas>`:
  - Render each body as a `<mesh>` with `<sphereGeometry>`
  - `useFrame` hook to advance simulation each tick (Euler integration is fine for MVP)
  - Trail lines for orbital paths using `Line` from drei
  - `<OrbitControls>` so the user can rotate the scene
  - `<Stars>` background
  - Pause/play button using `useRef` on animation state
- [ ] Add sliders (HTML overlay via `<Html>` in R3F) for mass and initial velocity

#### Intentional challenge (don't skip)
Before using `@react-three/drei`'s `Line` for trails, implement your own trail
by storing the last N positions in a `useRef` array and drawing them manually.
This forces you to understand the R3F render loop.

#### Checkpoint question
> "What is `useFrame` and why can't you just use `useEffect` + `setInterval`
> to animate a Three.js scene in R3F?"

---

### Phase 7 — Polish & Ship
**Estimated time:** 2 hours

#### What you'll learn
- How to write demo prompts that reliably trigger each widget path
- Framer Motion's `layout` prop and `AnimatePresence` for chat transitions
- Vercel deploy config for Next.js with API routes
- How to write a README that explains a project clearly (hiring managers read these)

#### Build
- [ ] Add Framer Motion transitions:
  - Messages fade+slide in from bottom
  - Widget components scale in on mount
  - `layout` animation so the chat list reflows smoothly
- [ ] Build a "suggested prompts" row above the input for first-time users
  (3 buttons, one per widget type)
- [ ] Add a loading skeleton while widget data is being generated
  (different from the text streaming loader)
- [ ] Error boundary around `WidgetRenderer` — widget crash shouldn't kill the chat
- [ ] Set environment variables on Vercel (`ANTHROPIC_API_KEY`)
- [ ] Write a README:
  - What it is (2 sentences)
  - Demo GIF or screenshot
  - How to run it locally
  - How the widget protocol works (the JSON schema)
  - What you'd build next

---

## Learning Checkpoints Summary

| Phase | Core Concept |
|---|---|
| 0 | Next.js App Router: server vs client components |
| 1 | AI streaming via SSE, `useChat` hook |
| 2 | Structured LLM output, Zod schemas, discriminated union types |
| 3 | Registry pattern for extensible component routing |
| 4 | Drag-and-drop state, Framer Motion |
| 5 | Recharts composable API, responsive data viz |
| 6 | react-three-fiber render loop, `useFrame`, basic physics |
| 7 | Polish, error handling, deploy, writing |

---

## What to Build Next (after MVP)

- **Streaming widget data** — stream the AI response and progressively render the widget
  as data arrives (harder than it sounds; look into `streamObject()` in Vercel AI SDK)
- **Widget persistence** — save conversations with widget state to localStorage or a DB
- **More widgets:** code execution sandbox, map visualizer, markdown doc renderer
- **Multi-step agent** — widget that can call tools (web search, calculator) before
  rendering its final output

---

## Pitch Line

> A streaming conversational AI interface that renders structured interactive
> visual experiences inline in chat — built on a reusable, type-safe widget
> protocol using Next.js, Vercel AI SDK, and react-three-fiber.
