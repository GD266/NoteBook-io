# Notebook.io

A quiet, lightweight notepad for the browser and Windows 11. Notes save
automatically on your device — there are no accounts, no servers, and no sync.

## Features

- **Distraction-free editing** with a clean, flat interface in light, dark, or
  system theme. Collapse the sidebar and the writing area widens automatically.
- **Light on resources** — no backdrop blur, decorative animation, or heavy
  effects, so it stays smooth on low-powered devices.
- **Installable and offline-ready** — install the PWA in a browser, or run the
  native Windows app. Both work without a network connection.
- **Automatic local saves** after a short pause, when a note is blurred, and
  before the tab closes. A save indicator in the top bar shows the current state.
- **Note management** in a responsive, collapsible sidebar: create, switch, search,
  rename, and delete with confirmation.
- **Rich text** via the formatting toolbar and keyboard shortcuts: bold, italic,
  underline, H1/H2/paragraph styles, bulleted lists, and numbered lists.
- **Clickable links** — pasted http(s) or `www.` URLs become blue links that open
  in your default browser.
- **Live counts** for words and characters, plus relative edit times.
- **Copy** rich and plain text to the clipboard, or download a note as `.txt`.
- **Editor preferences** for typeface, text size, line spacing, and spellcheck.
- **Accessible controls** with focus management, dialogs, keyboard navigation,
  reduced-motion support, and a skip link.

## Prerequisites

For the browser version:

- Node.js 20.19+ (or 22.12+)
- npm 10+

For the Windows desktop version:

- Rust with the `x86_64-pc-windows-msvc` toolchain
- Visual Studio Build Tools with **Desktop development with C++**
- WebView2 Runtime (included with Windows 11)

## Development

```bash
npm install
npm run dev
```

Open the printed local URL in your browser. Vite runs on port `1420` so the
desktop shell can connect to the same URL.

## Production build

```bash
npm run build
npm run preview
```

The production assets are written to `dist/`.

## Windows desktop app

Notebook.io uses Tauri v2 for its Windows 11 build. The desktop app bundles the
same React interface and stores notes in its own local WebView2 profile.

```bash
npm run desktop:dev
```

For a release build and installer:

```bash
npm run desktop:build
```

Outputs:

- Executable: `src-tauri/target/release/notebook-io.exe`
- Installer: `src-tauri/target/release/bundle/nsis/Notebook.io_1.0.0_x64-setup.exe`

The installer is per-user and does not require administrator access. Release
builds are unsigned, so Windows SmartScreen may warn until the executable is
code-signed.

Desktop notes are separate from notes saved in a browser or installed PWA. The
desktop app opens links in the Windows default browser and does not register the
PWA service worker because its assets are already bundled.

## Install as a PWA

Notebook.io is also a PWA. Build and serve it over HTTPS (or `localhost`), open it
in a supported browser, and use the browser's **Install app** or **Add to Home
Screen** action.

The production web build registers a service worker that precaches the app shell
and assets after the first visit. The installed PWA can then open and edit notes
offline. All notes still live in that browser's local storage.

The service worker only runs in production web builds. `npm run dev` does not
enable offline caching, and the Tauri desktop build skips the service worker.

## Lint

```bash
npm run lint
```

## Keyboard shortcuts

| Action               | Shortcut                        |
| -------------------- | ------------------------------- |
| Save now             | `Ctrl/Cmd + S`                  |
| New note             | `Ctrl/Cmd + Alt + N`            |
| Search notes         | `Ctrl/Cmd + K`                  |
| Bold                 | `Ctrl/Cmd + B`                  |
| Italic               | `Ctrl/Cmd + I`                  |
| Underline            | `Ctrl/Cmd + U`                  |
| Heading 1 / 2        | `Ctrl/Cmd + Alt + 1` / `2`      |
| Paragraph            | `Ctrl/Cmd + Alt + 0`            |
| Numbered / bulleted  | `Ctrl/Cmd + Shift + 7` / `8`    |
| Shortcut reference   | `Ctrl/Cmd + /`                  |

## Where notes live

Everything is stored under the `notebook.io/v1` key in `localStorage`. In a
browser or installed PWA, that is the site's storage. In the Windows app, it is
the app's own WebView2 profile. Notes are **not** synced across devices, browsers,
or the desktop app, and clearing the app's data removes them permanently. The
Settings panel shows how much local storage your notes use. Download important
notes if you need a separate copy.

If saved data is ever unreadable, Notebook.io keeps the original payload under a
`notebook.io/backup/…` key and starts with a fresh notebook.

## Tech stack

React 19, TypeScript, Vite, Tailwind CSS v4, Lucide icons, and Tauri v2 for the
Windows desktop shell.
