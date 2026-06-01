import express from "express";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 7860;

const BASE = "https://sharktide-lightning.hf.space/v1";

app.use(express.json({ limit: "1mb" }));

app.get("/api/check", async (_, res) => {
  const env = {};
  const interesting = ["IPAI_SK", "SPACE_ID", "SPACE_TITLE"];
  for (const key of interesting) {
    if (process.env[key]) env[key] = process.env[key].length > 10 ? process.env[key].slice(0, 8) + "..." : "(set)";
    else env[key] = "(not set)";
  }
  res.json({ ok: true, env });
});

app.post("/api/hf", async (req, res) => {
  try {
    const key = process.env.IPAI_SK;
    if (!key) {
      return res.status(500).json({ error: "IPAI_SK not configured" });
    }

    const openai = new OpenAI({ apiKey: key, baseURL: BASE });
    const model = req.body.model || "llama3-70b-8192";
    const messages = req.body.messages || [];
    const maxTokens = req.body.max_tokens || 1000;

    const out = await openai.chat.completions.create({ model, messages, max_tokens: maxTokens });
    res.json(out);
  } catch (err) {
    console.error("API error:", err);
    const msg = err.message || String(err);
    const status = err.status || 500;
    res.status(status).json({ error: msg });
  }
});

app.post("/api/images", async (req, res) => {
  try {
    const { itemName } = req.body;
    if (!itemName) return res.status(400).json({ error: "Missing itemName" });

    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const headers = {
      "User-Agent": ua,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://www.google.com/",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
      "Upgrade-Insecure-Requests": "1",
    };

    const url = `https://www.google.com/search?q=${encodeURIComponent(itemName)}&tbm=isch`;
    const response = await fetch(url, { headers });
    const html = await response.text();

    if (/captcha|sorry|unusual traffic/i.test(html) && html.length < 5000) {
      return res.json({ images: [] });
    }

    const seen = new Set();
    const add = (u) => { if (u && !seen.has(u)) { seen.add(u); } };

    for (const m of html.matchAll(/"https:\/\/encrypted-tbn0\.gstatic\.com\/images[^"]+"/g)) {
      add(m[0].replace(/^"|"$/g, "").replace(/\\u003d/g, "=").replace(/\\u0026/g, "&"));
    }
    for (const m of html.matchAll(/"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^"]*)?)"/gi)) {
      add(m[1].replace(/\\u003d/g, "=").replace(/\\u0026/g, "&"));
    }
    for (const m of html.matchAll(/imgurl\\x3d([^\\&"]+)/g)) {
      try { add(decodeURIComponent(m[1])); } catch {}
    }
    for (const m of html.matchAll(/data-src="(https?:\/\/[^"]+)"/g)) {
      add(m[1]);
    }

    const images = Array.from(seen).slice(0, 4);
    res.json({ images });
  } catch (err) {
    res.json({ images: [], error: err.message });
  }
});

app.get("/api/test-lib", async (_, res) => {
  const results = {};
  const key = process.env.IPAI_SK;

  try {
    const openai = new OpenAI({ apiKey: key, baseURL: BASE });
    const out = await openai.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [{ role: "user", content: "Say hello in one word." }],
      max_tokens: 10,
    });
    results["chat"] = { status: 200, content: out.choices?.[0]?.message?.content };
  } catch (e) {
    results["chat"] = { error: e.message };
  }

  res.json(results);
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled:", err);
  res.status(500).json({ error: err.message || "Internal error" });
});

const distPath = join(__dirname, "dist");
app.use(express.static(distPath));
app.get("*", (_, res) => res.sendFile(join(distPath, "index.html")));

app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
