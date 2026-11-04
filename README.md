# Kaptr — keep every pixel

A local-first video grabber for **YouTube** and **Instagram** with a fully custom, animated interface. It lists the real streams the source exposes — up to 8K — and saves the original video + audio without re-encoding or watermarks.

> **Use it responsibly.** Download only your own uploads, content under a permissive licence, or material you have explicit permission to save. Pulling copyrighted work without permission can breach copyright law and the platform's terms. There is no bypassing of private content here.

---

## Quick start

You need [Node.js 18+](https://nodejs.org) (already installed in this workspace).

```bash
node server.js
```

Open **http://localhost:3000**.

Without `yt-dlp` installed, the site runs in **demo preview mode**: the interface, metadata lookup and download simulation all work, but every preview is clearly labelled and no file is written. That's intentional — no fake "download complete" messages.

## Enable real downloads

1. Install **yt-dlp** and **ffmpeg** and make sure both are on your `PATH`.

   Windows (PowerShell):

   ```powershell
   winget install --id yt-dlp.yt-dlp -e
   winget install --id Gyan.FFmpeg -e
   ```

   macOS:

   ```bash
   brew install yt-dlp ffmpeg
   ```

   Linux:

   ```bash
   sudo apt install ffmpeg
   sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
   sudo chmod a+rx /usr/local/bin/yt-dlp
   ```

2. Close and reopen your terminal, then verify:

   ```bash
   yt-dlp --version
   ffmpeg -version
   ```

3. Restart the server and reload the page. The pill at the top of the grabber should read **engine ready · max quality**.

`ffmpeg` is required for merging separate 4K/8K video and audio streams and for MP3 extraction. Without it, high-resolution merged downloads and MP3 will fail; progressive formats still work.

Kaptr also looks in the local `bin/` folder before `PATH`, so a portable copy works with zero system changes. Drop `ffmpeg.exe` and `ffprobe.exe` (and optionally `yt-dlp.exe`) into `bin/`, then restart the server.

### Instagram + cookies

Public reels and posts usually resolve without authentication. Private, age-gated or login-walled posts need **your own** browser cookies:

```bash
# export cookies from your browser with a cookies.txt extension, then:
COOKIES_FILE=./cookies.txt node server.js
```

PowerShell:

```powershell
$env:COOKIES_FILE="./cookies.txt"; node server.js
```

Cookies are only read by the local `yt-dlp` process. They are never uploaded or logged.

### Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `HOST` | `127.0.0.1` | Bind address (local only by default) |
| `YTDLP_PATH` | `yt-dlp` | Path to the yt-dlp binary |
| `FFMPEG_PATH` | `ffmpeg` | Path to the ffmpeg binary |
| `COOKIES_FILE` | — | Netscape-format cookies file for gated posts |

```bash
PORT=4000 node server.js
```

## What's in the box

```
index.html     landing page + grabber UI
styles.css     design system, animations, responsive layout, light/dark
app.js         link detection, metadata, quality picker, progress, history
server.js      zero-dependency static server + yt-dlp bridge
bin/           optional portable ffmpeg (checked before PATH)
```

No npm install, no build step, no framework, no external images or icon packs. Everything except Google Fonts and the YouTube thumbnail is local.

## How the download pipeline works

1. The page posts the link to `/api/info`.
2. The server runs `yt-dlp -J` (one metadata pass) and normalises every video/audio format into a clean quality ladder with size estimates.
3. Choosing a quality posts to `/api/download`. `yt-dlp` writes into a per-job temp folder using `bestvideo[height<=N]+bestaudio`, then ffmpeg merges to MP4 (or MKV when the source codecs can't live in MP4). MP3 uses `-x --audio-format mp3 --audio-quality <selected kbps>K`.
4. The page polls `/api/progress/:id` for real percentage, speed and ETA, then fetches `/api/file/:id` with a download disposition.
5. Jobs and files expire after 2 hours. History is kept in `localStorage` only.

### API

- `GET /api/health` → engine capabilities
- `POST /api/info` `{ url }` → title, author, duration, thumbnail, quality ladder
- `POST /api/download` `{ url, format, height, abr, title }` → `{ jobId }`
- `GET /api/progress/:jobId` → status, percent, speed, eta
- `GET /api/file/:jobId` → finished file

## Design notes

- **Aurora canvas** — three drifting gradient fields, a masked grid and film grain, all CSS/SVG.
- **Grabber** — live platform detection, animated gradient border, paste-from-clipboard, `⌘/Ctrl + K` focus, labelled loading skeleton, quality ladder, MP4/MP3 segmented control.
- **Motion** — scroll reveals, pointer spotlight, magnetic-ish hover states, animated counters, waveform, rotating privacy orbit, shimmer, real download progress ring/bar.
- **Themes** — dark by default, full light theme, respects `prefers-reduced-motion`.
- **Honesty** — demo mode is never disguised as a real download.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Pill says *demo mode* | `yt-dlp` isn't on `PATH`; reopen the terminal after installing |
| 4K/8K fails to merge | install `ffmpeg`, or pick a progressive 720p/1080p stream |
| Instagram "login required" | provide `COOKIES_FILE` exported from your browser |
| Download fails after a yt-dlp update | `yt-dlp -U` (or update via your package manager) |
| Port already in use | `PORT=4000 node server.js` |

---

Built as a design-forward, local-first tool. No accounts, analytics or telemetry.
