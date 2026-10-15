# NTOPIA

An all-in-one team hub for the desktop: announcements, events, news, blog, discussions, live notifications, and small **gadgets** (starting with a Markdown → branded email composer).

Built with **Tauri v2**, **React + TanStack Router/Query**, **Tailwind v4 + shadcn/ui**.

NTOPIA is only a client. Auth and data come from **[team-orbit](https://github.com/cyborgoat/team-orbit)**, a separate project, through `@goatcheese/team-orbit-client` — nothing from team-orbit is vendored or imported by path.

## Run

```bash
# 1. backend (separate repo)
cd ../team-orbit/api && npm install && npx prisma migrate dev && npx prisma db seed && npm run start:dev

# 2. app (Node 20+, Rust, pnpm)
pnpm install
pnpm tauri:dev        # prepares the mdmailer sidecar, then launches the app
```

Sign in at the server URL shown on the login screen (default `http://localhost:3000`), e.g. `admin@teamorbit.local` / `password123`. USER accounts are read/discuss only; ADMIN/SUPERUSER can publish.

## Email gadget

`/gadgets/email`: drafts list, CodeMirror Markdown editor with a frontmatter form, live HTML preview and PNG card, export of HTML / EML / PNG (or all), open `.eml` in the mail client, and a branding dialog (org, color, logo, theme).

mdmailer needs native modules (sharp) and Puppeteer, so it can't be compiled into a single binary. `pnpm sidecar` (`sidecar/mdmailer/build.mjs`) downloads a portable Node runtime into `src-tauri/binaries/` (Tauri `externalBin`) and copies mdmailer + `node_modules` into `src-tauri/resources/mdmailer/`. The app runs `node cli.js` against drafts in its app-data folder. Puppeteer downloads Chrome on first PNG render if none is found. Run `pnpm sidecar` before `pnpm tauri build`.

## Layout

- `src/lib` — orbit client + token/server storage (`plugin-store`), auth, realtime (Socket.io)
- `src/routes` — file-based routes; `_app/*` is behind the auth guard
- `src/gadgets` — `registry.ts` lists gadgets; add a route + registry entry for a new one
- `src-tauri` — Rust shell, capabilities (least-privilege fs/shell/http scopes)

## Not yet

Real chat channels/DMs (discussions use team-orbit's forum until team-orbit gains chat), auto-update, code signing, mobile.
