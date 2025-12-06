# 🚀 SalesDuo — AI-Powered Amazon Product Listing Optimizer

SalesDuo is a full-stack web application that uses **Generative AI** to optimize Amazon product listings by enhancing **titles, bullet points, descriptions, and SEO keywords** using an ASIN as input.

This project demonstrates **real-world AI integration, strong prompt-engineering discipline, ORM-based database design, and deployment-ready architecture**.

---

## 🌐 Live Demo

🔗 **Frontend (Vercel):** [https://salesduoiitp.vercel.app/](https://salesduoiitp.vercel.app/)

> The deployed demo showcases **real Amazon scraping + AI optimization**. MySQL-backed history is enabled **locally** and can be switched to a managed cloud database via environment variables.

---

## ✨ Features

* 🔍 **ASIN-based product scraping** using Puppeteer
* 🤖 **AI-powered listing optimization** (Google Gemini 2.5)
* 📝 Generates:

  * Keyword-rich optimized title
  * Benefit-focused bullet points (Amazon-compliant)
  * Clear and persuasive product descriptions
  * 3–5 SEO-friendly keyword phrases
* 📜 **Optimization history** stored using MySQL + Sequelize ORM
* ⚙️ Strict JSON-only AI responses for reliability
* 🧩 Clean frontend / backend separation (monorepo)

---

## 🧠 AI Prompt Engineering (Core of This Project)

The **Gemini prompt** is intentionally designed to prevent common LLM failures such as:

* Generic filler content
* Copy-paste of original text
* Cross-product contamination
* Marketing exaggeration

### 🔒 Prompt Design Principles

The backend prompt enforces the following constraints:

* ❌ No reuse of original sentences
* ❌ No generic phrases (e.g. "intended purpose", "product category")
* ✅ Content must remain **product-specific**
* ✅ Compliance with Amazon listing policies
* ✅ Output must be **valid JSON only** (no extra text)

### 🧠 Prompt Structure (Simplified)

```text
You are an Amazon SEO expert.

RULES:
- Do not copy original content
- Do not invent claims
- Avoid generic language
- Return ONLY valid JSON

INPUT:
Title: <original title>
Bullets: <original bullets>
Description: <original description>

OUTPUT:
{
  title: "optimized title",
  bullets: ["..."] ,
  description: "...",
  keywords: ["..."]
}
```

This strict structure ensures **deterministic, clean, and production-safe** outputs.

---

## 🏗️ Project Structure

```
SalesDuo/
│
├── index.js              # Backend (Express + Gemini + Sequelize)
├── package.json          # Backend dependencies
│
├── client/               # Frontend (Vite + React)
│   ├── src/
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── README.md
```

---

## 🛠️ Tech Stack

### Frontend

* ⚛️ React
* ⚡ Vite
* 🎨 Tailwind CSS
* 🌍 Vercel (Deployment)

### Backend

* 🟢 Node.js + Express
* 🤖 Google Gemini 2.5 Pro
* 🐬 MySQL + Sequelize ORM
* 🌐 Designed for cloud deployment (Render-ready)

> **Note:** MySQL is currently used in local development. Thanks to Sequelize ORM, switching to a managed cloud MySQL (Railway, PlanetScale, AWS RDS) requires **no code changes**—only `.env` updates.

---

## ⚙️ Environment Variables

### Backend (`.env`)

```env
PORT=5000
GEMINI_API_KEY=your_gemini_api_key

DB_NAME=salesduo
DB_USER=root
DB_PASS=your_mysql_password
DB_HOST=localhost
DB_DIALECT=mysql
```

### Frontend (Vercel Environment)

```env
VITE_API_URL=https://your-backend-url.com
```

---

## 🚀 Local Setup

### 1️⃣ Clone Repository

```bash
git clone https://github.com/Harshjoshiit/SalesDuo.git
cd SalesDuo
```

### 2️⃣ Backend Setup

```bash
npm install
node index.js
```

* Starts Express server on `http://localhost:5000`
* Connects to MySQL using Sequelize
* Automatically creates `optimization_history` table

### 3️⃣ Frontend Setup

```bash
cd client
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

---

## 📸 Screenshots

<img width="1895" height="849" alt="image" src="https://github.com/user-attachments/assets/94b51cd4-093d-4b9d-89b7-4e297dfd7c92" />

<img width="1918" height="842" alt="image" src="https://github.com/user-attachments/assets/15d72935-043b-40dc-904f-666697c704dd" />

<img width="1918" height="808" alt="image" src="https://github.com/user-attachments/assets/cd52fe82-8b73-421d-ae94-aeab27ad21eb" />


```md
![Optimizer](./screenshots/optimizer.png)
![AI Output](./screenshots/ai-output.png)
![History](./screenshots/history.png)
```

---

## ✅ Why This Project Stands Out

* Real scraping + AI (not mock data)
* Strict prompt discipline for clean LLM outputs
* ORM-based persistence (industry-standard)
* Clear scalability path (local → cloud)
* Demonstrates real debugging, deployment, and system design skills

---

## 📌 Future Enhancements

* User authentication and per-user history
* Category-specific AI prompts
* Brand-tone customization
* Multilingual Amazon listing support
* Analytics dashboard

---

## 👤 Author

**Harsh Joshi**
GitHub: [https://github.com/Harshjoshiit](https://github.com/Harshjoshiit)

---


