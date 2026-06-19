import { useState } from "react";

const TYPES = ["FEATURE", "PRICING", "APP_STORE", "UA_CREATIVE"];

export default function AddUpdateModal({ competitorId, onClose, onAdded }) {
  const [form, setForm] = useState({ type: "FEATURE", title: "", description: "", sourceUrl: "", occurredAt: "" });
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competitorId, ...form }),
    });
    setLoading(false);
    if (res.ok) { onAdded(await res.json()); onClose(); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <h3 style={{ margin: "0 0 20px", fontSize: 18 }}>Log Update</h3>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={labelStyle}>
            Type
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inputStyle}>
              {TYPES.map(t => <option key={t}>{t.replace("_", " ")}</option>)}
            </select>
          </label>
          <label style={labelStyle}>
            Title *
            <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} placeholder="e.g. Added weekly subscription tier" />
          </label>
          <label style={labelStyle}>
            Description
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </label>
          <label style={labelStyle}>
            Source URL
            <input value={form.sourceUrl} onChange={e => setForm(f => ({ ...f, sourceUrl: e.target.value }))} style={inputStyle} placeholder="https://…" />
          </label>
          <label style={labelStyle}>
            Date spotted
            <input type="date" value={form.occurredAt} onChange={e => setForm(f => ({ ...f, occurredAt: e.target.value }))} style={inputStyle} />
          </label>
          <div style={{ display: "flex", gap: 10, marginTop: 4, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} style={ghostBtn}>Cancel</button>
            <button type="submit" disabled={loading} style={primaryBtn}>{loading ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const labelStyle = { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600, color: "#374151" };
const inputStyle = { padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, fontFamily: "inherit" };
const primaryBtn = { padding: "8px 20px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 14 };
const ghostBtn = { padding: "8px 20px", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 14 };
