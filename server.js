#!/usr/bin/env node
/**
 * Kaptr — local engine
 * A zero-dependency static server + yt-dlp bridge.
 *
 *   node server.js            → http://localhost:3000
 *   PORT=4000 node server.js
 *
 * Requires yt-dlp (and ffmpeg for merging 4K/8K streams or extracting MP3).
 * No database, no accounts, no telemetry. Jobs live in memory and expire.
 */

"use strict";

const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawn, execFile } = require("node:child_process");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const TMP_ROOT = path.join(os.tmpdir(), "kaptr-jobs");
// A portable copy in ./bin is picked up before the system PATH.
const LOCAL_BIN = path.join(ROOT, "bin");
if (fs.existsSync(LOCAL_BIN)) {
  process.env.PATH = LOCAL_BIN + path.delimiter + (process.env.PATH || "");
}
const YTDLP = process.env.YTDLP_PATH || "yt-dlp";
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const COOKIES = process.env.COOKIES_FILE || "";
const MAX_AGE = 1000 * 60 * 60 * 2; // 2 hours
const JOB_TIMEOUT = 1000 * 60 * 30;

const engine = { ytdlp: false, ffmpeg: false, ytdlpVersion: null, ffmpegVersion: null };
const jobs = new Map(); // id -> job

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const FILE_MIME = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".opus": "audio/opus",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".md": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > 64 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function isAllowedUrl(value) {
  try {
    const u = new URL(String(value));
    if (!/^https?:$/.test(u.protocol)) return false;
    const host = u.hostname.toLowerCase();
    return (
      host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be" ||
      host === "instagram.com" || host.endsWith(".instagram.com") ||
      host === "instagr.am"
    );
  } catch {
    return false;
  }
}

function safeName(input, fallback = "kaptr-video") {
  const cleaned = String(input || "")
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}

function contentDisposition(name) {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

function humanBytes(n) {
  if (!n || !Number.isFinite(n)) return null;
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

function cleanErr(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-3)
    .join(" ")
    .slice(0, 400);
}

/* ------------------------------------------------------------------ */
/* engine detection                                                    */
/* ------------------------------------------------------------------ */

function detectBinary(bin, args, key, versionKey) {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout: 15000, windowsHide: true }, (err, stdout) => {
      if (err) {
        console.warn(`  ! ${key === "ytdlp" ? "yt-dlp" : "ffmpeg"} not found (${bin})`);
        return resolve(false);
      }
      engine[key] = true;
      engine[versionKey] = String(stdout).split(/\r?\n/)[0].trim();
      console.log(`  ✓ ${key === "ytdlp" ? "yt-dlp" : "ffmpeg"} — ${engine[versionKey]}`);
      resolve(true);
    });
  });
}

/* ------------------------------------------------------------------ */
/* yt-dlp info                                                         */
/* ------------------------------------------------------------------ */

function ytdlpInfo(url) {
  return new Promise((resolve, reject) => {
    const args = [
      "-J", "--no-warnings", "--no-playlist", "--socket-timeout", "15",
      ...(COOKIES ? ["--cookies", COOKIES] : []),
      url,
    ];
    execFile(
      YTDLP,
      args,
      { timeout: 90000, maxBuffer: 24 * 1024 * 1024, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) {
          return reject(new Error(cleanErr(stderr) || err.message));
        }
        try {
          resolve(JSON.parse(stdout));
        } catch {
          reject(new Error("Could not parse video metadata"));
        }
      }
    );
  });
}

function normalizeInfo(data) {
  const duration = Number(data.duration) || 0;
  const formats = Array.isArray(data.formats) ? data.formats : [];
  const audioBps = 16000; // ~128 kbps, for size estimates

  const byHeight = new Map();
  for (const f of formats) {
    if (!f || f.vcodec === "none" || !f.height) continue;
    if (String(f.protocol || "").includes("m3u8")) continue;
    const h = Number(f.height);
    if (!h) continue;
    const size = Number(f.filesize) || Number(f.filesize_approx) ||
      (Number(f.tbr) && duration ? (Number(f.tbr) * 1000 / 8) * duration : 0) ||
      (Number(f.vbr) && duration ? (Number(f.vbr) * 1000 / 8) * duration : 0);
    const total = size ? size + audioBps * duration : 0;
    const prev = byHeight.get(h);
    if (!prev || total > prev.size) {
      byHeight.set(h, {
        height: h,
        fps: Number(f.fps) || null,
        size: Math.round(total),
        ext: f.ext || "mp4",
        codec: f.vcodec && f.vcodec !== "none" ? String(f.vcodec).split(".")[0] : "h264",
      });
    }
  }

  const video = [...byHeight.values()]
    .sort((a, b) => b.height - a.height)
    .slice(0, 8)
    .map((v) => ({
      ...v,
      label: v.height >= 4320 ? "8K" : v.height >= 2160 ? "4K" : v.height >= 1440 ? "2K" : v.height >= 1080 ? "HD" : `${v.height}p`,
      sizeLabel: v.size ? humanBytes(v.size) : null,
    }));

  if (!video.length && duration) {
    video.push({ height: 0, label: "Best", size: null, sizeLabel: null, ext: "mp4" });
  }

  const byAbr = new Map();
  for (const f of formats) {
    if (!f || f.acodec === "none" || f.vcodec !== "none") continue;
    const abr = Math.round(Number(f.abr) || Number(f.tbr) || 0);
    if (!abr) continue;
    const bucket = abr >= 256 ? 320 : abr >= 160 ? 192 : 128;
    const size = Number(f.filesize) || Number(f.filesize_approx) ||
      (duration ? (abr * 1000 / 8) * duration : 0);
    const prev = byAbr.get(bucket);
    if (!prev || size > prev.size) {
      byAbr.set(bucket, { abr: bucket, sourceAbr: abr, size: Math.round(size), sizeLabel: humanBytes(size) });
    }
  }

  let audio = [...byAbr.values()].sort((a, b) => b.abr - a.abr);
  if (!audio.length) {
    audio = [320, 192, 128].map((abr) => ({
      abr,
      size: duration ? Math.round((abr * 1000 / 8) * duration) : 0,
      sizeLabel: duration ? humanBytes((abr * 1000 / 8) * duration) : null,
    }));
  }

  const thumbs = Array.isArray(data.thumbnails) ? data.thumbnails : [];
  const thumb = data.thumbnail ||
    thumbs.filter((t) => t && t.url).sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || "";

  return {
    title: data.title || "Untitled video",
    author: data.uploader || data.channel || data.creator || "Unknown",
    duration,
    thumbnail: thumb,
    platform: /instagram/i.test(data.extractor || data.webpage_url || "") ? "instagram" : "youtube",
    webpageUrl: data.webpage_url || "",
    video,
    audio,
  };
}

/* ------------------------------------------------------------------ */
/* download jobs                                                       */
/* ------------------------------------------------------------------ */

function progressFromLine(line, job) {
  const tagged = line.match(/^KAPTR\s+([^|]+)\|([^|]*)\|([^|]*)\|([^|]*)/);
  if (tagged) {
    const pct = parseFloat(tagged[1]);
    if (Number.isFinite(pct) && pct >= 0) job.percent = Math.min(100, pct);
    const sp = parseFloat(tagged[2]);
    if (Number.isFinite(sp) && sp > 0) job.speed = sp;
    const eta = parseFloat(tagged[3]);
    if (Number.isFinite(eta) && eta >= 0) job.eta = eta;
    const total = parseFloat(tagged[4]);
    if (Number.isFinite(total) && total > 0) job.size = total;
    return;
  }
  const m = line.match(/\[download\]\s+([\d.]+)%(?:\s+of\s+~?\s*([\d.]+\s*\w+))?(?:\s+at\s+([\d.]+\s*\w+\/s))?(?:\s+ETA\s+([\d:]+))?/);
  if (m) {
    job.percent = Math.min(100, parseFloat(m[1]) || job.percent);
    if (m[3]) job.speedLabel = m[3];
    if (m[4]) job.etaLabel = m[4];
  }
  if (/\[Merger\]|\[ExtractAudio\]|\[ffmpeg\]/i.test(line)) {
    job.stage = "processing";
    job.percent = Math.max(job.percent, 99);
  }
}

async function findOutput(dir) {
  const names = await fsp.readdir(dir);
  const files = [];
  for (const name of names) {
    if (name.endsWith(".part") || name.endsWith(".ytdl")) continue;
    const full = path.join(dir, name);
    const st = await fsp.stat(full).catch(() => null);
    if (st && st.isFile()) files.push({ name, full, size: st.size, mtime: st.mtimeMs });
  }
  files.sort((a, b) => b.size - a.size);
  return files[0] || null;
}

async function startJob({ url, height, format, abr, title }) {
  if (!engine.ytdlp) throw new Error("yt-dlp is not installed on this machine");
  if (format === "mp3" && !engine.ffmpeg) throw new Error("ffmpeg is required to extract MP3 audio");

  const id = crypto.randomBytes(9).toString("hex");
  const dir = path.join(TMP_ROOT, id);
  await fsp.mkdir(dir, { recursive: true });

  const job = {
    id, status: "queued", percent: 0, speed: 0, eta: null,
    speedLabel: null, etaLabel: null, size: 0, stage: "starting",
    title: safeName(title || "kaptr-video", "kaptr-video"),
    filename: null, error: null, dir,
    createdAt: Date.now(),
  };
  jobs.set(id, job);

  const h = Math.max(0, Math.min(4320, Number(height) || 1080));
  let selector;
  const args = [
    "--no-playlist", "--no-warnings", "--newline", "--no-part",
    "--restrict-filenames", "--concurrent-fragments", "4",
    "--socket-timeout", "20", "--retries", "4",
    "--progress-template", "download:KAPTR %(progress.percent)s|%(progress.speed)s|%(progress.eta)s|%(progress.total_bytes_estimate)s",
    ...(COOKIES ? ["--cookies", COOKIES] : []),
  ];

  if (format === "mp3") {
    selector = "bestaudio/best";
    const kbps = Math.max(64, Math.min(320, Number(abr) || 320));
    args.push("-f", selector, "-x", "--audio-format", "mp3", "--audio-quality", `${kbps}K`);
  } else {
    selector = h > 0
      ? `bestvideo[height<=${h}]+bestaudio/best[height<=${h}]/best`
      : "bestvideo+bestaudio/best";
    // Keep the best source streams; only the container is normalised.
    args.push("-f", selector, "--merge-output-format", "mp4/mkv");
    if (engine.ffmpeg) args.push("--remux-video", "mp4/mkv");
  }

  args.push("-o", path.join(dir, "video.%(ext)s"), url);

  const ext = format === "mp3" ? ".mp3" : ".mp4";
  job.filename = `${job.title}${ext}`;

  const child = spawn(YTDLP, args, { windowsHide: true });
  job.child = child;
  job.status = "downloading";

  let stderr = "";
  let stdoutBuf = "";

  child.stdout.on("data", (chunk) => {
    stdoutBuf += chunk.toString();
    const lines = stdoutBuf.split(/\r?\n/);
    stdoutBuf = lines.pop() || "";
    for (const line of lines) progressFromLine(line.trim(), job);
  });

  child.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-8000);
  });

  const timer = setTimeout(() => {
    job.status = "error";
    job.error = "Download timed out after 30 minutes";
    try { child.kill("SIGKILL"); } catch {}
  }, JOB_TIMEOUT);

  child.on("error", (err) => {
    clearTimeout(timer);
    job.status = "error";
    job.error = err.message;
  });

  child.on("close", async (code) => {
    clearTimeout(timer);
    if (job.status === "error") return;
    if (code !== 0) {
      job.status = "error";
      job.error = cleanErr(stderr) || `yt-dlp exited with code ${code}`;
      return;
    }
    try {
      const file = await findOutput(dir);
      if (!file) {
        job.status = "error";
        job.error = "The download finished but no file was produced";
        return;
      }
      const finalName = `${job.title}${path.extname(file.name) || ext}`;
      const target = path.join(dir, finalName);
      if (file.full !== target) await fsp.rename(file.full, target).catch(() => {});
      job.filename = finalName;
      job.filePath = target;
      job.filesize = file.size;
      job.percent = 100;
      job.stage = "done";
      job.status = "done";
    } catch (e) {
      job.status = "error";
      job.error = e.message;
    }
  });

  return job;
}

/* ------------------------------------------------------------------ */
/* static                                                              */
/* ------------------------------------------------------------------ */

async function serveStatic(req, res, pathname) {
  const rel = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  const target = path.resolve(ROOT, rel);
  const insideRoot = target === ROOT || target.startsWith(ROOT + path.sep);
  if (!insideRoot) return json(res, 403, { error: "Forbidden" });

  const st = await fsp.stat(target).catch(() => null);
  if (!st || !st.isFile()) {
    // SPA-ish fallback only for non-asset paths
    if (!path.extname(rel)) {
      const index = path.join(ROOT, "index.html");
      const html = await fsp.readFile(index).catch(() => null);
      if (html) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(html);
      }
    }
    return json(res, 404, { error: "Not found" });
  }

  res.writeHead(200, {
    "Content-Type": MIME[path.extname(target).toLowerCase()] || "application/octet-stream",
    "Content-Length": st.size,
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
  });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(target).pipe(res);
}

/* ------------------------------------------------------------------ */
/* router                                                              */
/* ------------------------------------------------------------------ */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const p = url.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  try {
    if (p === "/api/health" && req.method === "GET") {
      return json(res, 200, {
        ok: true,
        ytdlp: engine.ytdlp,
        ffmpeg: engine.ffmpeg,
        ytdlpVersion: engine.ytdlpVersion,
        cookies: Boolean(COOKIES),
      });
    }

    if (p === "/api/info" && req.method === "POST") {
      const body = await readJson(req);
      if (!body.url || !isAllowedUrl(body.url)) {
        return json(res, 400, { error: "Paste a valid YouTube or Instagram link" });
      }
      if (!engine.ytdlp) {
        return json(res, 503, { error: "yt-dlp is not installed", demo: true });
      }
      const raw = await ytdlpInfo(body.url);
      const info = normalizeInfo(raw);
      return json(res, 200, { ok: true, info });
    }

    if (p === "/api/download" && req.method === "POST") {
      const body = await readJson(req);
      if (!body.url || !isAllowedUrl(body.url)) {
        return json(res, 400, { error: "Paste a valid YouTube or Instagram link" });
      }
      if (!engine.ytdlp) {
        return json(res, 503, { error: "yt-dlp is not installed", demo: true });
      }
      const format = body.format === "mp3" ? "mp3" : "mp4";
      const job = await startJob({
        url: body.url,
        height: body.height,
        abr: body.abr,
        format,
        title: body.title,
      });
      return json(res, 202, { ok: true, jobId: job.id });
    }

    const progressMatch = p.match(/^\/api\/progress\/([a-f0-9]{18})$/);
    if (progressMatch && req.method === "GET") {
      const job = jobs.get(progressMatch[1]);
      if (!job) return json(res, 404, { error: "Job not found or expired" });
      return json(res, 200, {
        ok: true,
        status: job.status,
        percent: Math.round(job.percent * 10) / 10,
        speed: job.speed || null,
        speedLabel: job.speedLabel || null,
        eta: job.eta ?? null,
        etaLabel: job.etaLabel || null,
        size: job.filesize || job.size || null,
        stage: job.stage,
        filename: job.status === "done" ? job.filename : null,
        error: job.error,
      });
    }

    const fileMatch = p.match(/^\/api\/file\/([a-f0-9]{18})$/);
    if (fileMatch && (req.method === "GET" || req.method === "HEAD")) {
      const job = jobs.get(fileMatch[1]);
      if (!job) return json(res, 404, { error: "Job not found or expired" });
      if (job.status !== "done" || !job.filePath) {
        return json(res, 409, { error: "File is not ready yet" });
      }
      const st = await fsp.stat(job.filePath);
      const ext = path.extname(job.filePath).toLowerCase();
      const mime = FILE_MIME[ext] || "application/octet-stream";
      res.writeHead(200, {
        "Content-Type": mime,
        "Content-Length": st.size,
        "Content-Disposition": contentDisposition(job.filename),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      if (req.method === "HEAD") return res.end();
      return fs.createReadStream(job.filePath).pipe(res);
    }

    if (p.startsWith("/api/")) return json(res, 404, { error: "Unknown endpoint" });

    return await serveStatic(req, res, p);
  } catch (err) {
    console.error("  !", err.message);
    return json(res, 500, { error: err.message || "Something went wrong" });
  }
});

/* ------------------------------------------------------------------ */
/* housekeeping + boot                                                 */
/* ------------------------------------------------------------------ */

setInterval(async () => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt < MAX_AGE) continue;
    try {
      if (job.child && job.status === "downloading") job.child.kill("SIGKILL");
    } catch {}
    await fsp.rm(job.dir, { recursive: true, force: true }).catch(() => {});
    jobs.delete(id);
  }
}, 1000 * 60 * 10).unref();

(async () => {
  await fsp.mkdir(TMP_ROOT, { recursive: true }).catch(() => {});
  console.log("\n  kaptr — local engine");
  console.log("  ─────────────────────────────");
  await Promise.all([
    detectBinary(YTDLP, ["--version"], "ytdlp", "ytdlpVersion"),
    detectBinary(FFMPEG, ["-version"], "ffmpeg", "ffmpegVersion"),
  ]);

  server.listen(PORT, HOST, () => {
    console.log(`  → http://localhost:${PORT}`);
    if (!engine.ytdlp) {
      console.log("  ! demo mode — install yt-dlp for real downloads");
    }
    if (!engine.ffmpeg) {
      console.log("  ! ffmpeg missing — seamless 4K/8K merge and MP3 will be unavailable");
    }
    if (COOKIES) console.log(`  ✓ cookies: ${COOKIES}`);
    console.log("  stop with Ctrl+C\n");
  });
})();

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n  Port ${PORT} is busy. Try:  PORT=3001 node server.js\n`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
