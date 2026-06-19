import Head from "next/head";
import { useRouter } from "next/router";
import prisma from "../lib/prisma";
import { requireAuth } from "../lib/auth";

export async function getServerSideProps(context) {
  const auth = await requireAuth(context);
  if (auth.redirect) return { redirect: auth.redirect };

  const competitors = await prisma.competitor.findMany({
    include: {
      updates: { orderBy: { occurredAt: "desc" }, include: { insight: true } },
    },
    orderBy: { name: "asc" },
  });

  const now = Date.now();
  const rows = competitors.map((c) => {
    const latest = c.updates[0] || null;
    const withInsight = c.updates.find((u) => u.insight) || null;
    const withShots = c.updates.find((u) => u.screenshots?.length > 0) || null;
    const daysSince = latest ? Math.floor((now - new Date(latest.occurredAt).getTime()) / 86400000) : null;
    return {
      id: c.id,
      name: c.name.trim(),
      category: c.category,
      latestTitle: latest?.title || null,
      latestDate: latest ? new Date(latest.occurredAt).toISOString().slice(0, 10) : null,
      daysSince,
      insight: withInsight?.insight
        ? {
            monetizationModel: withInsight.insight.monetizationModel,
            keyHooks: withInsight.insight.keyHooks,
            targetPersona: withInsight.insight.targetPersona,
            aveolaTips: withInsight.insight.aveolaTips,
          }
        : null,
      thumbnail: withShots?.screenshots?.[0] || null,
    };
  });

  return { props: { rows } };
}

function cadenceLabel(days) {
  if (days == null) return { text: "—", color: "#94a3b8" };
  if (days <= 14) return { text: `${days}d ago · active`, color: "#15803d" };
  if (days <= 45) return { text: `${days}d ago`, color: "#854d0e" };
  return { text: `${days}d ago · stale`, color: "#b91c1c" };
}

const DIMENSIONS = [
  { key: "cadence", label: "Release cadence" },
  { key: "monetization", label: "Monetization" },
  { key: "persona", label: "Target persona" },
  { key: "hooks", label: "Key hooks" },
  { key: "tips", label: "💡 Aveola tips" },
];

export default function Compare({ rows }) {
  const router = useRouter();
  const colWidth = 300;

  return (
    <>
      <Head><title>Compare — Competitor Intel</title></Head>
      <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 1200, margin: "0 auto", padding: "40px 24px" }}>
        <button onClick={() => router.push("/")} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 14, padding: 0, marginBottom: 12 }}>
          ← Back
        </button>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#0f172a" }}>Competitor Comparison</h1>
        <p style={{ margin: "6px 0 28px", color: "#64748b", fontSize: 15 }}>
          Side-by-side monetization, positioning &amp; cadence — analyzed by Claude.
        </p>

        {rows.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>No competitors yet.</p>
        ) : (
          <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 14 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 200 + rows.length * colWidth }}>
              <thead>
                <tr>
                  <th style={{ ...thCell, position: "sticky", left: 0, background: "#f8fafc", zIndex: 2, width: 160 }} />
                  {rows.map((r) => (
                    <th key={r.id} style={{ ...thCell, width: colWidth, cursor: "pointer" }} onClick={() => router.push(`/competitors/${r.id}`)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {r.thumbnail && (
                          <img src={r.thumbnail} alt="" style={{ width: 30, height: 64, borderRadius: 6, objectFit: "cover", border: "1px solid #e2e8f0", flexShrink: 0 }} />
                        )}
                        <div style={{ textAlign: "left" }}>
                          <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{r.name}</div>
                          {r.category && <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>{r.category}</div>}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DIMENSIONS.map((dim) => (
                  <tr key={dim.key}>
                    <td style={{ ...rowLabel, position: "sticky", left: 0, background: "#f8fafc", zIndex: 1 }}>{dim.label}</td>
                    {rows.map((r) => (
                      <td key={r.id} style={bodyCell}>{renderCell(dim.key, r)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function renderCell(key, r) {
  const empty = <span style={{ color: "#cbd5e1" }}>—</span>;
  if (key === "cadence") {
    const c = cadenceLabel(r.daysSince);
    return (
      <div>
        <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 13 }}>{r.latestTitle || "—"}</div>
        <div style={{ fontSize: 12, color: c.color, fontWeight: 600, marginTop: 3 }}>{c.text}</div>
        {r.latestDate && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{r.latestDate}</div>}
      </div>
    );
  }
  if (!r.insight) return empty;
  if (key === "monetization") return <span style={{ fontSize: 13, color: "#334155", lineHeight: 1.5 }}>{r.insight.monetizationModel || empty}</span>;
  if (key === "persona") return <span style={{ fontSize: 13, color: "#334155", lineHeight: 1.5 }}>{r.insight.targetPersona || empty}</span>;
  if (key === "hooks")
    return (
      <ul style={listStyle}>
        {(r.insight.keyHooks || []).map((h, i) => <li key={i} style={{ marginBottom: 6 }}>{h}</li>)}
      </ul>
    );
  if (key === "tips")
    return (
      <ul style={listStyle}>
        {(r.insight.aveolaTips || []).map((t, i) => (
          <li key={i} style={{ marginBottom: 6, color: "#15803d" }}>{t}</li>
        ))}
      </ul>
    );
  return empty;
}

const thCell = { padding: "16px 14px", borderBottom: "2px solid #e2e8f0", verticalAlign: "middle", textAlign: "left" };
const rowLabel = { padding: "14px", fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", verticalAlign: "top", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" };
const bodyCell = { padding: "14px", verticalAlign: "top", borderBottom: "1px solid #f1f5f9", borderLeft: "1px solid #f1f5f9" };
const listStyle = { margin: 0, paddingLeft: 18, fontSize: 13, color: "#334155", lineHeight: 1.5 };
