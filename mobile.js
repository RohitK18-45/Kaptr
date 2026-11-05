#!/usr/bin/env node
const { spawn, execSync } = require("child_process");
const http = require("http");
const https = require("https");
const path = require("path");

const ROOT = __dirname;
const SUBDOMAIN = process.env.KAPTR_SUBDOMAIN || "kaptr-app";
let serverProcess = null;
let tunnelProcess = null;

function checkServer() {
  return new Promise((resolve) => {
    http.get("http://127.0.0.1:80/api/health", (res) => {
      resolve(res.statusCode === 200);
    }).on("error", () => resolve(false));
  });
}

function getPublicIp() {
  return new Promise((resolve) => {
    https.get("https://api.ipify.org", (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => resolve(d.trim()));
    }).on("error", () => resolve(""));
  });
}

function copyToClipboard(text) {
  try {
    if (process.platform === "win32") {
      execSync("clip", { input: text });
      return true;
    }
  } catch {}
  return false;
}

function cleanup() {
  console.log("\n  Stopping mobile tunnel and server...\n");
  if (tunnelProcess) {
    try { tunnelProcess.kill(); } catch {}
  }
  if (serverProcess) {
    try { serverProcess.kill(); } catch {}
  }
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", () => {
  if (tunnelProcess) {
    try { tunnelProcess.kill(); } catch {}
  }
  if (serverProcess) {
    try { serverProcess.kill(); } catch {}
  }
});

(async () => {
  console.log("\n  [1/2] Checking local engine...");
  const running = await checkServer();
  if (!running) {
    console.log("  → Starting Kaptr local engine on port 80...");
    serverProcess = spawn("node", ["server.js"], {
      cwd: ROOT,
      stdio: "ignore",
      detached: false,
    });
    await new Promise((r) => setTimeout(r, 1200));
  } else {
    console.log("  ✓ Kaptr local engine is already active on port 80");
  }

  console.log(`  [2/2] Claiming permanent mobile link: https://${SUBDOMAIN}.loca.lt...\n`);

  const publicIpPromise = getPublicIp();

  tunnelProcess = spawn("npx", ["--yes", "localtunnel", "--port", "80", "--subdomain", SUBDOMAIN], {
    shell: true,
  });

  let foundUrl = false;

  const handleOutput = async (chunk) => {
    const text = chunk.toString();
    const match = text.match(/https:\/\/[a-z0-9-]+\.loca\.lt/i);
    if (match && !foundUrl) {
      foundUrl = true;
      const url = match[0];
      const copied = copyToClipboard(url);
      const publicIp = await publicIpPromise;

      console.clear();
      console.log("\n  ========================================================================");
      console.log("                   KAPTR — PERMANENT MOBILE LINK READY                    ");
      console.log("  ========================================================================\n");
      console.log("    Permanent Link for your phone (Safari / Chrome / Any Browser):\n");
      console.log(`    👉  \x1b[36m\x1b[1m${url}\x1b[0m\n`);
      if (copied) {
        console.log("    \x1b[32m✓ Link copied to your Windows clipboard! (Paste to WhatsApp/chat)\x1b[0m\n");
      }
      if (publicIp) {
        console.log(`    \x1b[90mTunnel Password (if prompted once on phone): ${publicIp}\x1b[0m\n`);
      }
      console.log("    • THIS LINK NEVER CHANGES: Bookmark or 'Add to Home Screen' once.");
      console.log("    • Works from anywhere in the world on mobile data (4G/5G) or Wi-Fi.");
      console.log("    • Runs on demand: only active while this window is open.\n");
      console.log("    \x1b[33mPress Ctrl+C or close this window when you are done.\x1b[0m\n");
      console.log("  ========================================================================\n");
    }
  };

  tunnelProcess.stdout.on("data", handleOutput);
  tunnelProcess.stderr.on("data", handleOutput);

  tunnelProcess.on("close", (code) => {
    if (!foundUrl) {
      console.error("\n  ! Could not establish tunnel (code " + code + "). Retrying or check connection.\n");
    }
    cleanup();
  });
})();
