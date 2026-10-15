# Gadgets

Gadgets are **local tools** that run inside NTOPIA without Team Orbit. They appear on `/gadgets` and (for guests) on the home hub.

## Built-in

| Id | Route | Storage | Notes |
|----|--------|---------|--------|
| `email` | `/gadgets/email` | App data `email/` + mdmailer sidecar | Markdown → branded HTML / EML / PNG; live preview |
| `todo` | `/gadgets/todo` | `plugin-store` / localStorage key `todos` | Simple checklist |

## Adding a gadget

1. **Module** (optional) under `src/gadgets/<id>/` for persistence or helpers.
2. **Route** `src/routes/_app/gadgets.<id>.tsx` with `createFileRoute("/_app/gadgets/<id>")`.
3. **Registry** entry in `src/gadgets/registry.ts`:

```ts
{
  id: "notes",
  name: "Notes",
  description: "…",
  icon: StickyNote,
  to: "/gadgets/notes",
}
```

4. Let the TanStack Router plugin regenerate `src/routeTree.gen.ts` (or update it to match existing gadget routes), then restart `pnpm tauri:dev` if needed.

If the UI needs the full content pane (like the email composer), add its path to `FULL_BLEED` in `src/components/app-shell.tsx`.

## Persistence choices

| Need | Prefer |
|------|--------|
| Small JSON (lists, prefs) | `src/lib/storage.ts` + a key loaded in `initStorage` (`src/main.tsx`) |
| Files, images, sidecar I/O | Tauri FS under `appDataDir()` (see `src/gadgets/email/mdmailer.ts`) |

Gadgets must not call the Orbit client unless the feature is intentionally Orbit-backed and gated with `RequireAuth` / `useAuth().token`.

## Context menus

For list-style gadgets, add a right-click menu with [`ContextMenu`](../src/components/ui/context-menu.tsx) that reuses the same handlers as visible buttons (see Todo and Email). Prefer additive menus over replacing the toolbar.
