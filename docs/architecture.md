# Architecture

NTOPIA is a **Tauri v2 desktop client**. Auth and team data live in a separate **[team-orbit](https://github.com/cyborgoat/team-orbit)** backend; this repo only talks to it through `@goatcheese/teamorbit-client`. Local gadgets (email, notes, links, timer) and Todo work without signing in.

## Stack

| Layer | Choice |
|--------|--------|
| Shell | Tauri v2 (`src-tauri/`) |
| UI | React 19, Vite, Tailwind v4, shadcn/ui |
| Routing / data | TanStack Router (hash history), TanStack Query |
| Backend | `@goatcheese/teamorbit-client` → team-orbit HTTP + Socket.io |
| Sidecar | Portable Node + `@goatcheese/mdmailer` for the email gadget |
| Markdown | `@mdxeditor/editor` (WYSIWYG for posts/comments), CodeMirror (email source), `react-markdown` with `remark-gfm`, `remark-math`, `rehype-katex`, `rehype-raw` and `rehype-sanitize` (rendering) |

Boot sequence (`src/main.tsx`): `initStorage` → `QueryClientProvider` → `AuthProvider` → `RouterProvider`.

## Repository layout

```
ntopia/
├── src/                 # React app
│   ├── components/      # AppShell, RequireAuth, shared UI
│   ├── features/        # Standalone local features (Todo)
│   ├── gadgets/         # Local tools (registry + per-gadget modules)
│   ├── hooks/           # Small shared hooks (dark mode, mobile)
│   ├── lib/             # auth, orbit, storage, realtime
│   ├── routes/          # File-based TanStack routes
│   └── main.tsx
├── src-tauri/           # Rust shell, capabilities
├── scripts/             # sync-mdmailer-assets.mjs (vendors email templates)
└── docs/                # Architecture notes (this folder)
```

## High-level flow

```mermaid
flowchart TB
  subgraph client [NTOPIA desktop]
    UI[React UI]
    Shell[AppShell]
    Gadgets[Local gadgets]
    OrbitLib[orbit client]
    Store[plugin-store / localStorage]
    UI --> Shell
    Shell --> Gadgets
    Shell --> OrbitLib
    OrbitLib --> Store
    Gadgets --> Store
    Gadgets --> FS[appData FS]
  end

  subgraph backend [team-orbit]
    API[HTTP API]
    Socket[Socket.io]
  end

  OrbitLib --> API
  OrbitLib --> Socket
```

## Auth and access

Login is **optional**.

| State | What you get |
|--------|----------------|
| Guest (no token) | Home hub, Todo, Gadgets (email, notes, links, timer), and the sign-in / server URL dialog. Team Orbit nav hidden. |
| Signed in | Orbit nav + notifications + home feed. Profile/password in Settings. |

- `_app` always renders `AppShell` after auth bootstrap (`src/routes/_app.tsx`). It does **not** redirect guests to `/login`.
- Orbit-only pages wrap content in `RequireAuth` (`src/components/require-auth.tsx`) so deep links show a sign-in prompt instead of failing API calls.
- Token and server URL persist via `src/lib/storage.ts` (Tauri `plugin-store` `ntopia.json`, or `localStorage` in the browser).
- HTTP 401 (except login) clears the session through `setUnauthorizedHandler` in `src/lib/auth.tsx`.
- Live notifications: `useNotificationsSocket` connects only when a token is present (`src/lib/realtime.ts`).

Sidebar (`src/components/app-shell.tsx`):

- **Always:** Home, Todo, Gadgets
- **When signed in:** Team Orbit group (Announcements, Events, News, Blog, Discussions), Notifications, user avatar
- **When guest:** Sign in → `/login`

## Routes

List pages use shared [`FeedCard`](../src/components/feed-card.tsx) rows (title `text-sm font-semibold`, meta `text-xs`, `space-y-2` stack) and link into [`DetailPage`](../src/components/detail-page.tsx) (`text-xl` title, `space-y-5`). Announcements, events, news, blog, and discussions share that chrome; create stays type-specific (`FormDialog` for short structured types, `PostComposer` for Markdown). Pages register breadcrumbs into the shell header with `usePageCrumbs` (`src/components/page-chrome.tsx`).

File routes under `src/routes/`; generated tree in `src/routeTree.gen.ts`.

| Area | Paths | Notes |
|------|--------|--------|
| Public | `/login`, `/register` | Outside the shell; login can “Continue without signing in” |
| Shell | `/_app` → `AppShell` | Pathless layout; URLs stay `/`, `/gadgets`, … |
| Local | `/`, `/gadgets/email`, `/gadgets/notes`, `/gadgets/links`, `/gadgets/timer`, `/todo` | No Orbit API required |
| Orbit | `/announcements`, `/events`, `/news`, `/news/new`, `/blog`, `/blog/new`, `/discussions/*`, `/notifications`; detail pages `/announcements/$id`, `/events/$id`, `/news/$id`, `/blog/$id`, `/discussions/$postId` | Behind `RequireAuth`; `*/new` composers are full-bleed (`FULL_BLEED` in `app-shell.tsx`) |

### Orbit feature notes (`@goatcheese/teamorbit-client` ≥ 0.2.3)

- **Events:** create supports `audience` `GLOBAL` \| `INVITE_ONLY` plus `recipientIds` via [`UserPicker`](../src/components/user-picker.tsx); detail shows invitees.
- **Notifications:** Unread / Read tabs via `status=unread|read`; mark unread (`DELETE …/read`), mark-all-read, dismiss. Dismissed items are not shown in the app (maintainer-only). Unread badges use `status=unread` + `total`.
- **Views:** news, blog, and forum detail (and discussion list) surface `viewCount`.

## Key libraries (`src/lib/`)

| Module | Role |
|--------|------|
| `orbit.ts` | Creates the Team Orbit client; Tauri HTTP fetch (avoids webview CORS); `resetOrbit` after server URL changes |
| `auth.tsx` | `AuthProvider` / `useAuth` — login, register, logout, `user`, `token`, `isAdmin` |
| `storage.ts` | Sync in-memory cache over plugin-store / localStorage |
| `realtime.ts` | Socket.io notifications → toast, query invalidation, native alert when unfocused |

## Markdown editing

- `src/components/markdown-editor.tsx` — the one Markdown editor: MDXEditor (WYSIWYG, markdown shortcuts, rich-text/source toggle). `variant="full"` for posts, `"compact"` for comments (Mod+Enter submits). Pass `imageUploadHandler` to enable paste/drop/toolbar images and `imagePreviewHandler` to map stored `src`s to displayable URLs. It's uncontrolled internally; `value` changes from outside (resets, template loads) are pushed in with `setMarkdown`.
- `src/components/post-composer.tsx` — full-page composer (title, tags, cover, editor) behind `/news/new`, `/blog/new` and `/discussions/new`. Images upload to Orbit `/uploads`. Posts can't be edited after publishing (the API has no update endpoint).
- `.prose-ntopia` in `src/index.css` is shared by `<Markdown>` and the editor so drafts look like the published post. `.md-editor-root` maps MDXEditor's `--base*` variables to the app's theme tokens.

## Gadgets

Gadgets are small local tools under the Gadgets sidebar menu. Register one in `src/gadgets/registry.ts` and add `src/routes/_app/gadgets.<id>.tsx`. First-class local features (Todo) stay in `src/features/` with their own nav item — see [gadgets.md](./gadgets.md).

Built-ins: **email** (in-process mdmailer-core), **notes** (`gadget-notes` store with folders + trash, Markdown editor, full-bleed resizable sidebar), **links** (`gadget-links` store + system browser), **timer** (in-session countdown).

### Email composer (`/gadgets/email`)

- Implementation: `src/gadgets/email/mdmailer/` + route UI. `engine.ts` runs `@goatcheese/mdmailer-core` in the webview (lazy-loaded): `renderEmail` → hidden iframe → `postProcessDocument` → `buildEml`, and `html-to-image` for PNG; `image-io.ts` supplies image access (Tauri fs + canvas).
- The document is held as `meta` (frontmatter) + `body`, joined with `joinDoc` (`frontmatter.ts`) for preview/export. The body is edited as raw Markdown in `source-editor.tsx` (CodeMirror, with a formatting toolbar, ⌘B/⌘I/⌘K, and image import via button, paste or drop) — not the shared WYSIWYG `MarkdownEditor`. Frontmatter is edited in `details-panel.tsx`: a one-line summary that expands into a form whose fields come from `fields.ts` (per `type`, including hosts and agenda), plus "Edit as YAML". Keys the form doesn't know about are kept and shown under "Other fields".
- `stringifyMeta` writes YAML 1.1-safe text, because mdmailer parses frontmatter with js-yaml (YAML 1.1), where an unquoted `15:00` would become the number 900.
- Images in the editor (pasted ones, template host photos) are relative to `work/` and shown through `mm.workAssetUrl` (blob URLs).
- Scratch workspace under app data: `email/work/`, `email/out/`, branding JSON, pasted images in `work/assets/pasted/`.
- Templates and sample host photos are vendored into `src/gadgets/email/mdmailer/{templates,assets}` (`pnpm sync:mdmailer`); sample photos are copied into `work/assets/` on first use.

### Home (`/`)

Greeting plus two columns: the **Today** panel (`src/features/todo/today-panel.tsx`: overdue and due-today tasks, quick add; works offline) and, when signed in, the Team Orbit digest (`src/components/home-digest.tsx`: unread notifications, announcements, upcoming events, latest news/blog posts, discussions). Guests see the sign-in banner in place of the digest. Items newer than the previous visit get a dot (`homeLastSeen` storage key).

### Todo list (`/todo`)

A dedicated sidebar feature, not a gadget.

- Implementation: `src/features/todo/` (`store.ts`, `group.ts` for the weekly grouping, `reminders.ts`, `todo-dialog.tsx`) + route UI.
- Persists `{ id, title, done, createdAt, dueDate?, dueTime?, remind?, notes?, location?, flagged?, urgency?, tags?, remindedAt? }[]` under the `todos` storage key (loaded at boot with `serverUrl` / `token`). Older items without the optional fields still load. `urgency` is `low` | `medium` | `high`; `tags` is a string array.
- The list is grouped Overdue → Today → the remaining weekdays of the current Mon–Sun week → Upcoming → No date → Completed.
- Reminders: `useTodoReminders()` (mounted in `routes/_app.tsx`) checks every 30 s and fires a native notification plus a toast once per item. They only fire while the app is running; ones missed while closed fire on launch.

## Context menus

Desktop right-click menus use shadcn [`context-menu`](https://ui.shadcn.com/docs/components/base/context-menu) (`src/components/ui/context-menu.tsx`). They mirror actions already on the page (no new APIs):

| Surface | Actions |
|---------|---------|
| Todo rows / list | Edit, toggle, flag, delete; focus add / clear completed |
| Email editor & preview | Open in Mail, export formats, copy HTML |
| Notifications | Open; mark read / unread / dismiss (by tab) |
| Announcements / events / news / blog | Copy title; Delete if `isAdmin` |
| Discussion threads | Open, copy link |
| Discussion post / comments | Vote, reply |

When adding a new list surface, wrap rows with `ContextMenu` / `ContextMenuTrigger` and keep admin items behind `isAdmin`.

## Tauri surface

- Capabilities in `src-tauri/capabilities/default.json` scope FS (`$APPDATA`, common user folders), HTTP, dialog, notifications, store.

## Related docs

- [Gadgets](./gadgets.md) — how to add a gadget
- Root [README](../README.md) — run instructions and overview
