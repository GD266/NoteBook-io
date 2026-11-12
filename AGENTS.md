# AGENTS.md

## Commands

- Use npm (`package-lock.json` is the lockfile). Node 20.19+ / 22.12+.
- `npm install` — install dependencies.
- `npm run dev` — Vite dev server on port 1420 (`strictPort: true`).
- `npm run build` — runs `tsc -b`, then builds production assets into `dist/`.
- `npm run preview` — serves the built `dist/`; use it to check production-only behavior such as the service worker.
- `npx tsc -b` — typecheck only; there is no `typecheck` script.
- `npm run lint` — oxlint (`react`, `typescript`, `oxc` plugins).
- There is no test runner, ESLint, or Prettier config. Don't invent a test command; verify with `npm run lint` plus `npx tsc -b` (or `npm run build`).
- `npm run desktop:dev` — Tauri v2 dev window; starts Vite through `beforeDevCommand`. Don't also run `npm run dev` (both bind port 1420).
- `npm run desktop:build` — frontend build plus the Rust release build and NSIS installer.
- `npm run tauri -- <args>` — Tauri CLI (for example, regenerate icons with `npm run tauri -- icon public/icons/icon-512.png`).
- `vite.config.ts` uses `strictPort: true` on 1420 and `tauri.conf.json` `devUrl` points at that URL; change both together.
- Desktop builds require the Rust MSVC toolchain and Visual Studio C++ build tools; Windows 11 includes WebView2. Use `cargo check` in `src-tauri` for Rust/config changes.
- `.github/workflows/release.yml` publishes a Windows x64 NSIS release when a `v*` tag is pushed. The tag must match the versions in `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `src-tauri/Cargo.lock`.

## Architecture

- React 19 + TypeScript + Vite SPA, also packaged as a Tauri v2 Windows app. No backend, network calls, or accounts: all notes and settings live in `localStorage`.
- `src/App.tsx` owns UI state (single top bar, dialogs, resolved theme) and global shortcuts. Note state and persistence live in `src/hooks/useNotebook.ts`.
- The app has one top bar, `src/components/TopBar.tsx` (Windows 11 Notepad style): a horizontally scrolling strip of note tabs with an icon-only white `+` button after the last tab for creating notes, plus the save indicator, theme toggle, and settings button pinned to the right. The separate brand/home bar was removed — `LogoMark.tsx` and `TopNotesPanel.tsx` were deleted and their styles dropped from `index.css`. There is no sidebar, no search field, and no sidebar open/collapsed state to manage; the tab strip scrolls horizontally on narrow windows.
- `useNotebook` writes immediately for create/select/delete/settings. Title and content edits are debounced by 600 ms (`SAVE_DELAY_MS`) and flushed on blur, `pagehide`, `beforeunload`, and `visibilitychange`. Its `dataRef` is the authoritative snapshot; route edits through its callbacks rather than only calling `setData`, or they won't be saved.
- Deleting a note is immediate by design: the tab's delete icon calls `deleteNote(id)` directly — there is no confirmation dialog and no toast, and `DeleteNoteDialog.tsx` was removed on purpose. Only the clicked note's id is passed, so other notes are untouched.
- `src/lib/storage.ts` is the only TypeScript module touching `localStorage`, under the `notebook.io/v1` key. It defensively parses untrusted data and keeps corrupt payloads at `notebook.io/backup/<timestamp>`. Preserve the key and schema for existing users.
- `persistNotebook` deliberately lets storage/quota errors throw; callers translate them into save status and the save-error message in the top bar and Settings dialog. Don't swallow them there.
- `parseSettings` is an allowlist and `persistNotebook` round-trips settings through it: a new `AppSettings` field that isn't added there (and to `DEFAULT_SETTINGS`) is silently dropped on the next save.
- `src/lib/text.ts` sanitizes editor HTML against a tag allowlist and strips every attribute except validated http(s) links. `plainTextToHtml` escapes imported `.txt` text and preserves line breaks and spacing before it is sanitized and stored. Sanitize any new HTML before storing or injecting it; never render raw note HTML. URL validation lives in `src/lib/links.ts`.
- `index.html` owns the web startup chrome: an inline pre-paint theme script (reads `notebook.io/v1` directly) so the page never flashes the wrong theme. There is no splash screen or startup animation on web or desktop — keep it that way. Keep the storage key/shape in sync with `src/lib/storage.ts`.
- PWA files live in `public/`: `manifest.webmanifest`, `icons/`, and `sw.js`. `src/main.tsx` registers the service worker in production web builds only, and skips it inside Tauri (`isTauri()`) because desktop assets are bundled. The SW precaches the shell and hashed `/assets/` files at install, uses network-first navigation, cache-first hashed `/assets/`, and network-first with cache fallback for other same-origin GETs. Update `SHELL_URLS`/`CACHE_VERSION` when those paths or caching behavior change; bumping `CACHE_VERSION` is what evicts old caches. `vercel.json` deploys the web build to Vercel and serves `sw.js`/`manifest.webmanifest` with `max-age=0`; any other host needs equivalent no-cache headers or clients can stay stuck on an old worker.
- The desktop shell lives in `src-tauri/`. `tauri.conf.json` points at `../dist`, uses an NSIS per-user installer, starts the main window hidden (`visible: false`) only so `tauri-plugin-window-state` can restore the saved size/position before the first frame, enables `useHttpsScheme`, and disables Tauri drag/drop so the editor's HTML5 text drop still works. The default window is 1200x800 with a 720x500 minimum; it is resizable/maximizable/minimizable and centered only when there is no saved state.
- There is deliberately no splash screen: `main.rs` calls `notebook_io_lib::run()` directly, `lib.rs`'s `setup` shows the restored window immediately (dark `backgroundColor` covers the WebView2 warm-up), and the former `splash.rs`, `finish_startup` command, and frontend splash files were removed. Don't reintroduce native or inline splashes, watchdogs, or startup delays.
- `src/lib.rs` registers `tauri-plugin-opener`, `tauri-plugin-single-instance`, and `tauri-plugin-window-state` (size/position/maximized only, never visibility), and saves state again on `CloseRequested` so Windows close/reopen is reliable. The single-instance plugin must be registered first; it forwards `.txt` paths from a second launch to the running window through a pending-file queue and the `open-text-file` event. `bundle.fileAssociations` in `tauri.conf.json` registers `.txt` with Windows. `read_text_file` decodes UTF-8/UTF-16 BOMs and falls back to Windows-1252. The window-state file lives at `%APPDATA%\io.notebook.desktop\.window-state.json`; don't add `VISIBLE` to its flags or the hidden startup window can stay hidden. `capabilities/default.json` grants `core:default`, `core:window:allow-set-theme`, `window-state:default`, and `opener:default`. Icons are generated from `public/icons/icon-512.png`.
- `src/App.tsx` syncs the resolved app theme to the native title bar with `getCurrentWindow().setTheme`. `src/components/Editor.tsx` opens links with the Tauri opener in the desktop app and falls back to `window.open` in browsers. Keep Tauri API calls guarded with `isTauri()` so the web/PWA build continues to work.
- Tauri's `useHttpsScheme` means desktop `localStorage` lives under the `https://tauri.localhost` origin. Changing that setting moves the storage origin; don't change it without planning for existing desktop notes. Desktop and browser storage are separate.
- The release workflow uses `tauri-apps/tauri-action@v1` on `windows-latest`, builds with the `x86_64-pc-windows-msvc` target, and lets the action create the GitHub Release and upload the NSIS installer. It uses the workflow `GITHUB_TOKEN` with `contents: write`; don't add a PAT or upload release assets only as workflow artifacts.

## Editor

- `src/components/Editor.tsx` is a custom `contentEditable` using legacy `document.execCommand` (bold/italic/underline, `formatBlock`, lists) and `queryCommandState`/`queryCommandValue`; there is no rich-text library.
- Initial HTML is injected once in `useLayoutEffect` through a ref, and `App` remounts the editor with `key={activeNote.id}` when switching notes. Don't bind `note.content` reactively to the DOM or the caret will jump; update via `onContentChange` / `syncFromDom`. `onInput` passes raw `innerHTML` up and sanitization happens on persist/load, so don't sanitize on every keystroke.
- Paste and drop insert plain text, except http(s)/`www.` URLs become links. Links are sanitized on save and open in a new tab in browsers or the default browser via the Tauri opener on desktop. Keep other pasted content plain text unless asked otherwise.
- Shortcuts are split across `App.tsx` (global), `Editor.tsx` (formatting), and `ShortcutsDialog.tsx` (reference). Update all three plus the README table when adding one.

## Styling / UX

- Tailwind v4 is imported, but only a few responsive visibility utilities are used. Visual styling lives in `src/index.css` on CSS custom properties, and surfaces share the flat `.panel` style; add styles there in the existing token pattern. The navigation is a horizontal tab strip inside `.topbar` above `.main-area`, not a side panel.
- Keep the UI cheap to render: no `backdrop-filter`, blur, `mix-blend-mode`, looping animations, or large blurred shadows; keep new motion one-shot and respect `prefers-reduced-motion`. `TopBar` is memoized on primitive props and memoizes each `NoteTab`, so keystrokes don't re-render the navigation; `Editor` defers word-count work (`STATS_DELAY_MS`) off the keystroke path. Keep new per-keystroke work close to zero.
- Theme is `data-theme="dark|light"` on `<html>`, with tokens in `html[data-theme=...]` blocks. `App.tsx` also syncs `color-scheme`, the `theme-color` meta tag, and the native Tauri title-bar theme. Theme defaults/validation live in `DEFAULT_SETTINGS`/`parseSettings`; the inline script in `index.html` duplicates the theme default and system resolution, so keep them consistent.
- Reuse `Dialog` (`src/components/Dialog.tsx`) for modals: it supplies the portal, focus trap, Escape handling, and scroll lock. Icons come from `lucide-react`.

## Conventions

- `verbatimModuleSyntax` is on: use `import type` for type-only imports.
- `erasableSyntaxOnly` is on: no enums, namespaces, or parameter properties.
- `strict` is not enabled; don't rely on strict null checks, and don't flip it on as a drive-by change.
- Components are named exports (`export function X`) except `App`. Imports are relative; there are no path aliases.
- Component files should export components only (`react/only-export-components`). Put shared contexts/constants in separate files.
- Style matches the existing source: no semicolons, single quotes, 2-space indent.
