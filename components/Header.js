// Branded banner header for Store Tracker.
// The illustration lives at public/header-banner.png and is served from /header-banner.png.
// Pass `compact` for a shorter banner that fits narrow layouts (detail/login pages).
export default function Header({ compact = false }) {
  return (
    <header style={{ ...wrap, minHeight: compact ? 120 : 200 }}>
      <div style={scrim} />
      <div style={{ ...content, padding: compact ? "24px 28px" : "40px 36px" }}>
        <h1 style={{ ...title, fontSize: compact ? 28 : 40 }}>Store Tracker</h1>
        <p style={{ ...motto, fontSize: compact ? 15 : 19, marginTop: compact ? 6 : 10 }}>
          Don&apos;t let the details slip
        </p>
      </div>
    </header>
  );
}

const wrap = {
  position: "relative",
  width: "100%",
  borderRadius: 18,
  overflow: "hidden",
  marginBottom: 28,
  backgroundImage: "url('/header-banner.png')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  boxShadow: "0 10px 30px rgba(76, 29, 149, 0.25)",
};

// Left-to-right purple scrim so the white motto stays legible over the art.
const scrim = {
  position: "absolute",
  inset: 0,
  background:
    "linear-gradient(90deg, rgba(76,29,149,0.85) 0%, rgba(99,102,241,0.55) 45%, rgba(99,102,241,0) 80%)",
};

const content = {
  position: "relative",
  maxWidth: 560,
};

const title = {
  margin: 0,
  color: "#ffffff",
  fontWeight: 900,
  letterSpacing: "-0.02em",
  textShadow: "0 2px 12px rgba(0,0,0,0.25)",
};

const motto = {
  margin: 0,
  color: "#e9e6ff",
  fontWeight: 600,
  textShadow: "0 1px 8px rgba(0,0,0,0.25)",
};
