import express from "express";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 7860;

app.use(express.json({ limit: "1mb" }));

async function searchDuckDuckGo(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
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
}

app.post("/api/hf", async (req, res) => {
  const token = process.env.HF_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "HF_TOKEN not configured" });
  }
  try {
    const messages = req.body.messages || [];
    const lastUserMsg = messages.filter((m) => m.role === "user").at(-1);
    const userQuery = lastUserMsg?.content || "";
    const searchResults = await searchDuckDuckGo(userQuery);
    const searchContext =
      searchResults.length > 0
        ? "\n\nWeb search results:\n" +
          searchResults
            .map(
              (r, i) =>
                `${i + 1}. "${r.title}"\n   ${r.snippet}\n   URL: ${r.link}`,
            )
            .join("\n\n")
        : "";

    const body = {
      ...req.body,
      messages: [
        ...(messages[0]?.role === "system"
          ? [
              {
                ...messages[0],
                content: messages[0].content + searchContext,
              },
            ]
          : [{ role: "system", content: searchContext }]),
        ...messages.filter((m) => m.role !== "system"),
      ],
    };

    const response = await fetch(
      "https://api-inference.huggingface.co/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      },
    );
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const distPath = join(__dirname, "dist");
app.use(express.static(distPath));
app.get("*", (_, res) => res.sendFile(join(distPath, "index.html")));

app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
