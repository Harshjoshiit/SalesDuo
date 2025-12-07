// ============================================================================
// SalesDuo Backend (index.js) — FINAL ROBUST VERSION
// Works locally with MySQL + safely on Render without DB
// ============================================================================

const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");
require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Sequelize, DataTypes } = require("sequelize");

const app = express();
app.use(cors());
app.use(express.json());

// ============================================================================
// DATABASE (OPTIONAL — LOCAL ONLY)
// ============================================================================

let sequelize = null;
let OptimizationHistory = null;

if (process.env.DB_HOST && process.env.DB_HOST !== "dummy") {
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
      host: process.env.DB_HOST,
      dialect: process.env.DB_DIALECT || "mysql",
      logging: false,
    }
  );

  OptimizationHistory = sequelize.define(
    "OptimizationHistory",
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      asin: { type: DataTypes.STRING(20), allowNull: false },
      original_title: { type: DataTypes.STRING(255), allowNull: false },
      original_bullets: { type: DataTypes.JSON },
      original_description: { type: DataTypes.TEXT },
      optimized_title: { type: DataTypes.STRING(255), allowNull: false },
      optimized_bullets: { type: DataTypes.JSON },
      optimized_description: { type: DataTypes.TEXT },
      optimized_keywords: { type: DataTypes.JSON },
      ai_model: { type: DataTypes.STRING(50) },
    },
    { tableName: "optimization_history" }
  );
}

// DB Connection
async function connectDB() {
  if (!sequelize) {
    console.log("⚠️ Database disabled (cloud demo mode)");
    return;
  }

  try {
    await sequelize.authenticate();
    await OptimizationHistory.sync();
    console.log("✅ Database connected & synced");
  } catch (err) {
    console.error("❌ Database error:", err.message);
  }
}

connectDB();

// ============================================================================
// GEMINI SETUP
// ============================================================================

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function extractJSON(text) {
  try {
    const cleaned = text.replace(/```json|```/gi, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

// ============================================================================
// ROUTE 1: AMAZON SCRAPING
// ============================================================================

app.get("/api/fetch/:asin", async (req, res) => {
  const { asin } = req.params;
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120"
    );

    await page.goto(`https://www.amazon.com/dp/${asin}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    const data = await page.evaluate(() => ({
      title:
        document.querySelector("#productTitle")?.innerText.trim() || "",
      bullets: Array.from(
        document.querySelectorAll("#feature-bullets li span")
      )
        .map((b) => b.textContent.trim())
        .filter((b) => b.length > 20)
        .slice(0, 8),
      description:
        document.querySelector("#productDescription")?.innerText || "",
    }));

    await browser.close();

    if (!data.title) {
      return res.status(404).json({ error: "Invalid ASIN or blocked" });
    }

    res.json({ success: true, data });
  } catch (err) {
    if (browser) await browser.close();
    res.status(500).json({ error: "Scraping failed" });
  }
});

// ============================================================================
// ROUTE 2: AI OPTIMIZATION
// ============================================================================

app.post("/api/optimize", async (req, res) => {
  const { asin, data } = req.body;
  if (!data?.title) return res.status(400).json({ error: "Invalid input" });

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-pro",
    generationConfig: { temperature: 0.4 },
  });

  const prompt = `
You are an Amazon SEO expert.

Rewrite this product listing with clarity, relevance, and compliance.
Rules:
- No copying phrases
- No placeholders or generic wording
- No emojis or false claims
- JSON ONLY

Title: ${data.title}
Bullets: ${data.bullets.join("\n")}
Description: ${data.description}

Return:
{
  "title": "...",
  "bullets": ["...", "...", "...", "...", "..."],
  "description": "...",
  "keywords": ["...", "...", "...", "...", "..."]
}
`;

  try {
    const result = await model.generateContent(prompt);
    const optimized = extractJSON(result.response.text());

    if (!optimized) throw new Error("Invalid AI output");

    res.json({
      success: true,
      optimized,
      ai_used: "gemini-2.5-pro",
    });
  } catch {
    res.json({
      success: true,
      optimized: {
        title: `${data.title} – Improved Listing`,
        bullets: data.bullets.slice(0, 5),
        description: data.description,
        keywords: data.title.split(" ").slice(0, 5),
      },
      ai_used: "fallback",
    });
  }
});

// ============================================================================
// ROUTE 3: SAVE HISTORY (OPTIONAL)
// ============================================================================

app.post("/api/save", async (req, res) => {
  if (!OptimizationHistory) {
    return res.json({ success: true, message: "History disabled in cloud mode" });
  }

  try {
    const record = await OptimizationHistory.create(req.body);
    res.status(201).json({ success: true, record });
  } catch {
    res.status(500).json({ error: "Failed to save history" });
  }
});

// ============================================================================
// ROUTE 4: FETCH HISTORY (OPTIONAL)
// ============================================================================

app.get("/api/history", async (req, res) => {
  if (!OptimizationHistory) return res.json([]);

  const history = await OptimizationHistory.findAll({
    order: [["createdAt", "DESC"]],
    limit: 50,
  });

  res.json(history);
});

// ============================================================================
// SERVER
// ============================================================================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Backend running on port ${PORT}`)
);
