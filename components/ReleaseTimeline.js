import { useMemo, useState } from "react";

// Release-activity graph: X axis = date, Y axis = number of updates that day.
// Bars are colored by update type; an app highlight dims days that don't
// include the selected competitor (Bigo / Azar / Gaze / …).
const TYPES = [
  { key: "FEATURE", label: "Feature", color: "#3b82f6" },
  { key: "PRICING", label: "Pricing", color: "#22c55e" },
  { key: "APP_STORE", label: "App Store", color: "#f59e0b" },
  { key: "UA_CREATIVE", label: "UA Creative", color: "#ec4899" },
];

export default function ReleaseTimeline({ updates }) {
  const [active, setActive] = useState(() => new Set(TYPES.map(t => t.key)));
  const [highlightApp, setHighlightApp] = useState(null); // app name to emphasize, or null

  const toggle = key =>
    setActive(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // Distinct apps present in the data, sorted (Bigo, Azar, Gaze, …).
  const apps = useMemo(
    () => Array.from(new Set(updates.map(u => u.app))).sort((a, b) => a.localeCompare(b)),
    [updates]
  );

  // Filter by active types, then bucket updates per calendar day.
  const days = useMemo(() => {
    const map = new Map(); // dayKey -> { byType: {type:count}, byApp: {app:count} }
    for (const u of updates) {
      if (!active.has(u.type)) continue;
      const key = new Date(u.date).toISOString().slice(0, 10);
      const bucket = map.get(key) || { byType: {}, byApp: {} };
      bucket.byType[u.type] = (bucket.byType[u.type] || 0) + 1;
      bucket.byApp[u.app] = (bucket.byApp[u.app] || 0) + 1;
      map.set(key, bucket);
    }
    if (map.size === 0) return [];

    // Build a continuous daily axis so days with no release show as gaps.
    const keys = Array.from(map.keys()).sort();
    const start = new Date(keys[0] + "T00:00:00Z");
    const end = new Date(keys[keys.length - 1] + "T00:00:00Z");
    const out = [];
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      const bucket = map.get(key) || { byType: {}, byApp: {} };
      const value = Object.values(bucket.byType).reduce((s, c) => s + c, 0);
      out.push({ key, byType: bucket.byType, byApp: bucket.byApp, value });
    }
    return out;
  }, [updates, active]);

  const maxVal = days.reduce((m, d) => Math.max(m, d.value), 0);
  const totalReleases = days.reduce((s, d) => s + d.value, 0);
  const activeDays = days.filter(d => d.value > 0).length;

  // SVG geometry
  const W = 860, H = 220;
  const padL = 40, padR = 20, padT = 20, padB = 40;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = days.length;
  const yBottom = padT + plotH;
  const barW = n > 0 ? Math.max(2, Math.min(22, (plotW / n) * 0.7)) : 0;
  const x = i => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yFor = v => yBottom - (maxVal === 0 ? 0 : (v / maxVal) * plotH);

  // Integer Y ticks (0..maxVal, at most 5 lines)
  const step = Math.max(1, Math.ceil(maxVal / 4));
  const yTicks = [];
  for (let v = 0; v <= maxVal; v += step) yTicks.push(v);
  if (maxVal > 0 && yTicks[yTicks.length - 1] !== maxVal) yTicks.push(maxVal);

  // X-axis date ticks: ~6 evenly spaced labels
  const tickCount = Math.min(6, n);
  const tickIdx = Array.from({ length: tickCount }, (_, k) =>
    Math.round((k / Math.max(1, tickCount - 1)) * (n - 1))
  );
  // Pin locale + timeZone so server and client render identical labels (the day
  // buckets above are UTC) — otherwise SSR/client locale differences cause a
  // hydration mismatch (e.g. "Feb 13" vs "13 Feb").
  const fmt = key =>
    new Date(key + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <div style={wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <h2 style={heading}>Release activity</h2>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>
          {totalReleases} update{totalReleases === 1 ? "" : "s"} across {activeDays} day{activeDays === 1 ? "" : "s"}
          {highlightApp ? ` · highlighting ${highlightApp}` : ""}
        </span>
      </div>

      {/* Type filter toggles (control which updates are counted, colored by type) */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {TYPES.map(t => {
          const on = active.has(t.key);
          return (
            <button key={t.key} onClick={() => toggle(t.key)} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 999,
              border: `1px solid ${on ? t.color : "#e2e8f0"}`, background: on ? t.color + "15" : "#fff",
              color: on ? "#0f172a" : "#94a3b8", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: on ? t.color : "#cbd5e1" }} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* App highlight (click to emphasize a competitor; click again to clear) */}
      {apps.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>App</span>
          {apps.map(app => {
            const on = highlightApp === app;
            return (
              <button key={app} onClick={() => setHighlightApp(on ? null : app)} style={{
                padding: "5px 12px", borderRadius: 999,
                border: `1px solid ${on ? "#0f172a" : "#e2e8f0"}`,
                background: on ? "#0f172a" : "#fff", color: on ? "#fff" : "#475569",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>
                {app}
              </button>
            );
          })}
        </div>
      )}

      {days.length === 0 ? (
        <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>No updates match the selected types.</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Number of competitor release updates per day">
          {/* Y gridlines + integer labels */}
          {yTicks.map(v => {
            const yy = yFor(v);
            return (
              <g key={v}>
                <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke="#e2e8f0" strokeWidth="1" />
                <text x={padL - 8} y={yy + 4} textAnchor="end" fontSize="11" fill="#94a3b8">{v}</text>
              </g>
            );
          })}

          {/* Stacked bars: height = update count that day, each segment colored by type.
              When an app is highlighted, days without that app are dimmed. */}
          {days.map((d, i) => {
            if (d.value === 0) return null;
            const hasApp = !highlightApp || (d.byApp[highlightApp] > 0);
            let stacked = 0; // running count from the bottom
            const appTip = Object.entries(d.byApp).map(([a, c]) => `${a}: ${c}`).join(", ");
            const typeTip = TYPES.filter(t => d.byType[t.key]).map(t => `${t.label}: ${d.byType[t.key]}`).join(", ");
            return (
              <g key={d.key} opacity={hasApp ? 1 : 0.18}>
                {TYPES.map(t => {
                  const c = d.byType[t.key];
                  if (!c) return null;
                  const yTopSeg = yFor(stacked + c);
                  const yBotSeg = yFor(stacked);
                  stacked += c;
                  return <rect key={t.key} x={x(i) - barW / 2} y={yTopSeg} width={barW} height={yBotSeg - yTopSeg} fill={t.color} />;
                })}
                {/* outline emphasis on the highlighted app's days */}
                {highlightApp && hasApp && (
                  <rect x={x(i) - barW / 2 - 1.5} y={yFor(d.value) - 1.5} width={barW + 3} height={yBottom - yFor(d.value) + 1.5}
                    fill="none" stroke="#0f172a" strokeWidth="1.5" rx="3" />
                )}
                {/* transparent hit area for a combined tooltip */}
                <rect x={x(i) - barW / 2} y={yFor(d.value)} width={barW} height={yBottom - yFor(d.value)} fill="transparent">
                  <title>{`${d.key}\nApps — ${appTip}\nTypes — ${typeTip}`}</title>
                </rect>
              </g>
            );
          })}

          {/* X-axis line + date ticks */}
          <line x1={padL} y1={yBottom} x2={W - padR} y2={yBottom} stroke="#cbd5e1" strokeWidth="1" />
          {tickIdx.map(i => (
            <text key={i} x={x(i)} y={yBottom + 18} textAnchor="middle" fontSize="11" fill="#64748b">
              {fmt(days[i].key)}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}

const wrap = { border: "1px solid #e2e8f0", borderRadius: 14, padding: 20, marginBottom: 28, background: "#fff" };
const heading = { margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" };
