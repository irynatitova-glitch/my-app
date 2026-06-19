import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Header from "../components/Header";
import { getSessionUser } from "../lib/auth";

export async function getServerSideProps(context) {
  // Already signed in? Skip the login screen.
  if (await getSessionUser(context.req)) {
    return { redirect: { destination: "/", permanent: false } };
  }
  return { props: {} };
}

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  function switchMode(next) {
    setMode(next);
    setError("");
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const next = typeof router.query.next === "string" ? router.query.next : "/";
        // Full navigation so the freshly-set cookie is sent with the next request.
        window.location.assign(next.startsWith("/") ? next : "/");
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong. Please try again.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head><title>{`${isRegister ? "Create account" : "Sign in"} — Store Tracker`}</title></Head>
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", background: "#f8fafc", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 420, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 32, boxShadow: "0 10px 30px rgba(15,23,42,0.06)" }}>
          <Header compact />
          <p style={{ margin: "0 0 24px", fontSize: 14, color: "#64748b", textAlign: "center" }}>
            {isRegister ? "Create an account to get started" : "Sign in to continue"}
          </p>

          {/* Mode toggle */}
          <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 10, padding: 4, marginBottom: 20 }}>
            {[["login", "Sign in"], ["register", "Create account"]].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => switchMode(key)}
                style={{
                  flex: 1, padding: "8px 0", border: "none", borderRadius: 7, cursor: "pointer",
                  fontSize: 13, fontWeight: 700,
                  background: mode === key ? "#fff" : "transparent",
                  color: mode === key ? "#0f172a" : "#64748b",
                  boxShadow: mode === key ? "0 1px 2px rgba(15,23,42,0.08)" : "none",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={labelStyle}>
              Email
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Password
              <input
                type="password"
                required
                minLength={isRegister ? 6 : undefined}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={isRegister ? "At least 6 characters" : "••••••••"}
                style={inputStyle}
              />
            </label>

            {error && (
              <p style={{ margin: 0, fontSize: 13, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 10px" }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} style={{ ...primaryBtn, opacity: loading ? 0.7 : 1, marginTop: 4 }}>
              {loading
                ? (isRegister ? "Creating account…" : "Signing in…")
                : (isRegister ? "Create account" : "Sign in")}
            </button>
          </form>

          <p style={{ margin: "18px 0 0", fontSize: 13, color: "#64748b", textAlign: "center" }}>
            {isRegister ? "Already have an account? " : "No account yet? "}
            <button
              type="button"
              onClick={() => switchMode(isRegister ? "login" : "register")}
              style={{ background: "none", border: "none", color: "#6366f1", fontWeight: 700, cursor: "pointer", fontSize: 13, padding: 0 }}
            >
              {isRegister ? "Sign in" : "Create one"}
            </button>
          </p>
        </div>
      </div>
    </>
  );
}

const labelStyle = { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "#374151" };
const inputStyle = { padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 14, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
const primaryBtn = { padding: "11px 18px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 15 };
