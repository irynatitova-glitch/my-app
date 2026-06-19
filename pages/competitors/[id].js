import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import prisma from "../../lib/prisma";
import Badge from "../../components/Badge";
import InsightPanel from "../../components/InsightPanel";
import AddUpdateModal from "../../components/AddUpdateModal";
import Header from "../../components/Header";
import { requireAuth } from "../../lib/auth";

export async function getServerSideProps(context) {
  const auth = await requireAuth(context);
  if (auth.redirect) return { redirect: auth.redirect };

  const { params } = context;
  const competitor = await prisma.competitor.findUnique({
    where: { id: params.id },
    include: {
      updates: { orderBy: { occurredAt: "desc" }, include: { insight: true } },
    },
  });
  if (!competitor) return { notFound: true };
  return { props: { competitor: JSON.parse(JSON.stringify(competitor)) } };
}

const TYPE_ICON = { FEATURE: "🚀", PRICING: "💰", APP_STORE: "📱", UA_CREATIVE: "🎨" };

export default function CompetitorPage({ competitor: initial }) {
  const router = useRouter();
  const [competitor, setCompetitor] = useState(initial);
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState({});

  function onAdded(newUpdate) {
    setCompetitor(prev => ({
      ...prev,
      updates: [{ ...newUpdate, insight: null }, ...prev.updates],
    }));
  }

  async function deleteUpdate(id) {
    if (!confirm("Delete this update?")) return;
    await fetch(`/api/updates/${id}`, { method: "DELETE" });
    setCompetitor(prev => ({ ...prev, updates: prev.updates.filter(u => u.id !== id) }));
  }

  const grouped = groupByMonth(competitor.updates);

  return (
    <>
      <Head><title>{competitor.name} — Competitor Intel</title></Head>
      <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 760, margin: "0 auto", padding: "36px 24px" }}>
        <Header compact />
        {/* Page nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <button onClick={() => router.push("/")} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 14, padding: 0 }}>
            ← Back
          </button>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "#0f172a" }}>{competitor.name}</h1>
            <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
              {competitor.category && <span style={{ fontSize: 13, color: "#64748b" }}>{competitor.category}</span>}
              {competitor.appStoreUrl && (
                <a href={competitor.appStoreUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#6366f1" }}>App Store →</a>
              )}
            </div>
          </div>
          <button onClick={() => setShowModal(true)} style={primaryBtn}>+ Log Update</button>
        </div>

        {/* Stats strip */}
        <div style={{ display: "flex", gap: 12, marginBottom: 36, flexWrap: "wrap" }}>
          {["FEATURE", "PRICING", "APP_STORE", "UA_CREATIVE"].map(type => {
            const count = competitor.updates.filter(u => u.type === type).length;
            return (
              <div key={type} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 16px", minWidth: 90 }}>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0f172a" }}>{count}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{type.replace("_", " ")}</p>
              </div>
            );
          })}
        </div>

        {/* Timeline */}
        {competitor.updates.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
            <p style={{ fontSize: 36, margin: 0 }}>📭</p>
            <p style={{ marginTop: 10, fontSize: 15 }}>No updates yet. Log the first one above.</p>
          </div>
        ) : (
          Object.entries(grouped).map(([month, updates]) => (
            <div key={month} style={{ marginBottom: 36 }}>
              <p style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em", textTransform: "uppercase" }}>{month}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {updates.map((update, i) => (
                  <div key={update.id} style={{ display: "flex", gap: 0 }}>
                    {/* Timeline rail */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 32, flexShrink: 0 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#6366f1", marginTop: 18, flexShrink: 0, zIndex: 1 }} />
                      {i < updates.length - 1 && <div style={{ width: 2, flex: 1, background: "#e2e8f0", minHeight: 24 }} />}
                    </div>

                    {/* Card */}
                    <div style={{ flex: 1, marginLeft: 12, marginBottom: 16, border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
                      <div style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 16 }}>{TYPE_ICON[update.type]}</span>
                            <Badge type={update.type} />
                            <span style={{ fontSize: 12, color: "#cbd5e1" }}>
                              {new Date(update.occurredAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            <button
                              onClick={() => setExpanded(e => ({ ...e, [update.id]: !e[update.id] }))}
                              style={{ background: "#f1f5f9", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "#475569", fontWeight: 600 }}
                            >
                              {expanded[update.id] ? "Hide AI" : "🤖 Analyze"}
                            </button>
                            <button onClick={() => deleteUpdate(update.id)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", fontSize: 14, padding: "4px 6px" }}>✕</button>
                          </div>
                        </div>
                        <p style={{ margin: "10px 0 0", fontWeight: 600, fontSize: 15, color: "#0f172a" }}>{update.title}</p>
                        {update.description && (
                          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{update.description}</p>
                        )}
                        {update.sourceUrl && (
                          <a href={update.sourceUrl} target="_blank" rel="noreferrer"
                            style={{ display: "inline-block", marginTop: 8, fontSize: 12, color: "#6366f1" }}>
                            View source →
                          </a>
                        )}
                        {update.screenshots?.length > 0 && (
                          <div style={{ marginTop: 12, display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                            {update.screenshots.map((src, i) => (
                              <a key={i} href={src} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
                                <img src={src} alt={`Screenshot ${i + 1}`} loading="lazy"
                                  style={{ height: 220, borderRadius: 10, border: "1px solid #e2e8f0", display: "block" }} />
                              </a>
                            ))}
                          </div>
                        )}
                        {update.insight && !expanded[update.id] && (
                          <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {update.insight.aveolaTips.slice(0, 1).map((tip, i) => (
                              <span key={i} style={{ background: "#f0fdf4", color: "#15803d", fontSize: 12, padding: "3px 10px", borderRadius: 99, fontWeight: 500 }}>
                                💡 {tip}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {expanded[update.id] && (
                        <div style={{ borderTop: "1px solid #f1f5f9", padding: "0 16px 16px" }}>
                          <InsightPanel updateId={update.id} existing={update.insight} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <AddUpdateModal
          competitorId={competitor.id}
          onClose={() => setShowModal(false)}
          onAdded={onAdded}
        />
      )}
    </>
  );
}

function groupByMonth(updates) {
  const groups = {};
  for (const u of updates) {
    const key = new Date(u.occurredAt).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    if (!groups[key]) groups[key] = [];
    groups[key].push(u);
  }
  return groups;
}

const primaryBtn = { padding: "10px 18px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 14 };
