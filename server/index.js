// ============================================================================
// SalesDuo Backend (DBMS DISABLED VERSION)
// Safe for Render deployment
// ============================================================================

const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");
require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

/* ================= CORS ================= */
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

/* ================= GEMINI ================= */
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function extractJSON(text) {
  try {
    const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

/* ================= FETCH AMAZON ================= */
app.get("/api/fetch/:asin", async (req, res) => {
  const { asin } = req.params;
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120"
    );

    await page.goto(`https://www.amazon.com/dp/${asin}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    const data = await page.evaluate(() => {
      const title =
        document.querySelector("#productTitle")?.innerText.trim() || "";

      const bullets = Array.from(
        document.querySelectorAll("#feature-bullets li span")
      )
        .map(b => b.textContent.trim())
        .filter(b => b.length > 20)
        .slice(0, 8);

      const description =
        document.querySelector("#productDescription")?.innerText || "";

      return { title, bullets, description };
    });

    await browser.close();

    if (!data.title) {
      return res.status(404).json({ error: "Invalid ASIN or blocked by Amazon" });
    }

    res.json({ success: true, data });

  } catch (err) {
    if (browser) await browser.close();
    console.error("❌ Puppeteer failed:", err.message);
    res.status(500).json({
      error: "Scraping failed. Render blocks headless Chrome intermittently."
    });
  }
});

/* ================= OPTIMIZE ================= */
app.post("/api/optimize", async (req, res) => {
  const { asin, data } = req.body;

  if (!data?.title) {
    return res.status(400).json({ error: "Missing product data" });
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { temperature: 0.4 }
  });

  const prompt = `
You are an Amazon SEO expert.

Rewrite the listing using best practices.
Return STRICT JSON with:
{
  "title": "",
  "bullets": [],
  "description": "",
  "keywords": []
}

ORIGINAL TITLE:
${data.title}

BULLETS:
${(data.bullets || []).join("\n")}

DESCRIPTION:
${data.description}
`;

  try {
    const result = await model.generateContent(prompt);
    const rawText = result.response.text();
    const optimized = extractJSON(rawText);

    if (!optimized) throw new Error("Invalid JSON from Gemini");

    res.json({
      success: true,
      optimized,
      ai_used: "gemini-2.5-flash"
    });

  } catch (err) {
    console.error("❌ Gemini failed:", err.message);

    res.json({
      success: true,
      optimized: {
        title: `${data.title} – Improved Listing`,
        bullets: [
          "High-quality product designed for consistent performance",
          "Thoughtfully crafted to meet everyday user needs",
          "Reliable construction using durable materials",
          "Optimized for usability and customer satisfaction",
          "Ideal for repeated use in practical scenarios"
        ],
        description:
          "AI optimization failed. Returning fallback optimized content.",
        keywords: data.title.split(" ").slice(0, 5)
      },
      ai_used: "fallback"
    });
  }
});

/* ================= SAVE (DB DISABLED) ================= */
app.post("/api/save", (req, res) => {
  return res.status(503).json({
    success: false,
    error: "Database disabled. Save feature unavailable."
  });
});

/* ================= HISTORY (DB DISABLED) ================= */
app.get("/api/history", (req, res) => {
  res.json([]);
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
  console.log("⚠️ DBMS permanently DISABLED in this build");
});
