import express from "express";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 7860;

app.use(express.json({ limit: "1mb" }));

async function fetchWithTimeout(url, opts, ms = 10000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

async function searchDuckDuckGo(query) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetchWithTimeout(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    const results = [];
    $(".result").each((_, el) => {
      const title = $(el).find(".result__title a").text().trim();
      const snippet = $(el).find(".result__snippet").text().trim();
      const link = $(el).find(".result__url").text().trim() || $(el).find(".result__title a").attr("href") || "";
      if (title) results.push({ title, snippet, link });
    });
    return results.slice(0, 6);
  } catch (e) {
    console.error("Search failed:", e.message);
    return [];
  }
}

app.post("/api/hf", async (req, res) => {
  try {
    const token = process.env.HF_TOKEN;
    if (!token) {
      return res.status(500).json({ error: "HF_TOKEN not configured" });
    }

    const model = req.body.model || "HuggingFaceH4/zephyr-7b-beta";
    const messages = req.body.messages || [];
    const lastUserMsg = messages.filter((m) => m.role === "user").at(-1);
    const userQuery = lastUserMsg?.content || "";

    const searchResults = await searchDuckDuckGo(userQuery);
    const searchContext =
      searchResults.length > 0
        ? "\n\nWeb search results:\n" +
          searchResults.map((r, i) => `${i + 1}. "${r.title}"\n   ${r.snippet}\n   URL: ${r.link}`).join("\n\n")
        : "";

    const body = {
      model,
      max_tokens: req.body.max_tokens || 1000,
      messages: [
        ...(messages[0]?.role === "system"
          ? [{ ...messages[0], content: messages[0].content + searchContext }]
          : [{ role: "system", content: searchContext }]),
        ...messages.filter((m) => m.role !== "system"),
      ],
    };

    const hfRes = await fetchWithTimeout(
      `https://api-inference.huggingface.co/models/${model}/v1/chat/completions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      },
      30000,
    );

    let data;
    try {
      data = await hfRes.json();
    } catch {
      const text = await hfRes.text();
      return res.status(502).json({ error: `HF returned non-JSON (${hfRes.status}): ${text.slice(0, 500)}` });
    }

    if (!hfRes.ok) {
      return res.status(hfRes.status).json({ error: data.error?.message || data.error || JSON.stringify(data).slice(0, 300) });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.get("/api/check", (_, res) => {
  res.json({ ok: true, token: !!process.env.HF_TOKEN });
});

import { resolve4 } from "dns/promises";

app.get("/api/test-network", async (_, res) => {
  const results = {};
  for (const host of ["api-inference.huggingface.co", "huggingface.co", "router.huggingface.co"]) {
    try {
      const addrs = await resolve4(host);
      results[host] = { ips: addrs };
    } catch (e) {
      results[host] = { dns_error: e.code || e.message };
    }
  }
  const token = process.env.HF_TOKEN;
  for (const url of [
    "https://google.com",
    "https://huggingface.co",
    "https://huggingface.co/api/inference",
    "https://huggingface.co/models/HuggingFaceH4/zephyr-7b-beta",
    "https://router.huggingface.co",
    "https://api-inference.huggingface.co",
  ]) {
    try {
      const headers = { "User-Agent": "node" };
      if (token && (url.includes("huggingface.co/api/") || url.includes("api-inference"))) {
        headers.Authorization = `Bearer ${token}`;
      }
      const r = await fetchWithTimeout(url, { redirect: "manual", headers }, 5000);
      results[url] = { status: r.status, ok: r.ok };
    } catch (e) {
      results[url] = { error: e.message || String(e), code: e.cause?.code || e.code };
    }
  }
  res.json(results);
});

app.post("/api/test-hf", async (req, res) => {
  try {
    const token = process.env.HF_TOKEN;
    const model = req.body.model || "HuggingFaceH4/zephyr-7b-beta";
    const body = {
      model,
      max_tokens: 100,
      messages: [
        { role: "user", content: "Say hello in one word" },
      ],
    };
    const hfRes = await fetchWithTimeout(
      `https://api-inference.huggingface.co/models/${model}/v1/chat/completions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      },
      30000,
    );
    const text = await hfRes.text();
    res.status(hfRes.status).json({ status: hfRes.status, body: text.slice(0, 1000) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled:", err);
  res.status(500).json({ error: err.message || "Internal error" });
});

const distPath = join(__dirname, "dist");
app.use(express.static(distPath));
app.get("*", (_, res) => res.sendFile(join(distPath, "index.html")));

app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
