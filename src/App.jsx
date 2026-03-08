import { useState, useEffect, useRef, useReducer } from "react";

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════
const SERVICES = [
  { id: "netflix", name: "Netflix", color: "#E50914", icon: "N", accent: "#FEE2E2" },
  { id: "disney", name: "Disney+", color: "#0063E5", icon: "D+", accent: "#DBEAFE" },
  { id: "hulu", name: "Hulu", color: "#1CE783", icon: "H", accent: "#D1FAE5" },
  { id: "max", name: "Max", color: "#741DFF", icon: "M", accent: "#EDE9FE" },
  { id: "prime", name: "Prime Video", color: "#00A8E1", icon: "P", accent: "#CFFAFE" },
  { id: "apple", name: "Apple TV+", color: "#555555", icon: "A", accent: "#F3F4F6" },
  { id: "paramount", name: "Paramount+", color: "#0064FF", icon: "P+", accent: "#DBEAFE" },
  { id: "peacock", name: "Peacock", color: "#000000", icon: "Pc", accent: "#FEF9C3" },
];

const COMPARE_CATS = [
  { key: "cheapest", label: "Cheapest Plan", icon: "💰" },
  { key: "premium", label: "Premium Plan", icon: "💎" },
  { key: "adSupported", label: "Ad-Free Available?", icon: "📺" },
  { key: "simultaneousStreams", label: "Simultaneous Streams", icon: "👥" },
  { key: "downloadable", label: "Offline Downloads?", icon: "📱" },
  { key: "resolution", label: "Max Resolution", icon: "🖥️" },
  { key: "liveTV", label: "Live TV Included?", icon: "📡" },
  { key: "freeTrialAvailable", label: "Free Trial?", icon: "🎁" },
  { key: "standoutContent", label: "Standout Content", icon: "⭐" },
  { key: "bestFor", label: "Best For", icon: "🎯" },
];

const svc = (name) => SERVICES.find(
  (s) => name && s.name.toLowerCase().replace("+", "").includes(name.toLowerCase().replace("+", "").trim().split(" ")[0])
);

// ═══════════════════════════════════════════
// AI DATA LAYER
// ═══════════════════════════════════════════
async function aiQuery(prompt, retries = 1) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      return data.content?.map((b) => (b.type === "text" ? b.text : "")).filter(Boolean).join("\n") || null;
    } catch (e) {
      if (i === retries) return null;
    }
  }
  return null;
}

function parseJSON(raw) {
  if (!raw) return null;
  try {
    const c = raw.replace(/```json\s*/g, "").replace(/```/g, "").trim();
    const start = Math.min(
      c.indexOf("{") >= 0 ? c.indexOf("{") : Infinity,
      c.indexOf("[") >= 0 ? c.indexOf("[") : Infinity
    );
    const endBrace = c.lastIndexOf("}");
    const endBracket = c.lastIndexOf("]");
    const end = Math.max(endBrace, endBracket);
    if (start === Infinity || end === -1) return null;
    return JSON.parse(c.substring(start, end + 1));
  } catch {
    return null;
  }
}

async function fetchComparison(names) {
  const prompt = `I need current, accurate comparison data for these US streaming services: ${names.join(", ")}.

Return ONLY a JSON object (no markdown, no backticks, no preamble) with this exact structure. Use each service's exact name as the key:
{
  "${names[0]}": {
    "cheapest": "$X.XX/mo",
    "premium": "$X.XX/mo",
    "adSupported": "Yes" or "No",
    "simultaneousStreams": "X",
    "downloadable": "Yes" or "No",
    "resolution": "4K UHD" or "1080p HD" etc,
    "liveTV": "Yes" or "No" or "Add-on",
    "freeTrialAvailable": "Yes" or "No",
    "standoutContent": "2-3 top shows/movies",
    "bestFor": "Short phrase like 'Families with kids'"
  }
}
Include ALL of: ${names.join(", ")}. Current US pricing only.`;
  return parseJSON(await aiQuery(prompt));
}

async function fetchSearch(query) {
  const prompt = `Search for "${query}" (movie, TV show, character, or franchise) and tell me which US streaming services currently have it.

Return ONLY a JSON array (no markdown, no backticks, no preamble):
[
  {
    "title": "Full Title",
    "year": "2023",
    "type": "Movie" or "TV Show",
    "rating": "PG-13",
    "availableOn": [
      { "service": "Netflix", "included": true, "note": "Included with subscription" },
      { "service": "Prime Video", "included": false, "note": "Rent $3.99" }
    ],
    "brief": "One sentence description"
  }
]
Up to 5 results. Include stream, rent, and buy options.`;
  return parseJSON(await aiQuery(prompt));
}

async function fetchLifecycle(serviceName) {
  const prompt = `What are notable titles recently added, coming soon, and leaving soon on ${serviceName} in the US?

Return ONLY a JSON object (no markdown, no backticks, no preamble):
{
  "recentlyAdded": [{ "title": "Name", "date": "Mar 2026", "type": "Movie" or "Series" }],
  "comingSoon": [{ "title": "Name", "date": "Apr 2026", "type": "Movie" or "Series" }],
  "leavingSoon": [{ "title": "Name", "date": "Mar 31", "type": "Movie" or "Series" }]
}
3-5 items per category. Current info only.`;
  return parseJSON(await aiQuery(prompt));
}

async function fetchOptimizer(titles) {
  const titleList = titles.map((t) => `"${t.title}" (${t.availableOn?.map((a) => a.service).join(", ")})`).join("; ");
  const prompt = `I have a streaming watchlist with these titles and their availability: ${titleList}

Create a month-by-month subscription plan that lets me watch ALL these titles while spending as little as possible. I should only subscribe to one or two services at a time each month.

Return ONLY a JSON object (no markdown, no backticks, no preamble):
{
  "plan": [
    {
      "month": "Month 1",
      "service": "Netflix",
      "cost": "$15.49",
      "watch": ["Title 1", "Title 2"]
    }
  ],
  "totalCost": "$XX.XX",
  "vsAllAtOnce": "$XX.XX/mo",
  "savings": "$XX.XX"
}`;
  return parseJSON(await aiQuery(prompt));
}

// ═══════════════════════════════════════════
// WATCHLIST REDUCER
// ═══════════════════════════════════════════
function watchlistReducer(state, action) {
  switch (action.type) {
    case "ADD":
      if (state.some((w) => w.title === action.item.title)) return state;
      return [...state, action.item];
    case "REMOVE":
      return state.filter((w) => w.title !== action.title);
    case "CLEAR":
      return [];
    default:
      return state;
  }
}

// ═══════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════
const Loader = ({ text }) => (
  <div style={{ textAlign: "center", padding: "50px 20px" }}>
    <div className="sc-loader" />
    <p style={{ color: "#888", marginTop: 16, fontSize: 14 }}>{text}</p>
  </div>
);

const ErrorState = ({ text, onRetry }) => (
  <div style={{ textAlign: "center", padding: "50px 20px" }}>
    <div style={{ fontSize: 36, marginBottom: 10 }}>😕</div>
    <p style={{ color: "#999", fontSize: 14, marginBottom: 16 }}>{text || "Something went wrong. Give it another shot?"}</p>
    {onRetry && (
      <button onClick={onRetry} style={{
        padding: "8px 20px", borderRadius: 10, border: "1px solid #e2e2ea",
        background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
        fontFamily: "'DM Sans', sans-serif", color: "#555", transition: "all 0.2s",
      }}>Try Again</button>
    )}
  </div>
);

const EmptyState = ({ icon, text }) => (
  <div style={{ textAlign: "center", padding: "50px 20px", color: "#aaa", fontSize: 14 }}>
    <div style={{ fontSize: 36, marginBottom: 10 }}>{icon}</div>
    <div>{text}</div>
  </div>
);

const ServiceBadge = ({ name, included, note }) => {
  const s = svc(name);
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 100, fontSize: 11, fontWeight: 600,
      display: "inline-flex", alignItems: "center", gap: 4,
      background: included ? "#ecfdf5" : "#fff7ed",
      color: included ? "#065f46" : "#9a3412",
      border: `1px solid ${included ? "#a7f3d0" : "#fed7aa"}`,
    }}>
      {s && <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />}
      {name}{!included && note ? ` · ${note}` : ""}
    </span>
  );
};

const Pill = ({ active, color, accentBg, children, onClick }) => (
  <button onClick={onClick} style={{
    display: "flex", alignItems: "center", gap: 8,
    padding: "9px 16px", borderRadius: 100,
    border: active ? `2px solid ${color}` : "2px solid #e2e2ea",
    background: active ? (accentBg || `${color}12`) : "#fff",
    cursor: "pointer", transition: "all 0.2s",
    fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
    color: active ? color : "#666", whiteSpace: "nowrap",
  }}>{children}</button>
);

const SvcIcon = ({ service, size = 22 }) => (
  <span style={{
    width: size, height: size, borderRadius: size * 0.28,
    background: service.color, color: "#fff",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontSize: size * 0.42, fontWeight: 800, flexShrink: 0, letterSpacing: -0.5,
  }}>{service.icon}</span>
);

// ═══════════════════════════════════════════
// COMPARE TAB
// ═══════════════════════════════════════════
function CompareTab() {
  const [selected, setSelected] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const cacheRef = useRef({});
  const prevKeyRef = useRef("");

  const toggle = (id) => setSelected((p) =>
    p.includes(id) ? p.filter((x) => x !== id) : p.length < 4 ? [...p, id] : p
  );

  const doFetch = (ids) => {
    const names = ids.map((id) => SERVICES.find((s) => s.id === id)?.name).filter(Boolean);
    const key = [...ids].sort().join(",");
    if (cacheRef.current[key]) { setData(cacheRef.current[key]); setError(false); return; }
    setLoading(true); setError(false); setData(null);
    fetchComparison(names).then((d) => {
      if (d) { cacheRef.current[key] = d; setData(d); } else setError(true);
      setLoading(false);
    });
  };

  useEffect(() => {
    const key = [...selected].sort().join(",");
    if (key === prevKeyRef.current) return;
    prevKeyRef.current = key;
    if (selected.length < 2) { setData(null); setError(false); return; }
    doFetch(selected);
  }, [selected]);

  const services = selected.map((id) => SERVICES.find((s) => s.id === id)).filter(Boolean);

  return (
    <div className="sc-fade">
      <p style={{ fontSize: 14, color: "#888", margin: "0 0 12px" }}>
        Pick up to 4 services to compare (prices, features, content highlights):
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        {SERVICES.map((s) => (
          <Pill key={s.id} active={selected.includes(s.id)} color={s.color} accentBg={s.accent} onClick={() => toggle(s.id)}>
            <SvcIcon service={s} /> {s.name}
          </Pill>
        ))}
      </div>
      {selected.length >= 4 && (
        <p style={{ fontSize: 12, color: "#e67e22", margin: "-8px 0 16px" }}>
          Max 4 at a time for a clean comparison. Deselect one to swap.
        </p>
      )}

      {selected.length < 2 && <EmptyState icon="👆" text="Pick at least 2 services above to compare them side-by-side" />}
      {loading && <Loader text="Fetching the latest pricing & features..." />}
      {error && <ErrorState onRetry={() => doFetch(selected)} />}

      {!loading && !error && data && (
        <>
          <div style={{ overflowX: "auto", borderRadius: 16, border: "1px solid #e8e8f0", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: services.length * 170 + 190, fontFamily: "'DM Sans', sans-serif" }}>
              <thead>
                <tr>
                  <th style={{ padding: "14px 16px", textAlign: "left", background: "#fafafe", borderBottom: "2px solid #e8e8f0", fontSize: 11, color: "#999", fontWeight: 700, letterSpacing: 1, position: "sticky", left: 0, zIndex: 2, minWidth: 165 }}>FEATURE</th>
                  {services.map((s) => (
                    <th key={s.id} style={{ padding: "14px 16px", textAlign: "center", background: "#fafafe", borderBottom: "2px solid #e8e8f0", minWidth: 155 }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: s.color }}>
                        <SvcIcon service={s} size={24} /> {s.name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_CATS.map((cat, i) => (
                  <tr key={cat.key} style={{ background: i % 2 === 0 ? "#fff" : "#fafcff" }}>
                    <td style={{ padding: "11px 16px", borderBottom: "1px solid #f0f0f5", fontSize: 12, fontWeight: 600, color: "#555", whiteSpace: "nowrap", position: "sticky", left: 0, zIndex: 1, background: i % 2 === 0 ? "#fff" : "#fafcff" }}>
                      <span style={{ marginRight: 6 }}>{cat.icon}</span>{cat.label}
                    </td>
                    {services.map((s) => {
                      const val = (data[s.name] || {})[cat.key] || "—";
                      const isPrice = cat.key === "cheapest" || cat.key === "premium";
                      return (
                        <td key={s.id} style={{ padding: "11px 16px", borderBottom: "1px solid #f0f0f5", textAlign: "center", fontSize: 12, color: "#555", maxWidth: 190 }}>
                          {isPrice ? <span style={{ fontWeight: 700, color: "#1a1a2e", fontSize: 14 }}>{val}</span>
                            : val === "Yes" ? <span style={{ color: "#059669", fontWeight: 600 }}>✓ Yes</span>
                            : val === "No" ? <span style={{ color: "#dc2626", fontWeight: 500 }}>✗ No</span>
                            : val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 14, padding: "13px 16px", borderRadius: 12, background: "#f0faf9", border: "1px solid #ccfbf1", display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ fontSize: 16, lineHeight: 1.5 }}>💡</span>
            <p style={{ fontSize: 12.5, color: "#555", margin: 0, lineHeight: 1.6 }}>
              <strong>Pro tip:</strong> You don't have to keep all these running at once. Subscribe to one, binge what you want, cancel, move to the next. Most services let you rejoin anytime.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// SEARCH TAB
// ═══════════════════════════════════════════
function SearchTab({ watchlist, dispatchWL }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = async () => {
    if (!query.trim()) return;
    setLoading(true); setError(false); setSearched(true); setResults(null);
    const data = await fetchSearch(query.trim());
    if (data) setResults(data); else setError(true);
    setLoading(false);
  };

  const isInWL = (title) => watchlist.some((w) => w.title === title);

  return (
    <div className="sc-fade">
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input
          value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
          placeholder='Try "The Office", "Batman", or "Harry Potter"'
          style={{ flex: 1, padding: "12px 16px", borderRadius: 12, border: "2px solid #e2e2ea", fontSize: 14, fontFamily: "'DM Sans',sans-serif", outline: "none", transition: "border 0.2s", background: "#fff" }}
          onFocus={(e) => (e.target.style.borderColor = "#0d9488")}
          onBlur={(e) => (e.target.style.borderColor = "#e2e2ea")}
        />
        <button onClick={doSearch} disabled={loading || !query.trim()} style={{
          padding: "12px 22px", borderRadius: 12, border: "none", background: "#0d9488", color: "#fff", fontSize: 14,
          fontWeight: 600, cursor: loading ? "wait" : "pointer", fontFamily: "'DM Sans',sans-serif",
          opacity: loading || !query.trim() ? 0.5 : 1, transition: "all 0.2s", whiteSpace: "nowrap",
        }}>{loading ? "Searching..." : "Search"}</button>
      </div>

      {loading && <Loader text="Searching across all platforms..." />}
      {error && <ErrorState text="Search didn't go through. Try again?" onRetry={doSearch} />}

      {!loading && !error && results && results.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {results.map((r, i) => {
            const primary = svc(r.availableOn?.[0]?.service);
            const inWL = isInWL(r.title);
            return (
              <div key={i} className="sc-card" style={{ background: "#fff", border: "1px solid #e8e8f0", borderRadius: 14, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{
                  width: 46, height: 64, borderRadius: 10, flexShrink: 0,
                  background: `linear-gradient(135deg, ${primary?.color || "#666"}, #1a1a2e)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 18, fontWeight: 700,
                }}>{r.title?.[0] || "?"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
                    <h4 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "#1a1a2e" }}>{r.title}</h4>
                    <span style={{ fontSize: 11, color: "#999" }}>{r.year} · {r.type} · {r.rating}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "#777", margin: "2px 0 8px", lineHeight: 1.5 }}>{r.brief}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
                    {r.availableOn?.map((a, j) => <ServiceBadge key={j} {...a} />)}
                    <button onClick={() => inWL ? dispatchWL({ type: "REMOVE", title: r.title }) : dispatchWL({ type: "ADD", item: r })} style={{
                      marginLeft: "auto", padding: "4px 12px", borderRadius: 100, fontSize: 11, fontWeight: 600,
                      border: inWL ? "1px solid #a7f3d0" : "1px solid #e2e2ea",
                      background: inWL ? "#ecfdf5" : "#fff", color: inWL ? "#065f46" : "#888",
                      cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.2s",
                    }}>
                      {inWL ? "✓ In Watchlist" : "+ Watchlist"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && searched && (!results || results.length === 0) && (
        <EmptyState icon="🤷" text="No results found. Try a different title?" />
      )}
      {!searched && !loading && !error && (
        <EmptyState icon="🎬" text="Search for any movie, show, character, or franchise to see where it's streaming" />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// WHAT'S NEW TAB
// ═══════════════════════════════════════════
function WhatsNewTab() {
  const [selSvc, setSelSvc] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState("comingSoon");
  const cacheRef = useRef({});

  const doFetch = async (service) => {
    if (cacheRef.current[service.id]) { setData(cacheRef.current[service.id]); setError(false); return; }
    setLoading(true); setError(false); setData(null);
    const result = await fetchLifecycle(service.name);
    if (result) { cacheRef.current[service.id] = result; setData(result); } else setError(true);
    setLoading(false);
  };

  const select = (s) => { setSelSvc(s); doFetch(s); };

  const tabs = [
    { key: "recentlyAdded", label: "Just Added", dot: "#8b5cf6" },
    { key: "comingSoon", label: "Coming Soon", dot: "#0d9488" },
    { key: "leavingSoon", label: "Leaving Soon", dot: "#ef4444" },
  ];

  return (
    <div className="sc-fade">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        {SERVICES.map((s) => (
          <Pill key={s.id} active={selSvc?.id === s.id} color={s.color} accentBg={s.accent} onClick={() => select(s)}>
            <SvcIcon service={s} size={20} /> {s.name}
          </Pill>
        ))}
      </div>

      {!selSvc && <EmptyState icon="📺" text="Pick a streaming service to see what's new, coming soon, and leaving soon" />}
      {loading && <Loader text={`Checking what's happening on ${selSvc?.name}...`} />}
      {error && <ErrorState onRetry={() => doFetch(selSvc)} />}

      {!loading && !error && data && (
        <>
          <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: "7px 14px", borderRadius: 10, border: "none",
                background: tab === t.key ? "#0d9488" : "#f0f0f5",
                color: tab === t.key ? "#fff" : "#888",
                fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                fontFamily: "'DM Sans',sans-serif", transition: "all 0.2s",
              }}>{t.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(data[tab] || []).map((item, i) => {
              const dotColor = tabs.find((t) => t.key === tab)?.dot || "#999";
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: "#fff", border: "1px solid #e8e8f0" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>{item.title}</span>
                  <span style={{ fontSize: 11, color: "#999", marginRight: 4 }}>{item.type}</span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: "#777", padding: "3px 9px", background: "#f5f5fa", borderRadius: 100 }}>{item.date}</span>
                </div>
              );
            })}
            {(data[tab] || []).length === 0 && (
              <p style={{ textAlign: "center", color: "#bbb", fontSize: 13, padding: 20 }}>Nothing to show for this category right now.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// WATCHLIST TAB
// ═══════════════════════════════════════════
function WatchlistTab({ watchlist, dispatchWL }) {
  const [optData, setOptData] = useState(null);
  const [optLoading, setOptLoading] = useState(false);
  const [optError, setOptError] = useState(false);

  const runOptimizer = async () => {
    setOptLoading(true); setOptError(false); setOptData(null);
    const data = await fetchOptimizer(watchlist);
    if (data) setOptData(data); else setOptError(true);
    setOptLoading(false);
  };

  if (watchlist.length === 0) {
    return (
      <div className="sc-fade">
        <EmptyState icon="📋" text={<span>Your watchlist is empty. Head to <strong>Find a Title</strong> to search for shows and add them here.</span>} />
      </div>
    );
  }

  return (
    <div className="sc-fade">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <p style={{ fontSize: 14, color: "#888", margin: 0 }}>
          {watchlist.length} title{watchlist.length !== 1 ? "s" : ""} in your watchlist
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          {watchlist.length >= 2 && (
            <button onClick={runOptimizer} disabled={optLoading} style={{
              padding: "8px 16px", borderRadius: 10, border: "none", background: "#0d9488", color: "#fff",
              fontSize: 12.5, fontWeight: 600, cursor: optLoading ? "wait" : "pointer",
              fontFamily: "'DM Sans',sans-serif", opacity: optLoading ? 0.6 : 1, transition: "all 0.2s",
            }}>
              {optLoading ? "Optimizing..." : "⚡ Optimize My Subscriptions"}
            </button>
          )}
          <button onClick={() => { setOptData(null); dispatchWL({ type: "CLEAR" }); }} style={{
            padding: "8px 12px", borderRadius: 10, border: "1px solid #fecaca", background: "#fff",
            fontSize: 11, fontWeight: 600, cursor: "pointer", color: "#dc2626",
            fontFamily: "'DM Sans',sans-serif",
          }}>Clear All</button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {watchlist.map((item, i) => {
          const primary = svc(item.availableOn?.[0]?.service);
          return (
            <div key={i} style={{ background: "#fff", border: "1px solid #e8e8f0", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 34, height: 48, borderRadius: 8, flexShrink: 0,
                background: `linear-gradient(135deg, ${primary?.color || "#666"}, #1a1a2e)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 14, fontWeight: 700,
              }}>{item.title?.[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                <div style={{ fontSize: 11, color: "#999" }}>{item.year} · {item.type}</div>
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flexShrink: 0 }}>
                {item.availableOn?.slice(0, 2).map((a, j) => <ServiceBadge key={j} {...a} />)}
                {item.availableOn?.length > 2 && <span style={{ fontSize: 11, color: "#999", alignSelf: "center" }}>+{item.availableOn.length - 2}</span>}
              </div>
              <button onClick={() => dispatchWL({ type: "REMOVE", title: item.title })} style={{
                width: 26, height: 26, borderRadius: 8, border: "1px solid #e2e2ea",
                background: "#fff", cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 13, color: "#ccc", transition: "all 0.15s", flexShrink: 0,
              }} title="Remove">×</button>
            </div>
          );
        })}
      </div>

      {optLoading && <Loader text="Crunching the numbers on your best subscription plan..." />}
      {optError && <ErrorState text="Couldn't generate a plan right now. Try again?" onRetry={runOptimizer} />}

      {!optLoading && !optError && optData && (
        <div style={{ borderRadius: 16, border: "1px solid #ccfbf1", background: "#f0fdfa", padding: 18 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#1a1a2e", fontFamily: "'Fraunces',serif" }}>
            ⚡ Your Optimized Subscription Plan
          </h3>
          <p style={{ fontSize: 12.5, color: "#888", margin: "0 0 14px" }}>
            Here's the smartest way to watch everything on your list:
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {optData.plan?.map((step, i) => {
              const s = svc(step.service);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 12, background: "#fff", border: "1px solid #e8e8f0" }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", background: "#ccfbf1", color: "#0d9488",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e", display: "flex", alignItems: "center", gap: 5 }}>
                      {s && <SvcIcon service={s} size={18} />} {step.service}
                    </div>
                    <div style={{ fontSize: 11.5, color: "#888", marginTop: 1 }}>Watch: {step.watch?.join(", ")}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0d9488", flexShrink: 0 }}>{step.cost}</div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { label: "Total Cost", value: optData.totalCost, color: "#1a1a2e", bg: "#fff", border: "#e8e8f0" },
              { label: "All at Once Would Be", value: optData.vsAllAtOnce, color: "#dc2626", bg: "#fff", border: "#e8e8f0" },
              { label: "You Save", value: optData.savings, color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
            ].map((m, i) => (
              <div key={i} style={{ flex: 1, minWidth: 120, padding: "10px 14px", borderRadius: 10, background: m.bg, border: `1px solid ${m.border}`, textAlign: "center" }}>
                <div style={{ fontSize: 10.5, color: "#888", marginBottom: 2 }}>{m.label}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════
export default function StreamCompare() {
  const [tab, setTab] = useState("compare");
  const [watchlist, dispatchWL] = useReducer(watchlistReducer, []);

  const tabs = [
    { key: "compare", label: "Compare", icon: "⚡" },
    { key: "search", label: "Find a Title", icon: "🔍" },
    { key: "whatsnew", label: "What's New", icon: "🆕" },
    { key: "watchlist", label: `Watchlist${watchlist.length ? ` (${watchlist.length})` : ""}`, icon: "📋" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #fffbf5 0%, #f0faf9 100%)", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,700;0,9..144,800;1,9..144,500&display=swap');
        * { box-sizing: border-box; }
        input::placeholder { color: #b0b0c0; }
        .sc-loader { width: 30px; height: 30px; border: 3px solid #e8e8f0; border-top-color: #0d9488; border-radius: 50%; animation: sc-spin 0.8s linear infinite; margin: 0 auto; }
        @keyframes sc-spin { to { transform: rotate(360deg); } }
        @keyframes sc-fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .sc-fade { animation: sc-fadeIn 0.3s ease-out both; }
        .sc-card { transition: box-shadow 0.2s; }
        .sc-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
      `}</style>

      <div style={{ padding: "22px 20px 0", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: 24, color: "#1a1a2e", letterSpacing: -1, margin: 0 }}>
            Stream<span style={{ color: "#0d9488" }}>Compare</span>
          </h1>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#0d9488", background: "#ccfbf1", padding: "3px 10px", borderRadius: 100, whiteSpace: "nowrap" }}>
            Live Data · Powered by AI
          </span>
        </div>
        <p style={{ color: "#888", fontSize: 13, margin: "0 0 18px" }}>
          Compare streaming services, find where to watch anything, and stop overpaying.
        </p>

        <div style={{ display: "flex", gap: 3, background: "#ededf3", borderRadius: 12, padding: 3, width: "fit-content", maxWidth: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "8px 16px", borderRadius: 9, border: "none",
              background: tab === t.key ? "#fff" : "transparent",
              boxShadow: tab === t.key ? "0 1px 6px rgba(0,0,0,0.06)" : "none",
              color: tab === t.key ? "#1a1a2e" : "#888",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s", whiteSpace: "nowrap",
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 20px 50px" }}>
        {tab === "compare" && <CompareTab />}
        {tab === "search" && <SearchTab watchlist={watchlist} dispatchWL={dispatchWL} />}
        {tab === "whatsnew" && <WhatsNewTab />}
        {tab === "watchlist" && <WatchlistTab watchlist={watchlist} dispatchWL={dispatchWL} />}
      </div>
    </div>
  );
}
