# Gadgets

Gadgets are **local tools** that run inside NTOPIA without Team Orbit. They appear as a collapsible "Gadgets" menu in the sidebar; each entry opens the gadget directly (there is no gadget list page).

**Gadgets vs features:** First-class local features (e.g. Todo at `/todo`) are **not** gadgets. Put those under `src/features/` with their own top-level sidebar entry. Gadgets nest under the Gadgets menu and register in `src/gadgets/registry.ts`.

## Built-in

| Id | Route | Storage | Notes |
|----|--------|---------|--------|
| `email` | `/gadgets/email` | App data `email/` + `@goatcheese/mdmailer-core` (in-process) | Admin and superuser only. Language-first template picker (default templates fixed, user templates addable/deletable) and a help dialog. Markdown → branded HTML / EML / PNG; live preview. Details in [architecture.md](./architecture.md#gadgets). |
| `notes` | `/gadgets/notes` | `plugin-store` key `gadget-notes` | Scratch Markdown notes with folders, soft-delete trash, resizable sidebar |
| `links` | `/gadgets/links` | `plugin-store` key `gadget-links` | Local bookmark shelf; opens in the system browser |

## Adding a gadget

1. **Module** (optional) under `src/gadgets/<id>/` for persistence or helpers.
2. **Route** `src/routes/_app/gadgets.<id>.tsx` with `createFileRoute("/_app/gadgets/<id>")`.
3. **Registry** entry in `src/gadgets/registry.ts`:

```ts
{
  id: "example",
  name: "Example",
  description: "Illustrative registry shape — replace with a real gadget.",
  icon: Wrench,
  to: "/gadgets/example",
}
```

4. Let the TanStack Router plugin regenerate `src/routeTree.gen.ts` (or update it to match existing gadget routes), then restart `pnpm tauri dev` if needed.
5. **Shell layout:** Entering any `/gadgets/<id>` auto-collapses the sidebar (`AutoCollapseForGadgets` in [`app-shell.tsx`](../src/components/app-shell.tsx)). If the UI needs the full content pane (no `max-w-4xl` column), add its path to `FULL_BLEED` in the same file (see email and notes).
6. **Tauri capabilities:** If the gadget needs filesystem, dialogs, shell, opener URLs, etc., extend [`src-tauri/capabilities/default.json`](../src-tauri/capabilities/default.json). Missing scopes often look fine in the browser but fail in the desktop build.

## Persistence choices

| Need | Prefer |
|------|--------|
| Small JSON (lists, prefs) | `src/lib/storage.ts` + a key loaded in `initStorage` (`src/main.tsx`) |
| Files and images | Tauri FS under `appDataDir()` (see `src/gadgets/email/mdmailer.ts`) |

Gadgets must not call the Orbit client unless the feature is intentionally Orbit-backed and gated with `RequireAuth` / `useAuth().token`.

## Context menus

For list-style gadgets, add a right-click menu with [`ContextMenu`](../src/components/ui/context-menu.tsx) that reuses the same handlers as visible buttons (see Todo and Email). Prefer additive menus over replacing the toolbar.
