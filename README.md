# Notebook.io

A quiet, lightweight notepad for the browser. Notes save automatically to this
browser's local storage — there are no accounts, no servers, and no sync.

## Features

- **Distraction-free editing** with a clean, flat interface in light, dark, or
  system theme. Collapse the sidebar and the writing area widens automatically.
- **Light on resources** — no backdrop blur, decorative animation, or heavy
  effects, so it stays smooth on low-powered devices.
- **Automatic local saves** after a short pause, when a note is blurred, and
  before the tab closes. A save indicator in the top bar shows the current state.
- **Note management** in a responsive, collapsible sidebar: create, switch, search,
  rename, and delete with confirmation.
- **Rich text** via the formatting toolbar and keyboard shortcuts: bold, italic,
  underline, H1/H2/paragraph styles, bulleted lists, and numbered lists.
- **Clickable links** — pasted http(s) or `www.` URLs become blue links that open
  in your browser in a new tab.
- **Live counts** for words and characters, plus relative edit times.
- **Copy** rich and plain text to the clipboard, or download a note as `.txt`.
- **Editor preferences** for typeface, text size, line spacing, and spellcheck.
- **Accessible controls** with focus management, dialogs, keyboard navigation,
  reduced-motion support, and a skip link.

## Prerequisites

- Node.js 20.19+ (or 22.12+)
- npm 10+

## Development

```bash
npm install
npm run dev
```

Open the printed local URL in your browser.

## Production build

```bash
npm run build
npm run preview
```

The production assets are written to `dist/`.

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

Everything is stored under the `notebook.io/v1` key in your browser's
`localStorage` for this site. Notes are **not** synced across devices or browsers,
and clearing this site's data in your browser removes them permanently. The
Settings panel shows how much local storage your notes use. Download important
notes if you need a separate copy.

If saved data is ever unreadable, Notebook.io keeps the original payload under a
`notebook.io/backup/…` key and starts with a fresh notebook.

## Tech stack

React 19, TypeScript, Vite, Tailwind CSS v4, and Lucide icons.
