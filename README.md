# Live Psalms

A desktop worship presentation system for Windows and Linux. It runs a service
from a song library, an offline Bible and a media vault, and drives a projector,
a stage monitor and an LED wall from one operator screen.

Built with Electron, React and TypeScript. Everything works offline.

## What it does

**Run a service.** Build an order of service from songs, scripture, media,
announcements and countdowns. Items reorder by drag, sections divide the service
into parts, and each item keeps its own speaker notes.

**Preview before you project.** Selecting an item loads it into Preview only.
Nothing reaches the screen until you press Go live, Enter, or double-click a
slide. Preview and Program sit side by side with the current slide, the next
slide and a slide strip for the selected item.

**Project to several outputs.** The audience screen, a stage confidence display
and an LED wall can each be opened independently. Outputs carry the live slide,
the countdown, speaker notes to the stage, and lower-third announcements.

**Read the Bible offline.** 45 translations ship with the app, including
Swahili, Luo, Kikuyu, Kalenjin, Kamba and Maasai. A second translation can run
in parallel on the same screen, and full-text search works across the library.

**Design slides in place.** Font, size, alignment, colours, background image or
motion loop, overlay strength and lower-third layout are edited from the Slide
settings panel without leaving the workspace.

**Work in the dark.** The interface is deliberately neutral and quiet so the
projected image stays the brightest thing in the room. Colour is used only for
program state: red for live, steel blue for preview.

## Interface

The operator screen has four regions:

| Region | Purpose |
| --- | --- |
| Top bar | Service identity, save state, search, outputs, service file |
| Library (left) | Songs, Bible, ticker announcements, media and themes |
| Workspace (middle) | Preview and Program monitors, slide strip, operator tools |
| Service (right) | Order of service, live indicator, item actions |
| Bottom bar | Transport, transition, countdown, screen overrides |

Slide settings open as a panel from the workspace toolbar. Dialogs (settings,
Bible version picker, song editor, search, streaming) follow the same visual
system; `docs/design-system.md` records the rules.

## Streaming

Live output to YouTube, Facebook or Twitch is driven by ffmpeg, which has to be
installed on the machine running the app. Live Psalms looks for it on `PATH` and
in the usual install folders (`winget`, Chocolatey, Scoop, `/usr/local/bin`).

If the encoder shows as missing right after installing it, the app is probably
holding the `PATH` it started with. Use **Locate ffmpeg…** in Stream setup to
pick `ffmpeg.exe` once; the path is remembered. The browser dev preview cannot
start the encoder at all — use the desktop build for streaming.
## Keyboard

| Key | Action |
| --- | --- |
| `Ctrl` `K` | Search songs, scripture, media and the service |
| `Enter` | Take the previewed slide live |
| `Up` / `Down` | Previous / next slide |
| `Alt` `Up` / `Alt` `Down` | Previous / next service item |
| `B` | Black out the screen |
| `Esc` | Clear the live slide text |
| `L` | Show the logo |
| `F` | Freeze the current frame |

## Downloads

Builds are published on the
[releases page](https://github.com/fr4nk1-3/Live-Psalm/releases):

| File | Description |
| --- | --- |
| `LivePsalms-Setup.exe` | Windows installer |
| `LivePsalms-Windows-Portable.exe` | Windows portable build |
| `LivePsalms-Ubuntu-amd64.deb` | Debian/Ubuntu package |

Windows 10 or later, or a recent 64-bit Linux distribution.

## Development

```bash
npm install
npm run dev          # Vite dev server
npm run build        # Typecheck and build the web assets
npm run build:win    # Windows installer and portable build
npm run build:deb    # Ubuntu package
```

Requires Node.js 20 or later.

## Project layout

```
electron/                 Electron main process, output windows, IPC
src/
  components/             Operator interface
  components/ui/          Shared interface primitives (shadcn/ui style)
  data/bibles/            45 offline translations and a manifest
  services/               Storage, Bible loading, import, broadcast, media vault
  lib/                    Utilities
  App.tsx                 Application shell and service state
docs/design-system.md     Interface rules
```

## Keyboard-first notes

The playlist is focusable: arrow keys move between items, `ArrowRight` and
`ArrowLeft` expand or collapse the slide list, and `Enter` takes the selected
item live. All operator shortcuts are suspended while a dialog is open.

## License

MIT
