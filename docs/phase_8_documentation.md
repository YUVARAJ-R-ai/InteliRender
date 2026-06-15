# Phase 8 — Responsive Layout, Personalization System & Light Theme

This document records every change made during Phase 8 of IntelliRender development. Phase 8 covered three major areas: mobile-responsive layout, a wired-up personalization/settings system with live theme and font-size switching, and a full light-theme palette remap — plus one production build fix.

Issues closed: **#32** (responsive layout), **#33** (working personalization settings).

---

## 1. Mobile-Responsive Sidebar Layout

### Problem
The app had no viewport meta tag and the sidebar was always visible, making the layout broken on screens narrower than ~900px. There was no way to collapse the sidebar on mobile.

### Solution
Added a viewport meta tag, a mobile hamburger button, a slide-in sidebar with an overlay, and a `max-width` cap on the main container.

**Files changed:**

- **`app/layout.tsx`**
  - Added `<meta name="viewport" content="width=device-width, initial-scale=1" />` in `<head>`

- **`app/page.tsx`**
  - Added `sidebarOpen` state (`useState(false)`)
  - Sidebar wrapper changed from static to conditionally translated:
    ```tsx
    className={`fixed inset-y-0 left-0 z-40 transition-transform duration-300
      md:static md:translate-x-0
      ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
    ```
  - Added a semi-transparent overlay that closes the sidebar on tap:
    ```tsx
    {sidebarOpen && (
      <div
        className="fixed inset-0 bg-black/50 z-30 md:hidden"
        onClick={() => setSidebarOpen(false)}
      />
    )}
    ```
  - Main content container wrapped in `max-w-[2400px] mx-auto`
  - Passed `onMenuClick={() => setSidebarOpen(true)}` to `<ChatWindow>`

- **`components/chat/ChatWindow.tsx`**
  - Added `onMenuClick?: () => void` to `ChatWindowProps`
  - Added hamburger button in the header, visible only on mobile:
    ```tsx
    {onMenuClick && (
      <button onClick={onMenuClick} className="md:hidden p-1.5 ...">
        <Menu className="w-4 h-4" />
      </button>
    )}
    ```
  - Header padding changed to `px-4 md:px-6` for tighter mobile fit

---

## 2. Personalization & Settings System (SettingsContext)

### Problem
`SettingsModal.tsx` had its own local `useState` for settings that was not shared with the rest of the app — theme and font-size changes had no effect on anything outside the modal. The "Personalization" item in `UserMenu.tsx` also had no `onClick` and opened nothing.

### Solution
Extracted settings into a React Context with a persistent localStorage store, wired the modal to consume it, and wired the `UserMenu` to open the modal to the correct section.

**Files created:**

- **`lib/settings-context.tsx`** *(new)*
  - Exports `Settings` interface, `SETTINGS_DEFAULTS`, `SettingsProvider`, and `useSettings()`
  - `SettingsProvider` reactively applies changes to `<html>`:
    - Theme → toggles `.dark`/`.light` class and `data-theme` attribute on `document.documentElement`
    - Font size → sets `--ir-font-size` CSS variable (`sm`: 0.8125rem, `md`: 0.9375rem, `lg`: 1.0625rem)
    - Listens to `window.matchMedia('(prefers-color-scheme: dark)')` when theme is `system`
  - Reads and writes `localStorage` key `ir_settings`

**Files changed:**

- **`app/layout.tsx`**
  - Wrapped `{children}` with `<SettingsProvider>`
  - Added `suppressHydrationWarning` to `<html>` (prevents React hydration mismatch from inline script)
  - Added inline no-flash bootstrap script in `<head>` that runs synchronously before React hydrates:
    ```ts
    const themeScript = `(function(){
      try {
        var s = JSON.parse(localStorage.getItem('ir_settings') || '{}');
        var t = s.theme || 'dark';
        var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.classList.toggle('dark', dark);
        document.documentElement.classList.toggle('light', !dark);
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
        var fs = { sm: '0.8125rem', md: '0.9375rem', lg: '1.0625rem' };
        document.documentElement.style.setProperty('--ir-font-size', fs[s.fontSize] || '0.9375rem');
      } catch(e) {}
    })();`
    ```
    This ensures the correct theme class is on `<html>` before the first paint — no flash of wrong theme.

- **`components/SettingsModal.tsx`**
  - Removed the local `Settings` interface and `DEFAULTS` constant (moved to `settings-context.tsx`)
  - Removed `useState(DEFAULTS)` and the two `useEffect` hooks for localStorage
  - Added `import { useSettings } from '@/lib/settings-context'`
  - Now calls `const { settings, set } = useSettings()` — changes are immediately live

- **`components/UserMenu.tsx`**
  - Added `settingsSection` state (`useState<Section>('Appearance')`)
  - Added `openSettings(section: Section)` helper that sets the section then shows the modal
  - "Personalization" menu item: `onClick={() => openSettings('Appearance')}` — opens Settings directly to the Appearance tab
  - "Settings" menu item: `onClick={() => openSettings('Workspace')}` — opens Settings to Workspace tab

- **`components/chat/MessageBubble.tsx`**
  - Changed message text size from hard-coded Tailwind class `text-[0.9375rem]` to inline style:
    ```tsx
    style={{ fontSize: 'var(--ir-font-size)' }}
    ```
    This makes font-size changes from Settings apply to all message bubbles in real time.

---

## 3. Light Theme Palette Remap

### Problem
The entire UI uses hardcoded Tailwind arbitrary-value classes (`bg-[#1a1a1a]`, `text-[#E8EDF2]`, etc.) rather than semantic CSS variables. Simply toggling a theme class on `<html>` had no visual effect because no CSS variables drove those colours.

### Debugging — Why CSS Selectors Were Failing

Two approaches were tried before the working one:

**Attempt 1 — Tailwind escaped-class selectors:**
```css
html.light .bg-\[\#1a1a1a\] { background-color: #fff; }
```
These were stripped by the Lightning CSS compiler (Tailwind v4's build tool). They do not survive compilation.

**Attempt 2 — Attribute selectors lost to edit conflict:**
The correct `[class~="…" i]` selectors were written but then accidentally overwritten in a subsequent edit pass.

**Root cause also included stale `.next` cache** — the dev server was serving a bundle built before any of the CSS changes. The fix: `rm -rf .next && npm run dev`.

### Working Solution

Unlayered CSS rules with `[class~="value" i]` attribute selectors. These:
1. Are **not** Tailwind utilities — they are plain CSS — so Lightning CSS leaves them alone
2. Case-insensitively match the `class` token (e.g. `bg-[#1a1a1a]` and `bg-[#1A1A1A]`)
3. Have higher specificity than Tailwind's `@layer utilities` rules, so they override without needing `!important`

**File changed: `app/globals.css`** — added at the end, lines ~305–361:

```css
/* Surfaces — background */
html.light [class~="bg-[#1a1a1a]" i]  { background-color: #ffffff; }
html.light [class~="bg-[#1A1C1E]" i]  { background-color: #ffffff; }
html.light [class~="bg-[#1F2226]" i]  { background-color: #f4f6f8; }
html.light [class~="bg-[#111214]" i]  { background-color: #f4f6f8; }
html.light [class~="bg-[#141618]" i]  { background-color: #f4f6f8; }
html.light [class~="bg-[#141414]" i]  { background-color: #f4f6f8; }
html.light [class~="bg-[#161616]" i]  { background-color: #f0f2f5; }
html.light [class~="bg-[#1e1e1e]" i]  { background-color: #eceef1; }
html.light [class~="bg-[#1e2023]" i]  { background-color: #eceef1; }
html.light [class~="bg-[#242424]" i]  { background-color: #edeff2; }
html.light [class~="bg-[#2a2a2a]" i]  { background-color: #e0e3e8; }
html.light [class~="bg-[#2D2F33]" i]  { background-color: #eceef1; }
html.light [class~="bg-[#2e2e2e]" i]  { background-color: #d7dbe1; }
html.light [class~="bg-[#3a3a3a]" i]  { background-color: #c6ccd4; }

/* Surfaces — borders */
html.light [class~="border-[#242424]" i] { border-color: #e0e3e8; }
html.light [class~="border-[#2a2a2a]" i] { border-color: #dadee4; }
html.light [class~="border-[#2e2e2e]" i] { border-color: #d2d6dd; }
html.light [class~="border-[#3a3a3a]" i] { border-color: #c6ccd4; }
html.light [class~="border-[#1e1e1e]" i] { border-color: #e6e8ec; }

/* Text */
html.light [class~="text-[#E8EDF2]" i] { color: #1a1c1e; }
html.light [class~="text-[#C8CDD3]" i] { color: #3c4043; }
html.light [class~="text-[#9CA3AF]" i] { color: #5f6368; }
html.light [class~="text-[#A5A299]" i] { color: #5f6368; }
html.light [class~="text-[#6B7280]" i] { color: #6e7378; }
html.light [class~="text-[#4B5563]" i] { color: #9aa0a6; }

/* Markdown prose — flip prose-invert to light prose */
html.light .prose-invert {
  --tw-prose-body: #1a1c1e;
  --tw-prose-headings: #0b0c0d;
  --tw-prose-bold: #0b0c0d;
  --tw-prose-links: #1a73e8;
  --tw-prose-quotes: #3c4043;
  --tw-prose-bullets: #9aa0a6;
  --tw-prose-counters: #6e7378;
  --tw-prose-hr: #dee1e6;
  --tw-prose-th-borders: #c6ccd4;
  --tw-prose-td-borders: #dee1e6;
  color: #1a1c1e;
}

/* Scrollbars */
html.light ::-webkit-scrollbar-thumb       { background: #c6ccd4; }
html.light ::-webkit-scrollbar-thumb:hover { background: #aab2bd; }
```

The palette maps the "Midnight Focus" dark UI to a blue-grey light palette inspired by Google Material You / productivity apps — off-white surfaces grading through `#f4f6f8 → #eceef1 → #edeff2 → #e0e3e8` with near-black text `#1a1c1e`.

---

## 4. Drawer `position: fixed` Containing-Block Bug

### Problem
The Settings `Drawer` component was visually clipped to the 240px sidebar width instead of covering the full viewport. The close overlay was also clipped, making the drawer impossible to close.

### Root Cause
The sidebar wrapper in `app/page.tsx` uses `transition-transform` + `translate-x-*` Tailwind classes. **Any element with a CSS `transform` applied becomes the containing block for all `position: fixed` descendants** — a CSS spec behaviour, not a browser bug. The `Drawer` rendered inside the sidebar, so `position: fixed` was fixed relative to the 240px sidebar, not the viewport.

### Fix — `createPortal` in `components/Drawer.tsx`

```tsx
import { createPortal } from 'react-dom';

export function Drawer({ ... }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120]">
      {/* overlay + panel */}
    </div>,
    document.body
  );
}
```

Rendering into `document.body` escapes all ancestor containing blocks. The `mounted` guard prevents SSR from calling `document.body` (which doesn't exist on the server).

---

## 5. Production Build Fix — Regex `s` Flag

### Problem
`next build` failed with:

```
Type error: app/api/chats/[id]/title/route.ts(44,43):
  error TS2339: ... Regular expression flags are not supported in this target environment
```

### Root Cause
Line 44 used `/\n.*/s` — the `s` (dotAll) flag requires ES2018+, but `tsconfig.json` targets an earlier ES version.

### Fix — `app/api/chats/[id]/title/route.ts` line 44

```ts
// Before
title = text.replace(/["'`*]/g, '').replace(/\n.*/s, '').trim().slice(0, 60);

// After
title = text.replace(/["'`*]/g, '').replace(/\n[\s\S]*/, '').trim().slice(0, 60);
```

`[\s\S]*` matches any character including newlines without needing the `s` flag — functionally identical.

---

## 6. Light Theme — Interactive State Variants

### Problem
The Section 3 remap only covered base `bg-`/`border-`/`text-` classes. The `hover:`/`focus:` prefixed variants were intentionally skipped, so hovering any control in light mode flashed the original dark surface (e.g. `hover:bg-[#242424]` turned a button dark-grey on hover).

### Audit
A grep of `app/` + `components/` surfaced every prefixed dark variant in use:

| Class | Count |
|---|---|
| `hover:text-[#E8EDF2]` | 12 |
| `hover:text-[#9CA3AF]` | 9 |
| `hover:bg-[#242424]` | 7 |
| `hover:bg-[#1e2023]` | 6 |
| `hover:text-[#C8CDD3]` | 3 |
| `hover:bg-[#2a2a2a]` | 3 |
| `hover:border-[#3a3a3a]`, `hover:bg-[#2e2e2e]`, `hover:bg-[#3D3F43]` | 2 each |
| `hover:bg-[#1e1e1e]`, `hover:bg-[#1a1a1a]`, `group-hover:text-[#E8EDF2]` | 1 each |

### Fix — `app/globals.css`
Each state variant gets a rule that matches the literal class token **and re-applies the pseudo-class**, so the override only fires on the actual interaction rather than painting the surface permanently:

```css
html.light [class~="hover:bg-[#242424]" i]:hover { background-color: #e0e3e8; }
html.light [class~="hover:text-[#E8EDF2]" i]:hover { color: #1a1c1e; }
/* …etc for every variant above… */
```

> **Key gotcha:** `[class~="hover:bg-[#242424]" i]` *without* the trailing `:hover` would apply the background unconditionally (the attribute selector only checks the class is present). The `:hover` / `:focus` / `:focus-visible` suffix is required.

---

## 7. Accent Color Wiring

### Problem
`settings.accentColor` was persisted to localStorage by the Settings swatch picker but had no effect — the UI hardcodes the accent `#8AB4F8` in 50+ places and nothing read the stored value.

### Fix
Routed all `#8AB4F8` usages through a `--ir-accent` CSS variable, driven by the swatch.

**`app/globals.css`:**
- Added `--ir-accent: #8AB4F8;` default to `:root`
- Rerouted base and state variants (theme-agnostic — applies in both light and dark):
  ```css
  [class~="text-[#8AB4F8]" i]              { color: var(--ir-accent); }
  [class~="bg-[#8AB4F8]" i]                { background-color: var(--ir-accent); }
  [class~="hover:bg-[#8AB4F8]/10" i]:hover { background-color: color-mix(in srgb, var(--ir-accent) 10%, transparent); }
  [class~="focus:ring-[#8AB4F8]/20" i]:focus { --tw-ring-color: color-mix(in srgb, var(--ir-accent) 20%, transparent); }
  /* …border/ring/opacity variants likewise… */
  ```
  Opacity variants (`/10`, `/40`, `/90`) use `color-mix(in srgb, var(--ir-accent) N%, transparent)` since the alpha can no longer be baked into a literal hex.

**`lib/settings-context.tsx`:** added a `useEffect` that sets `--ir-accent` from `settings.accentColor`.

**`app/layout.tsx`:** the no-flash bootstrap script now also applies `--ir-accent` from stored settings before first paint.

---

## 8. Pending Work (Not Yet Implemented)

### Light Mode Palette Aesthetics
Current palette is functional but the user has noted it looks unattractive. The surfaces are flat grey — a future pass should introduce warmer tones or a more designed hierarchy (e.g. a tinted sidebar vs. pure-white chat area).

---

## Summary of Files Changed

| File | Change |
|---|---|
| `lib/settings-context.tsx` | **New** — SettingsProvider + useSettings hook |
| `app/layout.tsx` | Viewport meta, no-flash script, SettingsProvider wrapper, suppressHydrationWarning |
| `app/page.tsx` | Mobile sidebar state, overlay, translateX toggle, max-width cap |
| `components/chat/ChatWindow.tsx` | Hamburger button (mobile), onMenuClick prop, header padding |
| `components/SettingsModal.tsx` | Removed local state; uses useSettings() |
| `components/UserMenu.tsx` | Wired Personalization + Settings menu items to open modal |
| `components/Drawer.tsx` | createPortal to document.body + mounted guard |
| `components/chat/MessageBubble.tsx` | Font size driven by --ir-font-size CSS variable |
| `app/globals.css` | Light theme palette remap (base + hover/focus state variants), accent routing via --ir-accent, --ir-font-size root variable |
| `app/api/chats/[id]/title/route.ts` | Regex s-flag → [\s\S] for pre-ES2018 build |
