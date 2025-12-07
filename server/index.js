// ============================================================================
// SalesDuo Backend – FINAL STABLE VERSION
// ✅ Axios + Cheerio scraping (Render safe)
// ✅ Gemini AI
// ✅ Sequelize/MySQL (DB guarded)
// ✅ Correct CORS for local + Vercel
// ============================================================================

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Sequelize, DataTypes } = require("sequelize");

const app = express();

/* ======================= CORS (FIXED) ======================= */
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://salesduoiitp.vercel.app"
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS not allowed"));
    },
  })
);

app.use(express.json());

/* ======================= DB SETUP ======================= */
let isDbConnected = false;

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT || "mysql",
    logging: false,
  }
);

const OptimizationHistory = sequelize.define(
  "OptimizationHistory",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    asin: { type: DataTypes.STRING(20), allowNull: false },
    original_title: { type: DataTypes.STRING(255) },
    original_bullets: { type: DataTypes.JSON },
    original_description: { type: DataTypes.TEXT },
    optimized_title: { type: DataTypes.STRING(255) },
    optimized_bullets: { type: DataTypes.JSON },
    optimized_description: { type: DataTypes.TEXT },
    optimized_keywords: { type: DataTypes.JSON },
    ai_model: { type: DataTypes.STRING(50) },
  },
  { tableName: "optimization_history" }
);

(async function connectDB() {
  try {
    await sequelize.authenticate();
    await OptimizationHistory.sync();
    isDbConnected = true;
    console.log("✅ DB connected");
  } catch (err) {
    isDbConnected = false;
    console.warn("⚠️ DB disabled:", err.message);
  }
})();

/* ======================= GEMINI ======================= */
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function extractJSON(text) {
  try {
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

/* ======================= FETCH (Axios + Cheerio) ======================= */
app.get("/api/fetch/:asin", async (req, res) => {
  const { asin } = req.params;

  try {
    const url = `https://www.amazon.com/dp/${asin}`;

    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 20000,
    });

    const $ = cheerio.load(response.data);

    const title = $("#productTitle").text().trim();

    const bullets = $("#feature-bullets li span")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((b) => b.length > 20)
      .slice(0, 8);

    const description =
      $("#productDescription").text().trim() ||
      $("#aplus").text().trim() ||
      "";

    if (!title) {
      return res.status(404).json({
        error: "Invalid ASIN or Amazon blocked request",
      });
    }

    res.json({
      success: true,
      data: { title, bullets, description },
    });
  } catch (err) {
    console.error("❌ Scraping failed:", err.message);
    res.status(500).json({
      error: "Scraping failed",
      details: err.message,
    });
  }
});

/* ======================= OPTIMIZE ======================= */
app.post("/api/optimize", async (req, res) => {
  const { asin, data } = req.body;

  if (!data?.title) {
    return res.status(400).json({ error: "Missing product data" });
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { temperature: 0.4 },
  });

  const prompt = `
You are an Amazon SEO expert.
Rewrite the listing and return ONLY valid JSON.

TITLE:
${data.title}

BULLETS:
${(data.bullets || []).join("\n")}

DESCRIPTION:
${data.description}

FORMAT:
{
  "title": "",
  "bullets": [],
  "description": "",
  "keywords": []
}
`;

  try {
    const result = await model.generateContent(prompt);
    const optimized = extractJSON(result.response.text());

    if (!optimized) throw new Error("Invalid JSON from Gemini");

    res.json({
      success: true,
      optimized,
      ai_used: "gemini-2.5-flash",
    });
  } catch (err) {
    console.error("❌ Gemini failed:", err.message);

    res.json({
      success: true,
      optimized: {
        title: `${data.title} – Improved Listing`,
        bullets: [
          "High-quality design for everyday use",
          "Durable construction for reliable performance",
          "Optimized for comfort and usability",
          "Carefully crafted with attention to detail",
          "Suitable for a wide range of applications",
        ],
        description: "Fallback AI content generated due to processing error.",
        keywords: data.title.split(" ").slice(0, 5),
      },
      ai_used: "fallback",
    });
  }
});

/* ======================= SAVE (DB GUARDED) ======================= */
app.post("/api/save", async (req, res) => {
  if (!isDbConnected) {
    return res.status(503).json({ error: "Database unavailable" });
  }

  try {
    const record = await OptimizationHistory.create(req.body);
    res.status(201).json({ success: true, record });
  } catch (err) {
    res.status(500).json({ error: "Save failed" });
  }
});

/* ======================= HISTORY (DB GUARDED) ======================= */
app.get("/api/history", async (req, res) => {
  if (!isDbConnected) return res.json([]);

  const history = await OptimizationHistory.findAll({
    order: [["createdAt", "DESC"]],
    limit: 50,
  });

  res.json(history);
});

/* ======================= SERVER ======================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
