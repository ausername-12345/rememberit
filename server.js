import express from "express";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { HfInference } from "@huggingface/inference";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 7860;

app.use(express.json({ limit: "1mb" }));

app.get("/api/check", async (_, res) => {
  const env = {};
  const interesting = ["HF_TOKEN", "HF_API_TOKEN", "HF_INFERENCE_ENDPOINT", "SPACE_ID", "SPACE_TITLE", "HUGGINGFACEHUB_API_TOKEN", "API_TOKEN"];
  for (const key of interesting) {
    if (process.env[key]) env[key] = process.env[key].length > 10 ? process.env[key].slice(0, 8) + "..." : "(set)";
    else env[key] = "(not set)";
  }
  res.json({ ok: true, env });
});

app.post("/api/hf", async (req, res) => {
  try {
    const token = process.env.HF_TOKEN;
    if (!token) {
      return res.status(500).json({ error: "HF_TOKEN not configured" });
    }

    const hf = new HfInference(token);
    const model = req.body.model || "HuggingFaceH4/zephyr-7b-beta";
    const messages = req.body.messages || [];

    const maxTokens = req.body.max_tokens || 1000;

    const out = await hf.chatCompletion({
      model,
      messages,
      max_tokens: maxTokens,
    });

    res.json(out);
  } catch (err) {
    console.error("HF API error:", err);
    const msg = err.message || String(err);
    const cause = err.cause ? String(err.cause) : "";
    const body = err.response_body ? String(err.response_body).slice(0, 500) : "";
    res.status(500).json({ error: msg + (cause ? " — " + cause : "") + (body ? " | body: " + body : "") });
  }
});

app.get("/api/test-lib", async (_, res) => {
  const results = {};
  const token = process.env.HF_TOKEN;

  try {
    // Direct test: call router.huggingface.co directly
    const routes = [
      "https://router.huggingface.co/auto/v1/chat/completions",
      "https://router.huggingface.co/hf-inference/v1/chat/completions",
      "https://router.huggingface.co/replicate/v1/chat/completions",
    ];
    for (const url of routes) {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            model: "HuggingFaceH4/zephyr-7b-beta",
            messages: [{ role: "user", content: "Say hi" }],
            max_tokens: 10,
          }),
        });
        results[url] = { status: r.status, body: (await r.text()).slice(0, 300) };
      } catch (e) {
        results[url] = { error: e.message };
      }
    }
  } catch (err) {
    results._error = err.message;
  }

  // Also test the HF lib
  try {
    const hf = new HfInference(token);
    const result = await hf.chatCompletion({
      model: "HuggingFaceH4/zephyr-7b-beta",
      messages: [{ role: "user", content: "Say OK in one word" }],
      max_tokens: 10,
    });
    results.lib = { ok: true, result };
  } catch (err) {
    results.lib = {
      ok: false,
      error: err.message,
      status: err.httpResponse?.status,
      body: typeof err.httpResponse?.body === "object" ? JSON.stringify(err.httpResponse.body).slice(0, 500) : String(err.httpResponse?.body).slice(0, 500),
    };
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
