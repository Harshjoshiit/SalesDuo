// ============================================================================
// SalesDuo Backend (index.js) - FINAL VERSION
// Includes: Scraping, Gemini AI, Sequelize/MySQL DB, and Safe History Routes
// ============================================================================

const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");
require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Sequelize, DataTypes } = require("sequelize"); 

const app = express();
// Ensure CORS is set correctly for your frontend URL
const ALLOWED_ORIGINS = [
    "http://localhost:5173", 
    process.env.FRONTEND_URL
].filter(Boolean); // Filter(Boolean) removes 'undefined' if the variable is not set

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

// ============================================================================
// DB Setup and Model Definition
// ============================================================================
// 1. Global flag to track database connectivity status
let isDbConnected = false; 

// Initialize Sequelize
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    // Provide a default fallback if DB_DIALECT is undefined (crucial for Render/Vercel)
    dialect: process.env.DB_DIALECT || 'mysql', 
    logging: false,
  }
);

// Define the Optimization History Model
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

// Attempt to connect and sync the database model
async function connectDB() {
  try {
    await sequelize.authenticate();
    await OptimizationHistory.sync(); 
    
    // Set flag to true on success
    isDbConnected = true; 
    console.log("✅ DB Connection has been established successfully.");
    console.log("✅ OptimizationHistory table synced.");
  } catch (error) {
    // Keep flag false on failure and log the reason
    isDbConnected = false;
    console.error("❌ Unable to connect to the database:", error.message);
    console.error("💡 HISTORY/SAVE FUNCTIONALITY DISABLED: Database connection failed. Ensure all DB variables are configured in the environment.");
  }
}

connectDB();

// ============================================================================
// Gemini Setup & Helper
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
// ROUTE 1: Fetch Amazon Product (Scraping)
// ============================================================================
app.get("/api/fetch/:asin", async (req, res) => {
  const { asin } = req.params;
  let browser;

  try {
    // Launch headless browser (might require specific environment config on Render)
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

    const data = await page.evaluate(() => {
      // Logic to scrape Title, Bullets, and Description
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
    console.error("❌ Scraping failed:", err.message);
    res.status(500).json({ error: "Scraping failed" });
  }
});

// ============================================================================
// ROUTE 2: AI Optimization
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

  // Prompt based on Amazon SEO Expert persona
  const prompt = `
You are an Amazon SEO expert.

TASK:
Rewrite the following Amazon product listing with improved clarity,
keyword relevance, and conversion rate.

IMPORTANT RULES:
- Do NOT copy sentences from the original
- Do NOT use generic phrases like "intended use", "product category", or placeholders
- Content must be specific to THIS product
- No emojis
- No exaggerated or unverified claims
- Follow Amazon listing guidelines

PRODUCT:
Title:
${data.title}

Bullets:
${data.bullets.join("\n")}

Description:
${data.description}

OUTPUT FORMAT (STRICT):
Return ONLY valid JSON in this structure.
Do NOT add any explanation or extra text.

{
  "title": "optimized title (max 200 chars)",
  "bullets": [
    "benefit focused bullet 1",
    "benefit focused bullet 2",
    "benefit focused bullet 3",
    "benefit focused bullet 4",
    "benefit focused bullet 5"
  ],
  "description": "clear persuasive description (max 500 chars)",
  "keywords": [
    "keyword phrase 1",
    "keyword phrase 2",
    "keyword phrase 3",
    "keyword phrase 4",
    "keyword phrase 5"
  ]
}
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
// ROUTE 3: Save Optimization History (DB Guarded)
// ============================================================================
app.post("/api/save", async (req, res) => {
  // Graceful exit if DB is not connected (e.g., in deployment without credentials)
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

// ============================================================================
// ROUTE 4: Fetch Optimization History (DB Guarded)
// ============================================================================
app.get("/api/history", async (req, res) => {
  // Graceful exit if DB is not connected
  if (!isDbConnected) {
    // Return empty array with a warning status (so the frontend doesn't crash)
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
    // If successful, return the actual history data
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
  // Log status on server start for deployment environments
  if (!isDbConnected) {
    console.log("⚠️ WARNING: History/Save feature is offline due to database connection failure.");
  }
});
