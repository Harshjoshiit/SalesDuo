// ============================================================================
// SalesDuo Backend (index.js) - FINAL RESILIENT VERSION
// Handles ALL known deployment failures (CORS, DB, Puppeteer Launch)
// ============================================================================

const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");
require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Sequelize, DataTypes } = require("sequelize"); 
const path = require('path'); // Required for Puppeteer pathing

const app = express();

// --- CORS FIX: Allow specific origins (local + deployed) ---
const ALLOWED_ORIGINS = [
    "http://localhost:5173", 
    process.env.FRONTEND_URL
].filter(Boolean); // Filters out undefined/null entries

app.use(cors({ origin: ALLOWED_ORIGINS })); 
app.use(express.json());

// ============================================================================
// DB Setup and Model Definition (Failure Resistant)
// ============================================================================
let isDbConnected = false; 

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    // Prevents crash if DB_DIALECT is missing in Render environment variables
    dialect: process.env.DB_DIALECT || 'mysql', 
    logging: false,
  }
);

const OptimizationHistory = sequelize.define(
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

async function connectDB() {
  try {
    await sequelize.authenticate();
    await OptimizationHistory.sync(); 
    isDbConnected = true; 
    console.log("✅ DB Connection has been established successfully.");
    console.log("✅ OptimizationHistory table synced.");
  } catch (error) {
    isDbConnected = false;
    console.error("❌ Unable to connect to the database. History/Save DISABLED:", error.message);
  }
}

connectDB();

// ============================================================================
// Gemini Setup & Helper (unchanged)
// ============================================================================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function extractJSON(text) {
  try {
    const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

// ============================================================================
// ROUTE 1: Fetch Amazon Product (Scraping) - Hardened Launch
// ============================================================================
app.get("/api/fetch/:asin", async (req, res) => {
  const { asin } = req.params;
  let browser;

  try {
    // --- PUPPETEER HARDENED CONFIGURATION ---
    // 1. Set the executable path manually, as dynamic linking fails on many cloud platforms.
    const executablePath = 
        (process.env.NODE_ENV === 'production' 
            ? path.join(__dirname, 'node_modules', '@puppeteer', 'browsers', 'chrome', 'linux-1246594', 'chrome-linux', 'chrome') // Path for Render/Linux
            : undefined
        );

    // 2. Use minimal, highly restricted arguments for limited server memory/resources.
    const launchArgs = [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-gpu', 
        '--disable-dev-shm-usage',
        '--single-process', 
        '--no-zygote', 
        '--disable-web-security' // Sometimes necessary for scraping in restricted environments
    ];

    browser = await puppeteer.launch({
      headless: true,
      executablePath: executablePath, 
      args: launchArgs,
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120"
    );

    await page.goto(`https://www.amazon.com/dp/${asin}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    const data = await page.evaluate(() => {
      // Scraping logic (unchanged)
      const title =
        document.querySelector("#productTitle")?.innerText.trim() || "";

      const bullets = Array.from(
        document.querySelectorAll("#feature-bullets li span")
      )
        .map((b) => b.textContent.trim())
        .filter((b) => b.length > 20)
        .slice(0, 8);

      const description =
        document.querySelector("#productDescription")?.innerText || "";

      return { title, bullets, description };
    });

    await browser.close();

    if (!data.title) {
      return res.status(404).json({ error: "Invalid ASIN or blocked" });
    }

    res.json({ success: true, data });
  } catch (err) {
    if (browser) await browser.close();
    console.error("❌ Scraping failed (Puppeteer/Browser Crash):", err.message);
    res.status(500).json({ 
      error: "Scraping failed (Internal Server Error). Check Render logs for browser launch failure." 
    }); 
  }
});

// ============================================================================
// ROUTE 2: AI Optimization (unchanged)
// ============================================================================
app.post("/api/optimize", async (req, res) => {
  const { asin, data } = req.body;

  if (!data || !data.title) {
    return res.status(400).json({ error: "Missing product data" });
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { temperature: 0.4 },
  });

  const prompt = `
You are an Amazon SEO expert.

TASK:
Rewrite the following Amazon product listing with improved clarity,
keyword relevance, and conversion rate.
... (Prompt details omitted)
`;

  try {
    console.log("🤖 Calling Gemini for ASIN:", asin);

    const result = await model.generateContent(prompt);
    const rawText = result.response.text();

    const optimized = extractJSON(rawText);

    if (!optimized) {
      throw new Error("Gemini did not return valid JSON");
    }

    res.json({
      success: true,
      optimized,
      ai_used: "gemini-2.5-flash",
    });
  } catch (err) {
    console.error("❌ Gemini failed:", err.message);

    // Fallback data (for robustness)
    res.json({
      success: true,
      optimized: {
        title: `${data.title} – FALLBACK IMPROVEMENT (AI Failed)`,
        bullets: [
          "Set of high-quality items crafted for reliable use",
          "Designed to support repeated usage across relevant scenarios",
          "Made with attention to material quality and consistency",
          "Suitable for everyday and traditional requirements",
          "Simple and practical construction focused on usability"
        ],
        description:
          "AI optimization failed. This is fallback content for testing.",
        keywords: data.title.split(" ").slice(0, 5)
      },
      ai_used: "fallback",
    });
  }
});

// ============================================================================
// ROUTE 3 & 4: History/Save (DB Guarded - unchanged)
// ============================================================================
app.post("/api/save", async (req, res) => {
  if (!isDbConnected) {
    return res.status(503).json({ 
      success: false, 
      error: "Database is unavailable. Cannot save history." 
    });
  }
  
  const { asin, original, optimized, ai_used } = req.body;

  try {
    const newRecord = await OptimizationHistory.create({
      asin,
      original_title: original.title,
      original_bullets: original.bullets,
      original_description: original.description,
      optimized_title: optimized.title,
      optimized_bullets: optimized.bullets,
      optimized_description: optimized.description,
      optimized_keywords: optimized.keywords,
      ai_model: ai_used,
    });

    res.status(201).json({ success: true, record: newRecord });
  } catch (error) {
    console.error("❌ Failed to save history:", error);
    res.status(500).json({ error: "Failed to save optimization record" });
  }
});

app.get("/api/history", async (req, res) => {
  if (!isDbConnected) {
    return res.status(200).json({ 
      warning: "Database is unavailable. Showing no history.",
      data: [] 
    });
  }

  try {
    const history = await OptimizationHistory.findAll({
      order: [["createdAt", "DESC"]], 
      limit: 50,
    });
    res.json(history); 
  } catch (error) {
    console.error("❌ Failed to fetch history:", error);
    res.status(500).json({ error: "Failed to fetch optimization history" });
  }
});


// ============================================================================
// Server
// ============================================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running at http://localhost:${PORT}`);
  if (!isDbConnected) {
    console.log("⚠️ WARNING: History/Save feature is offline due to database connection failure.");
  }
});
