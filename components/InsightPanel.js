import { useState } from "react";

export default function InsightPanel({ updateId, existing }) {
  const [text, setText] = useState(existing?.rawInput ?? "");
  const [insight, setInsight] = useState(existing ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function analyze() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, updateId }),
      });
      if (!res.ok) throw new Error(await res.text());
      setInsight(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 12, background: "#f8fafc", borderRadius: 10, padding: 16, border: "1px solid #e2e8f0" }}>
      <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 13, color: "#475569" }}>
        🤖 AI Analysis
      </p>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Paste App Store description, pricing page, or UA copy…"
        rows={4}
        style={{ width: "100%", borderRadius: 8, border: "1px solid #cbd5e1", padding: 10, fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
      />

      <button
        onClick={analyze}
        disabled={loading || !text.trim()}
        style={{ marginTop: 8, padding: "6px 16px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, opacity: loading ? 0.6 : 1 }}
      >
        {loading ? "Analyzing…" : "Extract Insights"}
      </button>

      {error && <p style={{ color: "#dc2626", fontSize: 12, marginTop: 8 }}>{error}</p>}

      {insight && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <InsightSection label="💰 Monetization" value={insight.monetizationModel} />
          <InsightSection label="🎯 Target Persona" value={insight.targetPersona} />
          <InsightList label="🪝 Key Hooks" items={insight.keyHooks} color="#1d4ed8" />
          <InsightList label="🧪 Test on Aveola" items={insight.aveolaTips} color="#15803d" />
        </div>
      )}
    </div>
  );
}

function InsightSection({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, color: "#64748b" }}>{label}</p>
      <p style={{ margin: 0, fontSize: 13, color: "#1e293b" }}>{value}</p>
    </div>
  );
}

function InsightList({ label, items, color }) {
  if (!items?.length) return null;
  return (
    <div>
      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "#64748b" }}>{label}</p>
      <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map((item, i) => (
          <li key={i} style={{ fontSize: 13, color }}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
