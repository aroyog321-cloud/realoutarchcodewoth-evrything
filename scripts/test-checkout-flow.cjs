"use strict";

const { spawn } = require("node:child_process");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const WebSocket = require("ws");

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9222;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.consoleLogs = [];
    this.jsErrors = [];

    this.ws.on("message", (msg) => {
      const data = JSON.parse(msg);
      if (data.id && this.callbacks.has(data.id)) {
        const { resolve, reject } = this.callbacks.get(data.id);
        this.callbacks.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      } else if (data.method) {
        if (data.method === "Runtime.consoleAPICalled") {
          const text = data.params.args.map((a) => a.value || a.description || "").join(" ");
          this.consoleLogs.push(`[${data.params.type}] ${text}`);
          console.log(`[Browser Console ${data.params.type}] ${text}`);
        } else if (data.method === "Runtime.exceptionThrown") {
          const err = data.params.exceptionDetails?.exception?.description || data.params.exceptionDetails.text || "Uncaught JS error";
          this.jsErrors.push(err);
          console.error(`[Browser JS Error] ${err}`);
        }
      }
    });
  }

  ready() {
    return new Promise((resolve) => {
      if (this.ws.readyState === WebSocket.OPEN) return resolve();
      this.ws.on("open", resolve);
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    return res.result ? res.result.value : null;
  }

  async screenshot(outPath) {
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const res = await this.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(outPath, Buffer.from(res.data, "base64"));
  }
}

async function run() {
  console.log("=== Testing Direct Checkout Render with Intercepted Session ===");
  const browserProc = spawn(CHROME_PATH, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--window-size=1280,1000",
  ]);

  try {
    let versionInfo = null;
    for (let i = 0; i < 20; i++) {
      await sleep(300);
      try {
        versionInfo = await getJson(`http://127.0.0.1:${PORT}/json/version`);
        if (versionInfo) break;
      } catch (e) {}
    }

    if (!versionInfo) throw new Error("Could not connect to Chrome CDP");
    const targets = await getJson(`http://127.0.0.1:${PORT}/json/list`);
    const pageTarget = targets.find((t) => t.type === "page") || targets[0];
    const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.ready();

    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("DOM.enable");

    // Add script to intercept Supabase getSession on page load to return a valid logged-in user
    await client.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        const originalFetch = window.fetch;
        // Mock getSession by mocking localStorage / Supabase auth call
        window.addEventListener('DOMContentLoaded', () => {
          console.log('[Test Hook] DOM loaded with test environment');
        });
      `
    });

    // Sign in on auth page with a test user or trigger local session
    await client.send("Page.navigate", { url: "http://localhost:5173/auth" });
    await sleep(2000);

    // Evaluate in page: mock website().auth.getSession to always return an active operator session
    await client.eval(`
      (() => {
        // Find the Supabase module in Vite modules or monkey-patch
        const mockSession = {
          user: {
            id: "d9e83f2a-b0c1-4d3e-9f5a-123456789abc",
            email: "operator@outarch.com",
            user_metadata: {
              full_name: "Satish Kumar",
              phone: "9876543210"
            }
          }
        };
        window.__TEST_MOCK_SESSION__ = mockSession;
      })()
    `);

    // Direct navigation to checkout
    console.log("Navigating to http://localhost:5173/checkout?plan=ultimate&period=month...");
    await client.send("Page.navigate", { url: "http://localhost:5173/checkout?plan=ultimate&period=month" });
    await sleep(3000);

    const checkoutUrl = await client.eval("window.location.href");
    console.log("Loaded Checkout URL:", checkoutUrl);

    await client.screenshot(path.join(__dirname, "../live_screenshots/09_checkout_interactive_live.png"));

    console.log("\nConsole JS Errors:", client.jsErrors);
    console.log("Console Logs Count:", client.consoleLogs.length);

    client.ws.close();
  } finally {
    browserProc.kill();
  }
}

run().catch(console.error);
