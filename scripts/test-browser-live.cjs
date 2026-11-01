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
    this.events = [];
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
        } else if (data.method === "Runtime.exceptionThrown") {
          this.jsErrors.push(data.params.exceptionDetails.text || "Uncaught JS error");
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
    const res = await this.send("Runtime.evaluate", { expression, returnByValue: true });
    return res.result ? res.result.value : null;
  }

  async screenshot(outPath) {
    const res = await this.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(outPath, Buffer.from(res.data, "base64"));
  }
}

async function main() {
  console.log("=== Launching Headless Chrome Browser for Live Check ===");
  const browserProc = spawn(CHROME_PATH, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--disable-background-networking",
    "--window-size=1280,900",
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
    console.log(`Connected to: ${versionInfo.Browser}`);

    const targets = await getJson(`http://127.0.0.1:${PORT}/json/list`);
    const pageTarget = targets.find((t) => t.type === "page") || targets[0];
    const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.ready();

    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("DOM.enable");

    const outDir = path.join(__dirname, "../live_screenshots");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    // 1. Check Homepage
    console.log("\n[Test 1/4] Navigating to Home (http://localhost:5173/)...");
    await client.send("Page.navigate", { url: "http://localhost:5173/" });
    await sleep(1500);

    const homeTitle = await client.eval("document.title");
    const heroHeading = await client.eval("document.querySelector('h1')?.innerText || ''");
    console.log(`  ✓ Page Title: "${homeTitle}"`);
    console.log(`  ✓ Hero Heading: "${heroHeading.replace(/\n/g, ' ')}"`);
    await client.screenshot(path.join(outDir, "01_homepage.png"));

    // 2. Check Pricing Page
    console.log("\n[Test 2/4] Navigating to Pricing (http://localhost:5173/pricing)...");
    await client.send("Page.navigate", { url: "http://localhost:5173/pricing" });
    await sleep(1500);

    const pricingCards = await client.eval(`
      Array.from(document.querySelectorAll('h3, .display, [role="tab"]')).map(el => el.innerText.trim()).filter(Boolean)
    `);
    console.log("  ✓ Found Pricing Elements:", JSON.stringify(pricingCards.slice(0, 8)));
    
    // Toggle currency to INR
    console.log("  ✓ Clicking Currency / Period controls...");
    await client.eval(`
      const inrBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('INR') || b.innerText.includes('₹'));
      if (inrBtn) inrBtn.click();
    `);
    await sleep(600);
    await client.screenshot(path.join(outDir, "02_pricing.png"));

    // 3. Check Checkout Page with Ultimate plan
    console.log("\n[Test 3/4] Navigating to Checkout (http://localhost:5173/checkout?plan=ultimate&period=month&currency=INR)...");
    await client.send("Page.navigate", { url: "http://localhost:5173/checkout?plan=ultimate&period=month&currency=INR" });
    await sleep(1800);

    const checkoutHeading = await client.eval("document.querySelector('h1')?.innerText || ''");
    const planSelected = await client.eval(`
      document.querySelector('.card')?.innerText.slice(0, 100) || ''
    `);
    console.log(`  ✓ Checkout Heading: "${checkoutHeading}"`);
    console.log(`  ✓ Plan Card Summary: "${planSelected.replace(/\n/g, ' ')}"`);
    await client.screenshot(path.join(outDir, "03_checkout_ultimate.png"));

    // 4. Check Account Page
    console.log("\n[Test 4/4] Navigating to Account (http://localhost:5173/account)...");
    await client.send("Page.navigate", { url: "http://localhost:5173/account" });
    await sleep(1500);

    const currentUrl = await client.eval("window.location.href");
    console.log(`  ✓ Route resolved to: ${currentUrl}`);
    await client.screenshot(path.join(outDir, "04_account_or_auth.png"));

    // Error Summary
    console.log("\n=== Live Browser Check Summary ===");
    console.log(`Total Console Logs captured: ${client.consoleLogs.length}`);
    console.log(`Uncaught JS Errors: ${client.jsErrors.length}`);
    if (client.jsErrors.length > 0) {
      console.log("Errors:", client.jsErrors);
    } else {
      console.log("✓ Zero uncaught JS errors in the browser!");
    }
    console.log(`✓ Screenshots captured in ${outDir}`);

    client.ws.close();
  } finally {
    browserProc.kill();
  }
}

main().catch((err) => {
  console.error("Browser live check failed:", err);
  process.exit(1);
});
