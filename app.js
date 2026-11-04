/* ============================================================
   KAPTR — interface logic
   Works standalone in "demo preview" mode, upgrades automatically
   when the local engine (server.js + yt-dlp) is reachable.
   ============================================================ */

(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const STORE = {
    theme: "kaptr.theme",
    history: "kaptr.history.v1",
  };

  const state = {
    engine: "checking", // checking | live | demo
    engineDetail: null,
    platform: "auto",
    current: null,
    format: "mp4",
    height: null,
    abr: null,
    analyzing: false,
    downloading: false,
  };

  const els = {
    nav: $("#nav"),
    scrollBar: $("#scrollBar"),
    spotlight: $("#spotlight"),
    form: $("#urlForm"),
    input: $("#urlInput"),
    field: $("#urlField"),
    urlIcon: $("#urlIcon"),
    pasteBtn: $("#pasteBtn"),
    grabBtn: $("#grabBtn"),
    resultShell: $("#resultShell"),
    skeleton: $("#resultSkeleton"),
    result: $("#result"),
    statusPill: $("#statusPill"),
    statusText: $("#statusText"),
    themeBtn: $("#themeBtn"),
    historyBtn: $("#historyBtn"),
    historyCount: $("#historyCount"),
    drawer: $("#historyDrawer"),
    backdrop: $("#drawerBackdrop"),
    drawerList: $("#historyList"),
    closeDrawer: $("#closeDrawer"),
    clearHistory: $("#clearHistory"),
    toasts: $("#toasts"),
    sourceTabs: $$(".source"),
    miniChips: $$(".mini-chip"),
  };

  /* ---------------------------------------------------------- */
  /* icons                                                      */
  /* ---------------------------------------------------------- */

  const ICONS = {
    link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 14.5 14.5 9.5"/><path d="M7 17H5.5a3.5 3.5 0 0 1 0-7H9"/><path d="M17 7h1.5a3.5 3.5 0 0 1 0 7H15"/></svg>`,
    youtube: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 7.2a2.8 2.8 0 0 0-2-2C17.9 4.8 12 4.8 12 4.8s-5.9 0-7.6.4a2.8 2.8 0 0 0-2 2A29 29 0 0 0 2 12a29 29 0 0 0 .4 4.8 2.8 2.8 0 0 0 2 2c1.7.4 7.6.4 7.6.4s5.9 0 7.6-.4a2.8 2.8 0 0 0 2-2A29 29 0 0 0 22 12a29 29 0 0 0-.4-4.8ZM10 15.2V8.8l5.3 3.2L10 15.2Z"/></svg>`,
    instagram: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5.5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none"/></svg>`,
    play: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5L8 5.5Z"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.6v.2"/></svg>`,
    warn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5 21 19H3L12 3.5Z"/><path d="M12 9.5v4M12 16.5v.2"/></svg>`,
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/></svg>`,
    bolt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z"/></svg>`,
    history: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4.5V9H8"/><path d="M12 7.5V12l3 1.8"/></svg>`,
    download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="m7 11 5 5 5-5"/><path d="M4.5 20h15"/></svg>`,
    retry: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1"/><path d="M20.5 4.5V9H16"/></svg>`,
  };

  /* ---------------------------------------------------------- */
  /* utils                                                      */
  /* ---------------------------------------------------------- */

  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));

  function timeAgo(ts) {
    const diff = Math.max(0, Date.now() - ts);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function fmtDuration(seconds) {
    const s = Math.round(Number(seconds) || 0);
    if (!s) return null;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h
      ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
      : `${m}:${String(sec).padStart(2, "0")}`;
  }

  function fmtSpeed(bytesPerSec) {
    if (!bytesPerSec || !Number.isFinite(bytesPerSec)) return null;
    const mb = bytesPerSec / 1024 / 1024;
    if (mb >= 1) return `${mb.toFixed(1)} MB/s`;
    return `${Math.max(1, Math.round(bytesPerSec / 1024))} KB/s`;
  }

  function fmtEta(seconds) {
    const s = Math.round(Number(seconds));
    if (!Number.isFinite(s) || s < 0) return null;
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
  }

  /* ---------------------------------------------------------- */
  /* toasts                                                     */
  /* ---------------------------------------------------------- */

  function toast(title, text = "", type = "info", duration = 4600) {
    if (!els.toasts) return;
    const icon = type === "ok" ? ICONS.check : type === "warn" ? ICONS.warn : type === "err" ? ICONS.error : ICONS.info;
    const node = document.createElement("div");
    node.className = `toast ${type}`;
    node.setAttribute("role", type === "err" ? "alert" : "status");
    node.innerHTML = `
      <span class="toast-ico">${icon}</span>
      <span class="toast-body">
        <span class="toast-title">${esc(title)}</span>
        ${text ? `<span class="toast-text">${esc(text)}</span>` : ""}
      </span>`;
    els.toasts.appendChild(node);

    let gone = false;
    const remove = () => {
      if (gone) return;
      gone = true;
      node.classList.add("out");
      setTimeout(() => node.remove(), 400);
    };
    node.addEventListener("click", remove);
    setTimeout(remove, duration);
  }

  /* ---------------------------------------------------------- */
  /* theme                                                      */
  /* ---------------------------------------------------------- */

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(STORE.theme, theme); } catch {}
    const btn = els.themeBtn;
    if (btn) {
      const next = theme === "dark" ? "light" : "dark";
      btn.setAttribute("aria-label", `Switch to ${next} theme`);
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#06060a" : "#f3f3f8");
  }

  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem(STORE.theme); } catch {}
    applyTheme(saved === "light" || saved === "dark" ? saved : "dark");
    els.themeBtn?.addEventListener("click", () => {
      applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    });
  }

  /* ---------------------------------------------------------- */
  /* engine                                                     */
  /* ---------------------------------------------------------- */

  async function checkEngine() {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2600);
      const res = await fetch("/api/health", { signal: controller.signal, cache: "no-store" });
      clearTimeout(timer);
      if (!res.ok) throw new Error("offline");
      const data = await res.json();
      state.engineDetail = data;
      state.engine = data.ytdlp ? "live" : "demo";
    } catch {
      state.engine = "demo";
      state.engineDetail = null;
    }
    updateEngineUI();
  }

  function updateEngineUI() {
    const pill = els.statusPill;
    if (!pill) return;
    pill.classList.remove("is-live", "is-demo", "is-busy");

    let text = "";
    let title = "";

    if (state.engine === "live") {
      const noFfmpeg = state.engineDetail && state.engineDetail.ffmpeg === false;
      pill.classList.add(noFfmpeg ? "is-demo" : "is-live");
      text = noFfmpeg ? "engine ready · no ffmpeg" : "engine ready · max quality";
      title = noFfmpeg
        ? "yt-dlp is ready, but ffmpeg is missing. 4K/8K merging and MP3 need it. Click for details."
        : `yt-dlp ${state.engineDetail?.ytdlpVersion || ""} — real downloads enabled`;
    } else if (state.engine === "checking") {
      pill.classList.add("is-busy");
      text = "checking local engine…";
      title = "Looking for the local yt-dlp bridge";
    } else {
      pill.classList.add("is-demo");
      text = state.engineDetail ? "demo · yt-dlp missing" : "demo · engine offline";
      title = state.engineDetail
        ? "The server is running, but yt-dlp isn't installed. Click for setup."
        : "Start server.js with yt-dlp installed for real downloads. Click for setup.";
    }

    els.statusText.textContent = text;
    pill.title = title;
  }

  function setBusy(text) {
    if (!els.statusPill) return;
    els.statusPill.classList.remove("is-live", "is-demo");
    els.statusPill.classList.add("is-busy");
    els.statusText.textContent = text;
  }

  els.statusPill?.addEventListener("click", () => {
    if (state.engine === "live") {
      if (state.engineDetail && state.engineDetail.ffmpeg === false) {
        toast("ffmpeg is missing", "Install ffmpeg so Kaptr can merge 4K/8K streams and extract MP3.", "warn", 7000);
      } else {
        toast("Local engine is online", "yt-dlp is installed. Downloads use the original streams.", "ok");
      }
    } else if (state.engineDetail) {
      toast(
        "One dependency missing",
        "The server is running, but yt-dlp isn't on PATH. Install it, reopen the terminal, then reload.",
        "warn",
        7000
      );
    } else {
      toast(
        "Demo preview mode",
        "Run `node server.js` with yt-dlp + ffmpeg installed to download real files.",
        "warn",
        7000
      );
    }
  });

  /* ---------------------------------------------------------- */
  /* link detection                                             */
  /* ---------------------------------------------------------- */

  function detect(raw) {
    const value = String(raw || "").trim();
    if (!value) return null;
    let url;
    try {
      url = new URL(value.startsWith("http") ? value : `https://${value}`);
    } catch {
      return null;
    }
    if (!/^https?:$/.test(url.protocol)) return null;
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com")) {
      let id = host === "youtu.be" ? url.pathname.split("/")[1] : url.searchParams.get("v");
      if (!id) {
        const m = url.pathname.match(/\/(?:shorts|embed|live|v)\/([\w-]{11})/);
        if (m) id = m[1];
      }
      if (host === "youtu.be" && !id) return null;
      if (host === "youtube.com" && !id && !/\/(shorts|embed|live)\//.test(url.pathname)) {
        return { platform: "youtube", id: null, url: url.toString(), unsure: true };
      }
      return { platform: "youtube", id: id || null, url: url.toString() };
    }

    if (host === "instagram.com" || host.endsWith(".instagram.com") || host === "instagr.am") {
      const m = url.pathname.match(/\/(?:reel|reels|p|tv)\/([\w-]+)/);
      return { platform: "instagram", id: m ? m[1] : null, url: url.toString(), unsure: !m };
    }
    return null;
  }

  function paintPlatform(platform) {
    if (!els.field) return;
    els.field.classList.remove("platform-youtube", "platform-instagram");
    if (platform === "youtube" || platform === "instagram") {
      els.field.classList.add(`platform-${platform}`);
      els.urlIcon.innerHTML = ICONS[platform];
    } else {
      els.urlIcon.innerHTML = ICONS.link;
    }
  }

  function setSource(platform, focus = false) {
    state.platform = platform;
    els.sourceTabs.forEach((tab) => {
      const on = tab.dataset.source === platform;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-selected", String(on));
    });
    if (platform === "youtube") {
      els.input.placeholder = "Paste a YouTube, Shorts or youtu.be link…";
    } else if (platform === "instagram") {
      els.input.placeholder = "Paste an Instagram reel or post link…";
    } else {
      els.input.placeholder = "Paste a YouTube or Instagram link…";
    }
    if (focus) els.input.focus();
  }

  els.sourceTabs.forEach((tab) => {
    tab.addEventListener("click", () => setSource(tab.dataset.source, true));
  });

  els.miniChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const mode = chip.dataset.example || "youtube";
      setSource(mode.startsWith("instagram") ? "instagram" : "youtube", true);
      if (mode === "shorts") {
        els.input.placeholder = "Paste a YouTube Shorts link…";
      } else if (mode === "instagram-post") {
        els.input.placeholder = "Paste an Instagram post link…";
      }
    });
  });

  els.input?.addEventListener("input", () => {
    const det = detect(els.input.value);
    paintPlatform(det?.platform || null);
    els.field.classList.remove("invalid");
  });

  els.input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      els.form.requestSubmit();
    }
  });

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      els.input?.focus();
      els.input?.select();
    }
    if (e.key === "Escape") closeDrawer();
  });

  /* ---------------------------------------------------------- */
  /* paste + submit                                             */
  /* ---------------------------------------------------------- */

  els.pasteBtn?.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        toast("Clipboard is empty", "Copy a video link first, or paste with Ctrl+V.", "warn");
        els.input.focus();
        return;
      }
      els.input.value = text.trim();
      paintPlatform(detect(text)?.platform || null);
      els.form.requestSubmit();
    } catch {
      toast("Clipboard access blocked", "Click the field and paste with Ctrl+V (⌘V on Mac).", "warn");
      els.input.focus();
    }
  });

  els.form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = els.input.value.trim();
    if (!raw) {
      els.field.classList.add("invalid");
      els.input.focus();
      toast("Paste a link first", "YouTube, Shorts, Instagram Reels and posts are supported.", "warn");
      return;
    }
    const det = detect(raw);
    if (!det) {
      els.field.classList.add("invalid");
      els.input.focus();
      toast("That link isn't supported", "Only YouTube and Instagram links work right now.", "err");
      return;
    }
    analyze(det);
  });

  /* ---------------------------------------------------------- */
  /* demo metadata                                              */
  /* ---------------------------------------------------------- */

  async function buildDemo(det) {
    const info = {
      demo: true,
      platform: det.platform,
      url: det.url,
      title: "",
      author: "",
      duration: 0,
      thumbnail: "",
      video: [
        { height: 2160, label: "4K", sizeLabel: "~184 MB" },
        { height: 1440, label: "2K", sizeLabel: "~96 MB" },
        { height: 1080, label: "HD", sizeLabel: "~48 MB" },
        { height: 720, label: "720p", sizeLabel: "~26 MB" },
        { height: 480, label: "480p", sizeLabel: "~14 MB" },
      ],
      audio: [
        { abr: 320, sizeLabel: "~7.2 MB" },
        { abr: 192, sizeLabel: "~4.4 MB" },
        { abr: 128, sizeLabel: "~2.9 MB" },
      ],
    };

    if (det.platform === "youtube" && det.id) {
      info.thumbnail = `https://i.ytimg.com/vi/${det.id}/maxresdefault.jpg`;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(det.url)}&format=json`,
          { signal: controller.signal }
        );
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          info.title = data.title || "";
          info.author = data.author_name || "";
        }
      } catch {
        /* offline is fine — the preview still works */
      }
      if (!info.title) info.title = "YouTube video";
      if (!info.author) info.author = "YouTube";
    } else {
      info.title = "Instagram video";
      info.author = "Instagram";
      info.video = [
        { height: 1080, label: "HD", sizeLabel: "~48 MB" },
        { height: 720, label: "720p", sizeLabel: "~26 MB" },
        { height: 480, label: "480p", sizeLabel: "~14 MB" },
      ];
    }

    return info;
  }

  /* ---------------------------------------------------------- */
  /* analyze                                                    */
  /* ---------------------------------------------------------- */

  async function analyze(det, opts = {}) {
    if (state.analyzing) return;
    state.analyzing = true;
    state.current = null;

    els.grabBtn.classList.add("is-loading");
    els.grabBtn.disabled = true;
    setBusy("reading source…");
    els.resultShell.hidden = false;
    els.skeleton.hidden = false;
    els.result.hidden = true;
    els.result.innerHTML = "";
    els.field.classList.remove("invalid");
    paintPlatform(det.platform);

    const activeTab = els.sourceTabs.find((t) => t.dataset.source === det.platform);
    if (activeTab && state.platform !== "auto") setSource(det.platform);

    const started = performance.now();

    try {
      let info;
      if (state.engine === "live") {
        let res, data;
        try {
          res = await fetch("/api/info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: det.url }),
          });
          data = await res.json().catch(() => ({}));
        } catch {
          throw new Error("The local engine stopped responding");
        }

        if (!res.ok) {
          if (data.demo) {
            state.engine = "demo";
            updateEngineUI();
            toast("Engine unavailable", "yt-dlp isn't installed, so this is a labeled demo preview.", "warn", 6500);
            info = await buildDemo(det);
          } else {
            throw new Error(data.error || "Could not read that link");
          }
        } else {
          info = { ...data.info, demo: false };
        }
      } else {
        info = await buildDemo(det);
      }

      const elapsed = performance.now() - started;
      if (elapsed < 700) await sleep(700 - elapsed);

      if (!info.video?.length && !info.audio?.length) {
        throw new Error("No downloadable streams were exposed for this link");
      }

      state.current = info;
      state.format = "mp4";
      state.height = info.video?.[0]?.height ?? null;
      state.abr = info.audio?.[0]?.abr ?? null;

      els.skeleton.hidden = true;
      els.result.hidden = false;
      renderResult();
      updateEngineUI();

      if (!opts.quiet) {
        setTimeout(() => {
          els.resultShell.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 120);
      }
    } catch (err) {
      els.skeleton.hidden = true;
      els.result.hidden = false;
      els.result.innerHTML = `
        <div class="res-error">
          <span class="res-error-ico">${ICONS.warn}</span>
          <div>
            <h4>Couldn't read that link</h4>
            <p>${esc(err.message || "Something went wrong while reading the video.")}</p>
            <button class="btn btn-ghost btn-sm" type="button" data-retry>${ICONS.retry}<span>Try again</span></button>
          </div>
        </div>`;
      toast("Couldn't read that link", err.message || "Try a different public link.", "err", 6000);
      updateEngineUI();
    } finally {
      state.analyzing = false;
      els.grabBtn.classList.remove("is-loading");
      els.grabBtn.disabled = false;
      updateEngineUI();
    }
  }

  /* ---------------------------------------------------------- */
  /* result rendering                                           */
  /* ---------------------------------------------------------- */

  function currentOptions() {
    const info = state.current;
    if (!info) return [];
    const opts = state.format === "mp3" ? info.audio || [] : info.video || [];
    if (!opts.length) return state.format === "mp3" ? [{ abr: 320, sizeLabel: null }] : [];
    return opts;
  }

  function optionLabel(opt) {
    if (state.format === "mp3") return `${opt.abr} kbps`;
    return opt.height > 0 ? `${opt.height}p` : "Best";
  }

  function selectedOption() {
    const opts = currentOptions();
    if (!opts.length) return null;
    const key = state.format === "mp3" ? state.abr : state.height;
    return opts.find((o) => (state.format === "mp3" ? o.abr : o.height) === key) || opts[0];
  }

  function renderResult() {
    const info = state.current;
    if (!info) return;

    const isAudio = state.format === "mp3";
    const opts = currentOptions();
    const selected = selectedOption();
    const duration = fmtDuration(info.duration);
    const platformName = info.platform === "instagram" ? "Instagram" : "YouTube";
    const thumb = info.thumbnail
      ? `<img src="${esc(info.thumbnail)}" alt="" loading="lazy" data-thumb />`
      : "";

    const qualityButtons = opts.map((opt) => {
      const key = isAudio ? opt.abr : opt.height;
      const active = selected && key === (isAudio ? selected.abr : selected.height);
      const name = optionLabel(opt);
      const meta = isAudio
        ? [opt.sizeLabel].filter(Boolean).join(" · ")
        : [opt.label && opt.label !== name ? opt.label : "", opt.sizeLabel].filter(Boolean).join(" · ");
      return `
        <button class="q-opt ${active ? "is-active" : ""}" type="button" data-key="${esc(key)}" aria-pressed="${active}">
          <span class="q-name">${esc(name)}</span>
          <span class="q-size">${esc(meta || "quality")}</span>
        </button>`;
    }).join("");

    const sizeText = selected?.sizeLabel || "";
    const downloadLabel = info.demo ? "Preview download" : "Download";

    els.result.innerHTML = `
      <div class="res-thumb ${info.thumbnail ? "" : "no-img"}" id="resThumb">
        ${thumb}
        <span class="res-platform">${ICONS[platformName.toLowerCase()]}${platformName}</span>
        ${duration ? `<span class="res-duration">${duration}</span>` : info.demo ? `<span class="res-duration">preview</span>` : ""}
        <span class="res-play"><span>${ICONS.play}</span></span>
      </div>

      <div class="res-body">
        <div class="res-head">
          <h2 class="res-title" title="${esc(info.title)}">${esc(info.title)}</h2>
          <div class="res-meta">
            <span>${esc(info.author)}</span>
            <span class="dot"></span>
            <span>${platformName}</span>
            ${info.demo
              ? `<span class="demo-tag">${ICONS.info} demo preview</span>`
              : `<span class="ok">${ICONS.check} source verified</span>`}
          </div>
        </div>

        <div class="res-quality" role="group" aria-label="Quality">
          ${qualityButtons || `<span class="res-meta">No streams available</span>`}
        </div>

        <div class="res-controls">
          <div class="format-toggle" role="group" aria-label="Format">
            <button class="format-btn ${!isAudio ? "is-active" : ""}" type="button" data-format="mp4" aria-pressed="${!isAudio}" title="MP4 when the source codecs allow it, MKV otherwise">MP4</button>
            <button class="format-btn ${isAudio ? "is-active" : ""}" type="button" data-format="mp3" aria-pressed="${isAudio}">MP3</button>
          </div>
          <button class="btn btn-primary dl-btn" id="dlBtn" type="button" ${opts.length ? "" : "disabled"}>
            <span class="dl-label">${downloadLabel}</span>
            ${sizeText ? `<span class="dl-size">${esc(sizeText)}</span>` : ""}
            <span class="dl-progress"></span>
          </button>
        </div>

        <div class="res-status" id="resStatus" aria-live="polite">
          <span>${info.demo
            ? "Labeled preview — no file will be written."
            : `Ready · ${isAudio ? "audio-only extract" : "original video + audio"}`}</span>
        </div>

        ${info.demo ? `
          <div class="engine-hint">
            ${ICONS.warn}
            <span>Demo mode: start the local engine with <code>node server.js</code> (needs <code>yt-dlp</code> + <code>ffmpeg</code>) to download this for real.</span>
          </div>` : ""}
      </div>`;

    // thumbnail fade-in + fallback for missing maxres
    const img = $("[data-thumb]", els.result);
    if (img) {
      const markLoaded = () => img.classList.add("loaded");
      if (img.complete && img.naturalWidth) markLoaded();
      img.addEventListener("load", markLoaded);
      img.addEventListener("error", () => {
        if (info.platform === "youtube" && info.thumbnail?.includes("maxresdefault")) {
          img.src = info.thumbnail.replace("maxresdefault", "hqdefault");
        } else {
          img.remove();
          $("#resThumb")?.classList.add("no-img");
        }
      });
    }

    attachThumbTilt();
  }

  function attachThumbTilt() {
    const thumb = $("#resThumb");
    if (!thumb || window.matchMedia("(hover: none)").matches) return;
    thumb.addEventListener("pointermove", (e) => {
      const rect = thumb.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      thumb.style.transform = `perspective(700px) rotateY(${px * 6}deg) rotateX(${-py * 6}deg) scale(1.012)`;
    });
    thumb.addEventListener("pointerleave", () => {
      thumb.style.transform = "";
    });
  }

  /* ---------------------------------------------------------- */
  /* result interactions                                        */
  /* ---------------------------------------------------------- */

  els.result?.addEventListener("click", (e) => {
    const retry = e.target.closest("[data-retry]");
    if (retry) {
      const det = detect(els.input.value);
      if (det) analyze(det);
      return;
    }

    if (state.downloading) return;

    const formatBtn = e.target.closest("[data-format]");
    if (formatBtn) {
      const format = formatBtn.dataset.format === "mp3" ? "mp3" : "mp4";
      if (format === state.format) return;
      state.format = format;
      if (format === "mp3") state.abr = state.current?.audio?.[0]?.abr ?? 320;
      else state.height = state.current?.video?.[0]?.height ?? null;
      renderResult();
      return;
    }

    const qualityBtn = e.target.closest("[data-key]");
    if (qualityBtn) {
      const key = Number(qualityBtn.dataset.key);
      if (state.format === "mp3") state.abr = key;
      else state.height = key;
      renderResult();
      return;
    }

    if (e.target.closest("#dlBtn")) startDownload();
  });

  /* ---------------------------------------------------------- */
  /* download                                                   */
  /* ---------------------------------------------------------- */

  function setDownloadState({ percent, label, status, done = false }) {
    const btn = $("#dlBtn");
    if (btn) {
      const labelEl = $(".dl-label", btn);
      if (labelEl && label != null) labelEl.textContent = label;
      const bar = $(".dl-progress", btn);
      if (bar) bar.style.width = `${Math.max(0, Math.min(100, percent ?? 0))}%`;
      btn.classList.toggle("done", done);
    }
    const statusEl = $("#resStatus");
    if (statusEl && status != null) statusEl.innerHTML = status;
  }

  async function startDownload() {
    if (state.downloading || !state.current) return;
    const info = state.current;
    const opt = selectedOption();
    if (!opt) {
      toast("No stream selected", "Pick a format or quality first.", "warn");
      return;
    }

    if (info.demo) {
      await runDemoDownload(info, opt);
      return;
    }

    state.downloading = true;
    setBusy("pulling stream…");
    const btn = $("#dlBtn");
    if (btn) btn.disabled = true;
    const sizeLabel = opt.sizeLabel || "";
    setDownloadState({ percent: 0, label: "Starting…", status: `<span>Contacting source…</span>` });

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: info.url || info.webpageUrl,
          height: state.format === "mp3" ? undefined : opt.height,
          abr: state.format === "mp3" ? opt.abr : undefined,
          format: state.format,
          title: info.title,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not start the download");
      const jobId = data.jobId;

      const startedAt = Date.now();
      let lastPercent = 0;

      while (true) {
        await sleep(650);
        if (Date.now() - startedAt > 1000 * 60 * 31) throw new Error("Download timed out");

        const poll = await fetch(`/api/progress/${jobId}`);
        const job = await poll.json().catch(() => ({}));
        if (!poll.ok) throw new Error(job.error || "Lost track of the download");

        const pct = Number(job.percent) || 0;
        lastPercent = Math.max(lastPercent, pct);
        const processing = job.status === "downloading" && (job.stage === "processing" || pct >= 99.9);
        const speed = job.speedLabel || fmtSpeed(job.speed);
        const eta = job.etaLabel || fmtEta(job.eta);

        const statusBits = [];
        if (processing) statusBits.push("Merging video + audio…");
        else {
          if (speed) statusBits.push(speed);
          if (eta) statusBits.push(`ETA ${eta}`);
          if (job.size) statusBits.push(fmtBytesShort(job.size));
        }

        setDownloadState({
          percent: processing ? 100 : Math.max(lastPercent, 1),
          label: processing ? "Processing…" : `Downloading ${Math.round(pct)}%`,
          status: `<span>${esc(statusBits.join(" · ") || "Starting stream…")}</span>
            <span class="bar"><i style="width:${Math.min(100, pct)}%"></i></span>`,
        });

        if (job.status === "done") {
          const directUrl = `/api/file/${jobId}`;
          const finalFilename = job.filename || "kaptr-video.mp4";
          setDownloadState({
            percent: 100,
            label: "Saved",
            status: `<span>${esc(finalFilename)}${job.size ? ` · ${esc(fmtBytesShort(job.size))}` : ""} · <a href="${directUrl}" download="${esc(finalFilename)}" style="color:var(--accent);text-decoration:underline;font-weight:600;">Download ready</a></span><span class="bar"><i style="width:100%"></i></span>`,
            done: true,
          });
          btn?.classList.add("done");
          const a = document.createElement("a");
          a.href = directUrl;
          a.download = finalFilename;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => a.remove(), 1000);

          addHistory({
            url: info.url || info.webpageUrl,
            title: info.title,
            author: info.author,
            platform: info.platform,
            thumbnail: info.thumbnail,
            quality: state.format === "mp3" ? `${opt.abr} kbps` : (opt.height > 0 ? `${opt.height}p` : "Best"),
            format: job.filename?.split(".").pop() || state.format,
            sizeLabel: job.size ? fmtBytesShort(job.size) : sizeLabel,
          });
          toast("Download complete", `${info.title} — ${state.format === "mp3" ? opt.abr + " kbps" : opt.height + "p"}`, "ok");
          break;
        }

        if (job.status === "error") throw new Error(job.error || "yt-dlp failed");
      }
    } catch (err) {
      setDownloadState({
        percent: 0,
        label: "Try again",
        status: `<span style="color:var(--red)">${esc(err.message || "Download failed")}</span>`,
      });
      toast("Download failed", err.message || "Check the link and try again.", "err", 6500);
    } finally {
      state.downloading = false;
      if (btn) btn.disabled = false;
      updateEngineUI();
    }
  }

  function fmtBytesShort(bytes) {
    if (!bytes || !Number.isFinite(bytes)) return "";
    const mb = bytes / 1024 / 1024;
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  async function runDemoDownload(info, opt) {
    state.downloading = true;
    const btn = $("#dlBtn");
    if (btn) btn.disabled = true;
    const sizeLabel = opt.sizeLabel || "";
    const total = 4200 + Math.random() * 1400;
    const startedAt = performance.now();
    const speed = (5 + Math.random() * 5).toFixed(1);

    while (true) {
      const t = Math.min(1, (performance.now() - startedAt) / total);
      const eased = 1 - Math.pow(1 - t, 2.1);
      const pct = Math.min(100, Math.round(eased * 100));
      setDownloadState({
        percent: pct,
        label: `Preview ${pct}%`,
        status: `<span>Demo stream · ${speed} MB/s · ETA ${Math.max(0, Math.ceil((total - (performance.now() - startedAt)) / 1000))}s</span>
          <span class="bar"><i style="width:${pct}%"></i></span>`,
      });
      if (t >= 1) break;
      await sleep(90);
    }

    setDownloadState({
      percent: 100,
      label: "Preview complete",
      status: `<span>Demo only — nothing was saved. Start the local engine for a real file.</span>`,
      done: true,
    });
    toast("That was a preview", "No file was written. Run `node server.js` with yt-dlp to download for real.", "warn", 7000);
    state.downloading = false;
    if (btn) btn.disabled = false;
    updateEngineUI();

    setTimeout(() => {
      if (state.current && !state.downloading) {
        renderResult();
      }
    }, 4200);
  }

  /* ---------------------------------------------------------- */
  /* history                                                    */
  /* ---------------------------------------------------------- */

  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORE.history);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((x) => x && x.url) : [];
    } catch {
      return [];
    }
  }

  function saveHistory(items) {
    try { localStorage.setItem(STORE.history, JSON.stringify(items.slice(0, 12))); } catch {}
    renderHistoryBadge();
  }

  function addHistory(entry) {
    if (!entry?.url) return;
    const items = loadHistory();
    const next = [{ ...entry, at: Date.now() }, ...items.filter((x) => x.url !== entry.url)]
      .slice(0, 12);
    saveHistory(next);
    renderHistory();
  }

  function renderHistoryBadge() {
    const count = loadHistory().length;
    if (!els.historyCount) return;
    els.historyCount.textContent = String(count);
    els.historyCount.classList.toggle("has-items", count > 0);
  }

  function renderHistory() {
    if (!els.drawerList) return;
    const items = loadHistory();
    renderHistoryBadge();

    if (!items.length) {
      if (els.clearHistory) els.clearHistory.disabled = true;
      els.drawerList.innerHTML = `
        <div class="history-empty">
          ${ICONS.history}
          <strong>Nothing grabbed yet</strong>
          <span>Real downloads show up here, stored only in this browser.</span>
        </div>`;
      return;
    }

    if (els.clearHistory) els.clearHistory.disabled = false;

    els.drawerList.innerHTML = items.map((item) => `
      <div class="history-item" data-url="${esc(item.url)}" role="button" tabindex="0" aria-label="Reload ${esc(item.title)}">
        <div class="h-thumb">
          ${item.thumbnail ? `<img src="${esc(item.thumbnail)}" alt="" loading="lazy" />` : ""}
        </div>
        <div class="h-info">
          <span class="h-title" title="${esc(item.title)}">${esc(item.title || "Untitled")}</span>
          <span class="h-meta">
            <span class="pill">${esc(item.quality)}</span>
            <span>${esc(item.format?.toUpperCase() || "MP4")}</span>
            ${item.sizeLabel ? `<span>${esc(item.sizeLabel)}</span>` : ""}
            <span>${timeAgo(item.at)}</span>
          </span>
        </div>
        <button class="h-redl" type="button" data-redl title="Load again" aria-label="Load again">${ICONS.retry}</button>
      </div>`).join("");
  }

  function openDrawer() {
    renderHistory();
    els.backdrop.hidden = false;
    els.drawer.hidden = false;
    requestAnimationFrame(() => {
      els.backdrop.classList.add("open");
      els.drawer.classList.add("open");
      els.drawer.setAttribute("aria-hidden", "false");
    });
  }

  function closeDrawer() {
    if (!els.drawer || els.drawer.hidden) return;
    els.backdrop.classList.remove("open");
    els.drawer.classList.remove("open");
    els.drawer.setAttribute("aria-hidden", "true");
    setTimeout(() => {
      if (!els.drawer.classList.contains("open")) {
        els.drawer.hidden = true;
        els.backdrop.hidden = true;
      }
    }, 500);
  }

  els.historyBtn?.addEventListener("click", openDrawer);
  els.closeDrawer?.addEventListener("click", closeDrawer);
  els.backdrop?.addEventListener("click", closeDrawer);
  els.clearHistory?.addEventListener("click", () => {
    saveHistory([]);
    renderHistory();
    toast("History cleared", "Local download history removed.", "ok");
  });

  els.drawerList?.addEventListener("click", (e) => {
    const item = e.target.closest("[data-url]");
    if (!item) return;
    const url = item.dataset.url;
    if (e.target.closest("[data-redl]") || item) {
      closeDrawer();
      els.input.value = url;
      paintPlatform(detect(url)?.platform || null);
      els.input.focus();
      const det = detect(url);
      if (det) analyze(det);
    }
  });

  els.drawerList?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const item = e.target.closest("[data-url]");
    if (!item) return;
    e.preventDefault();
    item.click();
  });

  /* ---------------------------------------------------------- */
  /* reveal, counters, scroll                                   */
  /* ---------------------------------------------------------- */

  function initReveal() {
    const nodes = $$(".reveal");
    nodes.forEach((node) => {
      if (node.dataset.delay) node.style.setProperty("--d", node.dataset.delay);
    });

    if (!("IntersectionObserver" in window)) {
      nodes.forEach((n) => n.classList.add("in"));
      $$("[data-counter]").forEach(animateCounter);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("in");
        $$("[data-counter]", entry.target).forEach(animateCounter);
        if (entry.target.matches("[data-counter]")) animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });

    nodes.forEach((n) => observer.observe(n));
    $$(".stats-strip, .speed-num").forEach((n) => observer.observe(n));

    // counters that aren't inside a .reveal
    const counterObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    }, { threshold: 0.5 });
    $$("[data-counter]").forEach((n) => counterObserver.observe(n));
  }

  function animateCounter(el) {
    if (el.dataset.done === "1") return;
    el.dataset.done = "1";
    const target = Number(el.dataset.counter) || 0;
    const suffix = el.dataset.suffix || "";
    const duration = 1500;
    const start = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = `${Math.round(target * eased)}${suffix}`;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function initScroll() {
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const doc = document.documentElement;
        const max = doc.scrollHeight - window.innerHeight;
        const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
        if (els.scrollBar) els.scrollBar.style.width = `${pct}%`;
        els.nav?.classList.toggle("scrolled", window.scrollY > 12);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  function initSpotlight() {
    if (window.matchMedia("(hover: none)").matches) return;
    let raf = null;
    window.addEventListener("pointermove", (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        els.spotlight?.style.setProperty("--mx", `${e.clientX}px`);
        els.spotlight?.style.setProperty("--my", `${e.clientY}px`);
      });
    }, { passive: true });
  }

  function initBentoGlow() {
    $$(".bento-card").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--cx", `${e.clientX - rect.left}px`);
        card.style.setProperty("--cy", `${e.clientY - rect.top}px`);
      });
    });
  }

  function initFaq() {
    $$(".faq-item").forEach((item) => {
      const button = $(".faq-q", item);
      button?.addEventListener("click", () => {
        const isOpen = item.classList.contains("open");
        $$(".faq-item.open").forEach((other) => {
          if (other === item) return;
          other.classList.remove("open");
          $(".faq-q", other)?.setAttribute("aria-expanded", "false");
        });
        item.classList.toggle("open", !isOpen);
        button.setAttribute("aria-expanded", String(!isOpen));
      });
    });
  }

  function initSmoothAnchors() {
    $$('a[href^="#"]').forEach((link) => {
      link.addEventListener("click", (e) => {
        const id = link.getAttribute("href").slice(1);
        const target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        if (id === "grabber") {
          setTimeout(() => els.input?.focus({ preventScroll: true }), 650);
        }
      });
    });
  }

  /* ---------------------------------------------------------- */
  /* init                                                       */
  /* ---------------------------------------------------------- */

  function init() {
    initTheme();
    initScroll();
    initSpotlight();
    initBentoGlow();
    initReveal();
    initFaq();
    initSmoothAnchors();

    // drawer starts hidden; remove the hidden attribute only when opened
    if (els.drawer) els.drawer.setAttribute("aria-hidden", "true");

    renderHistoryBadge();
    updateEngineUI();
    checkEngine();

    const year = $("#year");
    if (year) year.textContent = String(new Date().getFullYear());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
