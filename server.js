const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
const PORT = process.env.PORT || 8080;

// Security configuration - customize these values as needed
const SECURITY_HEADER_NAME =
  process.env.SECURITY_HEADER_NAME || "X-Screenshot-Token";
const SECURITY_HEADER_VALUE =
  process.env.SECURITY_HEADER_VALUE || "your-secret-token-here";

let browser;
let pagePool = [];
const MAX_PAGES = 3;
const PAGE_TTL = 60000;

// Security middleware to validate required header
function validateSecurityHeader(req, res, next) {
  const headerValue = req.headers[SECURITY_HEADER_NAME.toLowerCase()];

  if (!headerValue) {
    return res.status(401).json({
      error: "Missing security header",
      message: `Required header: ${SECURITY_HEADER_NAME}`,
    });
  }

  if (headerValue !== SECURITY_HEADER_VALUE) {
    return res.status(403).json({
      error: "Invalid security token",
      message: "The provided security token is invalid",
    });
  }

  next();
}

async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: "new",
    });
    console.log("🚀 Browser launched");
  }
  return browser;
}

async function getPage() {
  const now = Date.now();
  for (let i = 0; i < pagePool.length; i++) {
    if (!pagePool[i].busy) {
      pagePool[i].busy = true;
      pagePool[i].lastUsed = now;
      return pagePool[i].page;
    }
  }
  if (pagePool.length < MAX_PAGES) {
    const b = await getBrowser();
    const page = await b.newPage();
    pagePool.push({ page, busy: true, lastUsed: now });
    return page;
  }
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      for (let i = 0; i < pagePool.length; i++) {
        if (!pagePool[i].busy) {
          pagePool[i].busy = true;
          pagePool[i].lastUsed = Date.now();
          clearInterval(interval);
          resolve(pagePool[i].page);
        }
      }
    }, 100);
  });
}

function releasePage(page) {
  const entry = pagePool.find((p) => p.page === page);
  if (entry) {
    entry.busy = false;
    entry.lastUsed = Date.now();
  }
}

setInterval(async () => {
  const now = Date.now();
  for (let i = pagePool.length - 1; i >= 0; i--) {
    const entry = pagePool[i];
    if (!entry.busy && now - entry.lastUsed > PAGE_TTL) {
      console.log("🧹 Closing idle page");
      await entry.page.close();
      pagePool.splice(i, 1);
    }
  }
}, 30000);

// Apply security middleware to screenshot endpoint
app.get("/screenshot", validateSecurityHeader, async (req, res) => {
  const {
    url,
    format = "jpg",
    full_page = "true",
    clip_x,
    clip_y,
    clip_width,
    clip_height,
    selector,
    delay = 0,
    image_quality = 80,
    timeout = 30,
  } = req.query;

  if (!url) {
    return res.status(400).send("Missing ?url parameter");
  }

  let page;
  try {
    page = await getPage();

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: parseInt(timeout) * 1000,
    });

    if (delay > 0) {
      await new Promise((r) => setTimeout(r, parseInt(delay) * 1000));
    }

    let screenshotOptions = {
      type: format === "jpg" ? "jpeg" : "png",
      fullPage: full_page === "true",
      quality: format === "jpg" ? parseInt(image_quality) : undefined,
    };

    // If selector is provided, screenshot that element
    if (selector) {
      const element = await page.$(selector);
      if (!element) throw new Error(`Selector not found: ${selector}`);
      screenshotOptions = {
        ...screenshotOptions,
        clip: await element.boundingBox(),
      };
    }

    // If clip dimensions are provided
    if (clip_width && clip_height) {
      screenshotOptions.clip = {
        x: parseInt(clip_x) || 0,
        y: parseInt(clip_y) || 0,
        width: parseInt(clip_width),
        height: parseInt(clip_height),
      };
    }

    const screenshot = await page.screenshot(screenshotOptions);

    releasePage(page);

    res.set("Content-Type", format === "jpg" ? "image/jpeg" : "image/png");
    res.send(screenshot);
  } catch (err) {
    console.error("❌ Screenshot error:", err);
    if (page) releasePage(page);
    res.status(500).send("Error taking screenshot");
  }
});

// Health check endpoint (no security required)
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

process.on("SIGINT", async () => {
  console.log("🛑 Shutting down...");
  if (browser) await browser.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Screenshot service running on port ${PORT}`);
  console.log(`🔒 Security header required: ${SECURITY_HEADER_NAME}`);
});
