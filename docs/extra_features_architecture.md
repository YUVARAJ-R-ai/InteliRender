# Extra Feature Additions

## Overview
This document outlines the major out-of-scope architectural and UI additions that transformed the IntelliRender proof-of-concept into a production-ready, ChatGPT-style web application.

## 1. Database & Persistence Layer (Docker + PostgreSQL)
To add "memory" to the application, we introduced a persistent database layer.
- **Docker**: A `docker-compose.yml` file was created to spin up an isolated `postgres:15-alpine` container, ensuring the database is portable and runs consistently without local installation friction.
- **ORM Selection**: We initially attempted to use Prisma. However, due to NixOS restrictions surrounding pre-compiled Rust binaries used by the Prisma Engine, we pivoted to **Drizzle ORM**. Drizzle is a purely TypeScript-based ORM that works seamlessly across all Linux environments, including NixOS.
- **Schema**: We defined two primary tables in `lib/db/schema.ts`:
  - `chats`: Represents a session (thread) with an ID, title, and timestamp.
  - `messages`: Stores both user and assistant payloads. Crucially, this table includes a `jsonb` column for the `widget` data, allowing the exact visual widget state to be rehydrated upon reloading the chat.

## 2. Dynamic Sidebar Architecture
To support multiple chat sessions:
- We restructured `app/page.tsx` into a split-pane layout.
- Created `Sidebar.tsx` which fetches and lists all active chat sessions from `GET /api/chats`.
- Implemented a "New Chat" flow that resets the active `chatId` state, forcing the `ChatWindow` to clear the current messages and prepare for a fresh database insertion on the next message send.

## 3. Premium UI & Glassmorphism
The styling was overhauled to mirror modern, premium AI applications.
- **Lighting & Gradients**: Replaced flat backgrounds with deep radial gradients (`bg-[radial-gradient(...)]`) to give depth.
- **Glassmorphism**: Added `backdrop-blur-md` and translucent borders to message bubbles, the input bar, and the sidebar to create a layered "frosted glass" aesthetic.
- **Micro-interactions**: Added glowing focus states behind the input bar (`group-focus-within:opacity-40 blur`), and replaced standard text loaders with animated Lucide-react spinners.

## 4. Message Deletion (Unsend capability)
To make the application feel robust and professional:
- Added a hover-state "Unsend" button (trash icon) specifically for user messages.
- Created a `DELETE /api/messages/[id]` route.
- **Behavior**: Clicking unsend optimistically removes the message from the UI array, while the server cascades the deletion, removing the targeted message and all subsequent messages in that specific chat thread to effectively "rewind" the AI's context.
