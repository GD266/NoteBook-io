# AGENTS.md

## Commands

- Use npm (`package-lock.json` is the lockfile). Node 20.19+ / 22.12+.
- `npm install` — install dependencies.
- `npm run dev` — Vite dev server.
- `npm run build` — runs `tsc -b`, then builds production assets into `dist/`.
- `npx tsc -b` — typecheck only; there is no `typecheck` script.
- `npm run lint` — oxlint (`react`, `typescript`, `oxc` plugins).
- There are no tests, test runner, CI workflows, ESLint, or Prettier config. Don't invent a test command; verify with typecheck + lint.

## Architecture

- React 19 + TypeScript + Vite SPA. No backend, network calls, or accounts: all notes and settings live in `localStorage`.
- `src/App.tsx` owns UI state (sidebar, dialogs, resolved theme) and global shortcuts. Note state and persistence live in `src/hooks/useNotebook.ts`.
- The sidebar has two states: `sidebarOpen` drives the mobile overlay and `sidebarCollapsed` drives the desktop panel. The top bar toggle switches whichever state applies.
- `useNotebook` writes immediately for create/select/delete/settings. Title and content edits are debounced by 600 ms (`SAVE_DELAY_MS`) and flushed on blur, `pagehide`, `beforeunload`, and `visibilitychange`.
- `src/lib/storage.ts` is the only module touching `localStorage`, under the `notebook.io/v1` key. It defensively parses untrusted data and keeps corrupt payloads at `notebook.io/backup/<timestamp>`. Preserve the key and schema for existing users.
- `persistNotebook` deliberately lets storage/quota errors throw; callers translate them into save status and toasts. Don't swallow them there.
- `src/lib/text.ts` sanitizes editor HTML against a tag allowlist and strips every attribute except validated http(s) links. Sanitize any new HTML before storing or injecting it; never render raw note HTML. URL validation lives in `src/lib/links.ts`.
- `index.html` has an inline pre-paint script that reads `notebook.io/v1` directly to set the theme. Changing the storage key or shape requires updating that script too.

## Editor

- `src/components/Editor.tsx` is a custom `contentEditable` using legacy `document.execCommand` (bold/italic/underline, `formatBlock`, lists) and `queryCommandState`; there is no rich-text library.
- Initial HTML is injected once in `useLayoutEffect` through a ref, and `App` remounts the editor with `key={activeNote.id}` when switching notes. Don't bind `note.content` reactively to the DOM or the caret will jump; update via `onContentChange` / `syncFromDom`.
- Paste and drop insert plain text, except http(s)/`www.` URLs become links. Links are sanitized on save and open in a new tab when clicked. Keep other pasted content plain text unless asked otherwise.
- Shortcuts are split across `App.tsx` (global), `Editor.tsx` (formatting), and `ShortcutsDialog.tsx` (reference). Update all three plus the README table when adding one.

## Styling / UX

- Tailwind v4 is imported, but only a few responsive visibility utilities are used in markup. Visual styling lives in `src/index.css` on CSS custom properties, and surfaces share the flat `.panel` style; add styles there in the existing token pattern.
- Keep the UI cheap to render: no `backdrop-filter`, blur, `mix-blend-mode`, continuous/entrance animations, or large blurred shadows. This is a deliberate low-end-hardware constraint.
- Theme is `data-theme="dark|light"` on `<html>`, with tokens in `html[data-theme=...]` blocks. `App.tsx` also syncs `color-scheme` and the `theme-color` meta tag.
- Reuse `Dialog` (`src/components/Dialog.tsx`) for modals: it supplies the portal, focus trap, Escape handling, and scroll lock. Icons come from `lucide-react`.

## Conventions

- `verbatimModuleSyntax` is on: use `import type` for type-only imports.
- `erasableSyntaxOnly` is on: no enums, namespaces, or parameter properties.
- `strict` is not enabled; don't rely on strict null checks, and don't flip it on as a drive-by change.
- Components are named exports (`export function X`) except `App`. Imports are relative; there are no path aliases.
- Component files should export components only (`react/only-export-components`). Put shared contexts/constants in separate files like `toast-context.ts`.
- Style matches the existing source: no semicolons, single quotes, 2-space indent.
