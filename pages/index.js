import { useState } from "react";
import { useRouter } from "next/router";
import prisma from "../lib/prisma";
import Head from "next/head";
import { requireAuth } from "../lib/auth";
import ReleaseTimeline from "../components/ReleaseTimeline";
import Header from "../components/Header";

export async function getServerSideProps(context) {
  const auth = await requireAuth(context);
  if (auth.redirect) return { redirect: auth.redirect };

  const competitors = await prisma.competitor.findMany({
    include: { updates: { orderBy: { occurredAt: "desc" }, take: 1 } },
    orderBy: { name: "asc" },
  });
  // All updates across every competitor — drives the release-activity timeline.
  const allUpdates = await prisma.update.findMany({
    select: { occurredAt: true, type: true, competitor: { select: { name: true } } },
  });
  const updates = allUpdates.map(u => ({ date: u.occurredAt.toISOString(), type: u.type, app: u.competitor.name }));
  return { props: { competitors: JSON.parse(JSON.stringify(competitors)), updates, userEmail: auth.user.email } };
}

const TYPE_COLOR = {
  FEATURE: "#3b82f6", PRICING: "#22c55e", APP_STORE: "#f59e0b", UA_CREATIVE: "#ec4899",
};

export default function Home({ competitors: initial, updates, userEmail }) {
  const router = useRouter();
  const [competitors, setCompetitors] = useState(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", appStoreUrl: "", category: "" });
  const [adding, setAdding] = useState(false);

  async function addCompetitor(e) {
    e.preventDefault();
    setAdding(true);
    const res = await fetch("/api/competitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const c = await res.json();
      setCompetitors(prev => [...prev, { ...c, updates: [] }].sort((a, b) => a.name.localeCompare(b.name)));
      setForm({ name: "", appStoreUrl: "", category: "" });
      setShowAdd(false);
    }
    setAdding(false);
  }

  async function deleteCompetitor(id) {
    if (!confirm("Delete this competitor and all their updates?")) return;
    await fetch(`/api/competitors/${id}`, { method: "DELETE" });
    setCompetitors(prev => prev.filter(c => c.id !== id));
  }

  return (
    <>
      <Head><title>Store Tracker</title></Head>
      <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 920, margin: "0 auto", padding: "40px 24px" }}>
        <Header />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
          <div>
            <p style={{ margin: 0, color: "#64748b", fontSize: 15 }}>Track features, pricing, App Store &amp; UA updates — analyzed by Claude AI</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#64748b" }}>
              <span title={userEmail}>{userEmail}</span>
              <a href="/api/auth/logout" style={{ color: "#6366f1", fontWeight: 600, textDecoration: "none" }}>Sign out</a>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => router.push("/compare")} style={secondaryBtn}>⊞ Compare</button>
              <button onClick={() => setShowAdd(s => !s)} style={primaryBtn}>
                {showAdd ? "Cancel" : "+ Add Competitor"}
              </button>
            </div>
          </div>
        </div>

        <ReleaseTimeline updates={updates} />

        {showAdd && (
          <form onSubmit={addCompetitor} style={{ background: "#f8fafc", borderRadius: 12, padding: 20, marginBottom: 28, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", border: "1px solid #e2e8f0" }}>
            <label style={labelStyle}>
              Name *
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Calm" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Category
              <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Wellness" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              App Store URL
              <input value={form.appStoreUrl} onChange={e => setForm(f => ({ ...f, appStoreUrl: e.target.value }))} placeholder="https://apps.apple.com/…" style={{ ...inputStyle, width: 260 }} />
            </label>
            <button type="submit" disabled={adding} style={{ ...primaryBtn, alignSelf: "flex-end" }}>{adding ? "Adding…" : "Add"}</button>
          </form>
        )}

        {competitors.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#94a3b8" }}>
            <p style={{ fontSize: 48, margin: 0 }}>📊</p>
            <p style={{ fontSize: 16, marginTop: 12 }}>No competitors yet. Add your first one above.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {competitors.map(c => {
              const last = c.updates[0];
              return (
                <div key={c.id}
                  style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 20, cursor: "pointer", background: "#fff" }}
                  onClick={() => router.push(`/competitors/${c.id}`)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>{c.name}</h2>
                      {c.category && <p style={{ margin: "3px 0 0", fontSize: 12, color: "#94a3b8" }}>{c.category}</p>}
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteCompetitor(c.id); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", fontSize: 16, padding: 4 }}>✕</button>
                  </div>
                  {last ? (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #f1f5f9" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: TYPE_COLOR[last.type] ?? "#94a3b8", flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>{last.type.replace("_", " ")}</span>
                        <span style={{ fontSize: 11, color: "#cbd5e1", marginLeft: "auto" }}>
                          {new Date(last.occurredAt).toLocaleDateString("en-US", { timeZone: "UTC" })}
                        </span>
                      </div>
                      <p style={{ margin: "6px 0 0", fontSize: 13, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{last.title}</p>
                    </div>
                  ) : (
                    <p style={{ margin: "14px 0 0", fontSize: 13, color: "#cbd5e1" }}>No updates yet</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

const primaryBtn = { padding: "10px 18px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 14 };
const secondaryBtn = { padding: "10px 16px", background: "#fff", color: "#475569", border: "1px solid #cbd5e1", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 14 };
const labelStyle = { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600, color: "#374151" };
const inputStyle = { padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, fontFamily: "inherit", width: 180 };
