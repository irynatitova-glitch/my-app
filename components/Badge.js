const COLORS = {
  FEATURE: { bg: "#dbeafe", text: "#1d4ed8", label: "Feature" },
  PRICING: { bg: "#dcfce7", text: "#15803d", label: "Pricing" },
  APP_STORE: { bg: "#fef9c3", text: "#854d0e", label: "App Store" },
  UA_CREATIVE: { bg: "#fce7f3", text: "#9d174d", label: "UA Creative" },
};

export default function Badge({ type }) {
  const c = COLORS[type] ?? { bg: "#f3f4f6", text: "#374151", label: type };
  return (
    <span style={{
      background: c.bg, color: c.text,
      padding: "2px 10px", borderRadius: 99,
      fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
    }}>
      {c.label}
    </span>
  );
}
