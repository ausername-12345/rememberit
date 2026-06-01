import { useState, useRef } from "react";
import {
  Search, ShoppingCart, Store, Image as ImageIcon, Clock,
  ChevronRight, Sun, Moon, Tag, HelpCircle, Loader2,
  Sparkles, RotateCcw,
} from "lucide-react";

// ─── Theme ────────────────────────────────────────────────────────────────────
const LIGHT = {
  bg: "#FAF6F0", surface: "#FFFFFF", surfaceHover: "#F7F3ED",
  resultBg: "#FEF3EE", resultBorder: "rgba(224,120,86,0.22)",
  resultShadow: "0 6px 28px rgba(224,120,86,0.12)",
  inputBg: "#F5F0E8",
  coral: "#E07856", coralLight: "#FAEAE3", coralDark: "#C45E3A",
  coralGlow: "0 3px 12px rgba(224,120,86,0.34)", coralFocus: "rgba(224,120,86,0.13)",
  teal: "#5A9B8E", tealLight: "#EAF4F2", tealDark: "#3D7A6E",
  tealBorder: "rgba(90,155,142,0.28)",
  text: "#2D2A26", textMuted: "#7A7570", textFaint: "#B0AAA3",
  border: "rgba(45,42,38,0.09)", borderMed: "rgba(45,42,38,0.16)",
  shadow: "0 2px 10px rgba(45,42,38,0.07)", shadowMd: "0 5px 20px rgba(45,42,38,0.09)",
  chipBg: "#EEE8DE", chipText: "#5A5248", chipBorder: "rgba(45,42,38,0.10)",
  historyHover: "#F7F3ED", toggleBg: "#EEE8DE",
  storeEtsy: { bg: "#2D2A26", text: "#FAF6F0" },
};
const DARK = {
  bg: "#17140E", surface: "#211E17", surfaceHover: "#2A261E",
  resultBg: "#2B1E17", resultBorder: "rgba(224,120,86,0.24)",
  resultShadow: "0 6px 28px rgba(0,0,0,0.36)",
  inputBg: "#1C1913",
  coral: "#E8845E", coralLight: "rgba(232,132,94,0.16)", coralDark: "#F09878",
  coralGlow: "0 3px 14px rgba(232,132,94,0.38)", coralFocus: "rgba(232,132,94,0.15)",
  teal: "#6AADA0", tealLight: "rgba(106,173,160,0.16)", tealDark: "#8ECFC4",
  tealBorder: "rgba(106,173,160,0.28)",
  text: "#F0EBE3", textMuted: "#9A9590", textFaint: "#524E48",
  border: "rgba(240,235,227,0.08)", borderMed: "rgba(240,235,227,0.15)",
  shadow: "0 2px 10px rgba(0,0,0,0.30)", shadowMd: "0 5px 20px rgba(0,0,0,0.38)",
  chipBg: "#2A2620", chipText: "#9A9288", chipBorder: "rgba(240,235,227,0.10)",
  historyHover: "#2A2620", toggleBg: "#2A2620",
  storeEtsy: { bg: "#EEE8DE", text: "#2D2A26" },
};

// ─── Logo ─────────────────────────────────────────────────────────────────────
const LogoMark = ({ size = 60, coral, teal }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M 57,59 A 24,24 0 1 1 63,51"
      stroke={coral} strokeWidth="8.5" strokeLinecap="round" fill="none" />
    <line x1="60" y1="55" x2="76" y2="71"
      stroke={coral} strokeWidth="8.5" strokeLinecap="round" />
    <path d="M 33,34 C 33,25 49,25 49,35 C 49,43 41,43 41,48"
      stroke={coral} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <circle cx="41" cy="55" r="4" fill={teal} />
  </svg>
);

// ─── Constants ────────────────────────────────────────────────────────────────
const EXAMPLES = [
  "the rubber thing that opens jars",
  "clips that hold a duvet in place",
  "the tool for removing avocado pits",
  "the plastic tip at the end of a shoelace",
  "tiny brush for cleaning between teeth",
];

const SYSTEM_PROMPT = `You are an expert at identifying everyday items from vague or colloquial descriptions.

You MUST respond with ONLY a valid raw JSON object — no markdown, no backtick fences, no preamble, no trailing text whatsoever. Exactly this shape:
{"itemName":"...","confidence":"...","description":"...","alternatives":[],"images":[],"searchLinks":[{"label":"...","url":"..."}]}

Rules:
-   itemName: the precise, specific name of the item — not a paraphrase of the user's description. Use the most correct technical or widely-recognized term.
- confidence: a short honest phrase, e.g. "High confidence", "Fairly confident", "Moderate — a few possibilities", "Low confidence — hard to say without more context"
- description: 2–3 sentences covering what it is, what it looks like, and what it is used for
- alternatives: 0–1 entries if highly confident; 2–3 entries if uncertain; must be genuinely distinct items not synonyms
- images: always an empty array
- searchLinks: always exactly these three, with the itemName URL-encoded:
  {"label":"Amazon","url":"https://www.amazon.com/s?k=ENCODED"},
  {"label":"Google Shopping","url":"https://www.google.com/search?q=ENCODED&tbm=shop"},
  {"label":"Etsy","url":"https://www.etsy.com/search?q=ENCODED"}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getConfLevel = (c = "") => {
  if (/high|very confident|certainly|definitely|^sure/i.test(c)) return "high";
  if (/low|uncertain|unclear|not sure|not entirely|might|possibly|several|could be|hard to say/i.test(c)) return "low";
  return "medium";
};

const confStyle = (lvl, T) => {
  if (lvl === "high")   return { color: "#2E7D5E", bg: "rgba(46,125,94,0.13)" };
  if (lvl === "low")    return { color: T.coralDark, bg: T.coralLight };
  return                       { color: T.tealDark,  bg: T.tealLight };
};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function RememberIt() {
  const sys = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const [mode, setMode]     = useState(sys ? "dark" : "light");
  const T = mode === "dark" ? DARK : LIGHT;

  const [query, setQuery]   = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);
  const [history, setHistory] = useState([]);
  const [animKey, setAnimKey] = useState(0);
  const [imgErrors, setImgErrors] = useState([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const inputRef = useRef(null);

  const fetchImages = async (itemName) => {
    try {
      const res = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemName }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.images || [];
    } catch { return []; }
  };

  const identify = async (q) => {
    const raw = q.trim(); if (!raw) return;
    setLoading(true); setError(null); setResult(null); setImgErrors([]);
    try {
      const res = await fetch("/api/hf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama3-70b-8192",
          max_tokens: 1000,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `Identify this item: "${raw}"\nReturn ONLY the JSON object.` },
          ],
        }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      const txt = (data.choices?.[0]?.message?.content || "").trim();
      const clean = txt.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      const parsed = JSON.parse(clean);
      setResult(parsed);
      setAnimKey(k => k + 1);
      setHistory(prev => {
        const deduped = prev.filter(h => h.result.itemName.toLowerCase() !== parsed.itemName.toLowerCase());
        return [{ id: Date.now(), query: raw, result: parsed }, ...deduped].slice(0, 5);
      });
      if (getConfLevel(parsed.confidence) === "high" && !parsed.images?.length) {
        setImagesLoading(true);
        const urls = await fetchImages(parsed.itemName);
        if (urls.length) setResult(prev => ({ ...prev, images: urls }));
        setImagesLoading(false);
      }
    } catch (e) {
      setError(e.message?.includes("JSON")
        ? "Got an unexpected response — try rephrasing your description."
        : "Something went wrong. Check your connection and try again.");
    } finally { setLoading(false); }
  };

  const handleKey     = e  => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); identify(query); } };
  const handleExample = ex => { setQuery(ex); identify(ex); };
  const handleAlt     = a  => { setQuery(a);  identify(a);  };
  const handleHistory = h  => { setQuery(h.query); setResult(h.result); setAnimKey(k => k + 1); setError(null); };
  const reset         = () => { setResult(null); setQuery(""); setError(null); setTimeout(() => inputRef.current?.focus(), 50); };

  const confLvl = result ? getConfLevel(result.confidence) : "medium";
  const cs      = result ? confStyle(confLvl, T) : {};
  const imgUrl  = result ? `https://www.google.com/search?q=${encodeURIComponent(result.itemName)}&tbm=isch` : "#";

  const card  = { background: T.surface, borderRadius: 15, border: `1px solid ${T.border}`, boxShadow: T.shadow, padding: "1.2rem 1.4rem" };
  const lbl   = { fontSize: 10.5, fontWeight: 700, color: T.textFaint, textTransform: "uppercase", letterSpacing: "0.09em", margin: "0 0 10px", display: "flex", alignItems: "center", gap: 5 };

  const storeConfig = (lbl) => {
    const map = {
      Amazon:           { bg: T.coral,              text: "#fff",        Icon: ShoppingCart },
      "Google Shopping":{ bg: T.teal,               text: "#fff",        Icon: Tag },
      Etsy:             { bg: T.storeEtsy.bg,        text: T.storeEtsy.text, Icon: Store },
    };
    return map[lbl] || { bg: T.text, text: T.bg, Icon: ShoppingCart };
  };

  return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", color: T.text, transition: "background 0.25s,color 0.2s" }}>
      <style>{`
        html, body { margin:0; padding:0; background:${T.bg}; }
        @keyframes fadeRise { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin      { to { transform:rotate(360deg); } }
        .ri-result { animation: fadeRise 0.45s cubic-bezier(0.22,1,0.36,1) both; }
        .ri-histrow:hover { background: ${T.historyHover} !important; }
        .ri-chip:hover    { opacity: 0.82; }
        .ri-btn:hover:not(:disabled) { opacity: 0.86; }
        a.ri-link:hover   { opacity: 0.84; }
        textarea { color-scheme: ${mode}; }
        textarea::placeholder { color: ${T.textFaint}; }
        * { box-sizing: border-box; }
      `}</style>

      <div style={{ maxWidth: 620, margin: "0 auto", padding: "2rem 1rem 2.5rem" }}>

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:"1.75rem" }}>
          <div style={{ flex:1, textAlign:"center" }}>
            <LogoMark size={66} coral={T.coral} teal={T.teal} />
            <h1 style={{ fontSize:30, fontWeight:800, margin:"6px 0 5px", letterSpacing:"-0.03em", lineHeight:1 }}>
              <span style={{ color:T.coral }}>Remember</span>
              <span style={{ color:T.teal }}> It</span>
            </h1>
            <p style={{ fontSize:13.5, color:T.textMuted, margin:0 }}>
              That thing you can't name? Describe it — we'll find it.
            </p>
          </div>
          <button className="ri-btn" onClick={() => setMode(m => m==="light"?"dark":"light")}
            style={{ background:T.toggleBg, border:`1px solid ${T.border}`, borderRadius:11, width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, marginTop:6, boxShadow:T.shadow, transition:"background 0.2s" }}>
            {mode==="light" ? <Moon size={15} color={T.textMuted}/> : <Sun size={15} color={T.textMuted}/>}
          </button>
        </div>

        {/* ── INPUT ──────────────────────────────────────────────────────── */}
        <div style={{ ...card, marginBottom:"0.85rem" }}>
          <textarea ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={handleKey}
            placeholder="Describe the item you're trying to find…" rows={3} disabled={loading}
            style={{ width:"100%", resize:"none", border:`1.5px solid ${query.trim()?T.coral:T.border}`, borderRadius:11, padding:"11px 13px", fontSize:15, fontFamily:"inherit", background:T.inputBg, color:T.text, outline:"none", lineHeight:1.65, transition:"border-color 0.15s,box-shadow 0.15s", boxShadow:query.trim()?`0 0 0 3px ${T.coralFocus}`:"none" }}/>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:10 }}>
            <span style={{ fontSize:12, color:T.textFaint }}>Enter to submit</span>
            <button className="ri-btn" onClick={()=>identify(query)} disabled={loading||!query.trim()}
              style={{ background:loading||!query.trim()?T.chipBg:T.coral, color:loading||!query.trim()?T.textFaint:"#fff", border:"none", borderRadius:10, padding:"8px 19px", fontSize:13.5, fontWeight:600, cursor:loading||!query.trim()?"not-allowed":"pointer", display:"flex", alignItems:"center", gap:7, boxShadow:!loading&&query.trim()?T.coralGlow:"none", transition:"all 0.15s", fontFamily:"inherit" }}>
              {loading
                ? <><Loader2 size={14} style={{animation:"spin 0.85s linear infinite"}}/> Identifying…</>
                : <><Search size={14}/> Identify</>}
            </button>
          </div>
        </div>

        {/* ── EXAMPLES ───────────────────────────────────────────────────── */}
        {!result && !loading && (
          <div style={{ marginBottom:"1.5rem" }}>
            <p style={lbl}>Try an example</p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
              {EXAMPLES.map(ex => (
                <button key={ex} className="ri-chip" onClick={()=>handleExample(ex)}
                  style={{ background:T.chipBg, color:T.chipText, border:`1px solid ${T.chipBorder}`, borderRadius:20, padding:"6px 14px", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit", transition:"opacity 0.12s" }}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── HISTORY ────────────────────────────────────────────────────── */}
        {history.length > 0 && !loading && !result && (
          <div style={{ ...card, marginBottom:"1.25rem" }}>
            <p style={lbl}><Clock size={11}/> Recently identified</p>
            <div style={{ display:"flex", flexDirection:"column", margin:"0 -6px" }}>
              {history.map(h => (
                <button key={h.id} className="ri-histrow" onClick={()=>handleHistory(h)}
                  style={{ background:"none", border:"none", borderRadius:9, padding:"8px 10px", cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"space-between", transition:"background 0.12s", textAlign:"left", color:T.text, width:"100%" }}>
                  <span>
                    <span style={{ fontWeight:600, fontSize:14 }}>{h.result.itemName}</span>
                    <span style={{ fontSize:12.5, color:T.textMuted, marginLeft:8 }}>"{h.query}"</span>
                  </span>
                  <ChevronRight size={14} color={T.textFaint} style={{ flexShrink:0 }}/>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── ERROR ──────────────────────────────────────────────────────── */}
        {error && !loading && (
          <div style={{ background:T.coralLight, border:`1px solid ${T.resultBorder}`, borderRadius:12, padding:"12px 15px", color:T.coralDark, fontSize:13.5, display:"flex", alignItems:"flex-start", gap:9, marginBottom:"1rem" }}>
            <HelpCircle size={15} style={{ flexShrink:0, marginTop:1 }}/>
            {error}
          </div>
        )}

        {/* ── RESULTS ────────────────────────────────────────────────────── */}
        {result && (
          <div key={animKey} className="ri-result" style={{ display:"flex", flexDirection:"column", gap:10 }}>

            {/* Main result card */}
            <div style={{ background:T.resultBg, borderRadius:16, border:`1px solid ${T.resultBorder}`, boxShadow:T.resultShadow, padding:"1.5rem" }}>
              {confLvl === "low" && (
                <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:12, padding:"8px 12px", background:T.coralLight, borderRadius:9 }}>
                  <HelpCircle size={14} color={T.coralDark}/>
                  <span style={{ fontSize:13, color:T.coralDark, fontWeight:500 }}>Not totally sure, but this might be…</span>
                </div>
              )}
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, flexWrap:"wrap", marginBottom:9 }}>
                <h2 style={{ fontSize:27, fontWeight:800, margin:0, color:T.coral, letterSpacing:"-0.025em", lineHeight:1.1 }}>
                  {result.itemName}
                </h2>
                {!imagesLoading && (!result.images?.length || result.images.every((_, i) => imgErrors[i])) && (
                  <a href={imgUrl} target="_blank" rel="noopener noreferrer" className="ri-link"
                    style={{ fontSize:12, fontWeight:600, color:T.tealDark, textDecoration:"none", background:T.tealLight, borderRadius:20, padding:"5px 12px", border:`1px solid ${T.tealBorder}`, whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:5, transition:"opacity 0.12s" }}>
                    <ImageIcon size={12}/> See images
                  </a>
                )}
              </div>
              {(() => {
                const imgs = result.images || [];
                if (imagesLoading) return (
                  <div style={{ display:"flex", gap:8, marginBottom:14, height:90, alignItems:"center", justifyContent:"center", background:T.surface, borderRadius:11, border:`1px solid ${T.border}` }}>
                    <Loader2 size={18} style={{animation:"spin 0.85s linear infinite", color:T.textFaint}}/>
                  </div>
                );
                if (!imgs.length) return null;
                const anyVisible = imgs.some((_, i) => !imgErrors[i]);
                if (!anyVisible) return null;
                return (
                  <div style={{ display:"flex", gap:8, marginBottom:14, overflowX:"auto", paddingBottom:2 }}>
                    {imgs.map((src, i) => imgErrors[i] ? null : (
                      <a key={i} href={src} target="_blank" rel="noopener noreferrer" style={{ flexShrink:0, display:"block" }}>
                        <img src={src} alt={result.itemName}
                          onError={() => setImgErrors(prev => { const n=[...prev]; n[i]=true; return n; })}
                          style={{ width:90, height:90, objectFit:"cover", borderRadius:11, border:`1px solid ${T.border}`, display:"block", cursor:"pointer", transition:"opacity 0.12s" }}
                        />
                      </a>
                    ))}
                  </div>
                );
              })()}
              <div style={{ display:"inline-flex", alignItems:"center", gap:5, background:cs.bg, color:cs.color, borderRadius:8, padding:"4px 11px", fontSize:12, fontWeight:600, marginBottom:14 }}>
                {confLvl === "high" && <Sparkles size={11}/>}
                {result.confidence}
              </div>
              <p style={{ fontSize:15, color:T.text, margin:0, lineHeight:1.8 }}>
                {result.description}
              </p>
            </div>

            {/* Shopping links */}
            {result.searchLinks?.length > 0 && (
              <div style={card}>
                <p style={lbl}><ShoppingCart size={11}/> Where to buy</p>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {result.searchLinks.map(({ label, url }) => {
                    const { bg, text, Icon } = storeConfig(label);
                    return (
                      <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="ri-link"
                        style={{ background:bg, color:text, textDecoration:"none", borderRadius:11, padding:"9px 17px", fontSize:13.5, fontWeight:600, display:"inline-flex", alignItems:"center", gap:7, boxShadow:T.shadow, transition:"opacity 0.12s" }}>
                        <Icon size={14}/> {label}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Alternatives */}
            {result.alternatives?.length > 0 && (
              <div style={card}>
                <p style={lbl}><HelpCircle size={11}/> Could also be…</p>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {result.alternatives.map(alt => (
                    <button key={alt} className="ri-chip" onClick={()=>handleAlt(alt)}
                      style={{ background:T.tealLight, color:T.tealDark, border:`1px solid ${T.tealBorder}`, borderRadius:20, padding:"7px 15px", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:5, transition:"opacity 0.12s" }}>
                      {alt} <ChevronRight size={12}/>
                    </button>
                  ))}
                </div>
                <p style={{ fontSize:12, color:T.textFaint, margin:"9px 0 0" }}>Tap an alternative to search for it instead</p>
              </div>
            )}

            {/* History strip inside results */}
            {history.length > 1 && (
              <div style={{ ...card, padding:"0.9rem 1.2rem" }}>
                <p style={{ ...lbl, marginBottom:8 }}><Clock size={11}/> Other recent lookups</p>
                <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                  {history.filter(h => h.result.itemName !== result.itemName).map(h => (
                    <button key={h.id} className="ri-chip" onClick={()=>handleHistory(h)}
                      style={{ background:T.chipBg, color:T.chipText, border:`1px solid ${T.chipBorder}`, borderRadius:20, padding:"5px 13px", fontSize:12.5, fontWeight:500, cursor:"pointer", fontFamily:"inherit", transition:"opacity 0.12s" }}>
                      {h.result.itemName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Reset */}
            <button className="ri-btn" onClick={reset}
              style={{ background:"none", border:`1px solid ${T.borderMed}`, borderRadius:11, padding:"10px", color:T.textMuted, fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:7, transition:"opacity 0.12s" }}>
              <RotateCcw size={13}/> Describe another item
            </button>
          </div>
        )}

        {/* ── FOOTER ─────────────────────────────────────────────────────── */}
        <footer style={{ marginTop:"2.75rem", paddingTop:"1.25rem", borderTop:`1px solid ${T.border}`, display:"flex", flexDirection:"column", gap:6 }}>
          <p style={{ fontSize:12.5, color:T.textMuted, margin:0, textAlign:"center" }}>
            <strong style={{ color:T.text }}>How it works:</strong>{" "}
            Describe anything in plain language and we search the web in real time to identify it and find where to buy it.
          </p>
          <p style={{ fontSize:11.5, color:T.textFaint, margin:0, textAlign:"center" }}>
            We may earn a commission from purchases made through links on this site.
          </p>
        </footer>

      </div>
    </div>
  );
}