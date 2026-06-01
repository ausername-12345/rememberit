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

  // Check what models are available for conversational task
  try {
    const r = await fetch("https://huggingface.co/api/tasks?task=conversational", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await r.json();
    results["conversational_models"] = {
      count: data.models?.length || 0,
      models: (data.models || []).slice(0, 10).map(m => ({ id: m.id, provider: m.provider })),
    };
  } catch (e) {
    results["conversational_models_error"] = e.message;
  }

  // Also check text-generation task
  try {
    const r = await fetch("https://huggingface.co/api/tasks?task=text-generation", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await r.json();
    results["textgen_models"] = {
      count: data.models?.length || 0,
      models: (data.models || []).slice(0, 10).map(m => ({ id: m.id, provider: m.provider })),
    };
  } catch (e) {
    results["textgen_models_error"] = e.message;
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
