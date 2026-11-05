#!/usr/bin/env node
const { spawn, execSync } = require("child_process");
const http = require("http");
const path = require("path");

const ROOT = __dirname;
let serverProcess = null;
let tunnelProcess = null;

function checkServer() {
  return new Promise((resolve) => {
    http.get("http://127.0.0.1:80/api/health", (res) => {
      resolve(res.statusCode === 200);
    }).on("error", () => resolve(false));
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
    // Wait 1 second for server to bind
    await new Promise((r) => setTimeout(r, 1200));
  } else {
    console.log("  ✓ Kaptr local engine is already active on port 80");
  }

  console.log("  [2/2] Generating secure mobile link via Cloudflare...\n");

  tunnelProcess = spawn("npx", ["--yes", "cloudflared", "tunnel", "--url", "http://127.0.0.1:80"], {
    shell: true,
  });

  let foundUrl = false;

  const handleOutput = (chunk) => {
    const text = chunk.toString();
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (match && !foundUrl) {
      foundUrl = true;
      const url = match[0];
      const copied = copyToClipboard(url);

      console.clear();
      console.log("\n  ========================================================================");
      console.log("                       KAPTR — MOBILE LINK READY                        ");
      console.log("  ========================================================================\n");
      console.log("    Open this link on your phone (Safari / Chrome / Any Browser):\n");
      console.log(`    👉  \x1b[36m\x1b[1m${url}\x1b[0m\n`);
      if (copied) {
        console.log("    \x1b[32m✓ Link copied to your Windows clipboard! (Paste to WhatsApp/chat)\x1b[0m\n");
      }
      console.log("    • Works from anywhere (Wi-Fi, 4G, 5G).");
      console.log("    • Fast, secure, and no passwords or verification needed.");
      console.log("    • Add to Home Screen on your phone for a full-screen app experience.\n");
      console.log("    \x1b[33mPress Ctrl+C or close this window when you are done.\x1b[0m\n");
      console.log("  ========================================================================\n");
    }
  };

  tunnelProcess.stdout.on("data", handleOutput);
  tunnelProcess.stderr.on("data", handleOutput);

  tunnelProcess.on("close", (code) => {
    if (!foundUrl) {
      console.error("\n  ! Could not establish tunnel (code " + code + "). Check internet connection.\n");
    }
    cleanup();
  });
})();
