import express from "express";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { HfInference } from "@huggingface/inference";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 7860;

app.use(express.json({ limit: "1mb" }));

import { resolve4, resolveCname, resolveAny } from "dns/promises";

app.get("/api/check", async (_, res) => {
  const dns = {};
  for (const host of ["api-inference.huggingface.co", "huggingface.co"]) {
    try { dns[host] = { a: await resolve4(host) }; } catch (e) { dns[host] = { a_error: e.code }; }
    try { dns[host].cname = await resolveCname(host); } catch (e) { dns[host].cname_error = e.code; }
    try { dns[host].any = await resolveAny(host); } catch (e) { dns[host].any_error = e.code; }
  }
  res.json({ ok: true, token: !!process.env.HF_TOKEN, dns });
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
    const lastUserMsg = messages.filter((m) => m.role === "user").at(-1);
    const userQuery = lastUserMsg?.content || "";

    const maxTokens = req.body.max_tokens || 1000;

    const out = await hf.chatCompletion({
      model,
      messages,
      max_tokens: maxTokens,
    });

    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
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
