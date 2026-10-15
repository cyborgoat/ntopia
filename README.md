# NTOPIA

Desktop team hub: optional Team Orbit sign-in for announcements, events, news, blog, discussions, and live notifications — plus **local gadgets** (email composer, todo list) that work offline without an account.

Built with **Tauri v2**, **React + TanStack Router/Query**, **Tailwind v4 + shadcn/ui**.

NTOPIA is only a client. Auth and team data come from **[team-orbit](https://github.com/cyborgoat/team-orbit)** through `@goatcheese/team-orbit-client` — nothing from team-orbit is vendored or imported by path.

## Docs

- [Architecture](docs/architecture.md) — stack, auth model, routes, libs, sidecar
- [Gadgets](docs/gadgets.md) — built-in tools and how to add one

## Run

```bash
# 1. backend (optional — only needed for Team Orbit features)
cd ../team-orbit/api && npm install && npx prisma migrate dev && npx prisma db seed && npm run start:dev

# 2. app (Node 20+, Rust, pnpm)
pnpm install
pnpm tauri:dev        # prepares the mdmailer sidecar, then launches the app
```

You can use Home and Gadgets immediately without signing in. To unlock Team Orbit features, sign in at the server URL on the login screen (default `http://localhost:3000`), e.g. `admin@teamorbit.local` / `password123`. USER accounts are read/discuss only; ADMIN/SUPERUSER can publish.

## Gadgets

### Email (`/gadgets/email`)

One-shot composer — pick a template or edit Markdown (live HTML preview via mdmailer's `preview` server), then export HTML / EML / PNG / Markdown or open `.eml` in the mail client. Branding dialog for org, color, logo, and theme. Paste images into the editor to save them under the scratch `work/assets/pasted/` folder (relative Markdown paths). No draft library; the scratch working file is used only while the tool is open.

mdmailer needs native modules (sharp) and Puppeteer, so it can't be compiled into a single binary. `pnpm sidecar` (`sidecar/mdmailer/build.mjs`) downloads a portable Node runtime into `src-tauri/binaries/` (Tauri `externalBin`) and copies mdmailer + `node_modules` into `src-tauri/resources/mdmailer/`. The app runs `node …/cli.js preview` for live preview and generate for export/PNG against a scratch file in app-data. Puppeteer downloads Chrome on first PNG render if none is found. Run `pnpm sidecar` before `pnpm tauri build`.

### Todo (`/gadgets/todo`)

Local checklist stored on this device via `plugin-store` / localStorage. No server required.

## Layout

- `src/lib` — orbit client + token/server storage (`plugin-store`), auth, realtime (Socket.io)
- `src/routes` — file-based routes; `_app/*` is the app shell (guests allowed; Orbit pages use `RequireAuth`)
- `src/gadgets` — `registry.ts` lists gadgets; add a route + registry entry for a new one
- `src-tauri` — Rust shell, capabilities (least-privilege fs/shell/http scopes)
- `docs/` — architecture and gadget authoring notes

## Not yet

Real chat channels/DMs (discussions use team-orbit's forum until team-orbit gains chat), auto-update, code signing, mobile.
