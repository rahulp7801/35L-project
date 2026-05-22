"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth, googleProvider } from "../../lib/firebase";
import { useAuth } from "../../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "auth failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    setErr("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "google sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  const input: React.CSSProperties = {
    width: "100%",
    padding: "0.55rem 0.7rem",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: "var(--text)",
    fontSize: "0.95rem",
  };

  const btn: React.CSSProperties = {
    padding: "0.55rem 1rem",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: "var(--text)",
    fontWeight: 500,
    fontSize: "0.9rem",
  };

  const btnPrimary: React.CSSProperties = {
    ...btn,
    background: "var(--accent)",
    borderColor: "var(--accent)",
    color: "#fff",
    width: "100%",
  };

  return (
    <main style={{ maxWidth: 360, margin: "0 auto", padding: "4rem 1.25rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0, marginBottom: "1.5rem" }}>
        {mode === "signin" ? "Sign in" : "Create account"}
      </h1>

      <form onSubmit={handleEmail} style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={input}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          style={input}
        />
        <button type="submit" disabled={busy} style={btnPrimary}>
          {busy ? "…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
      </form>

      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", margin: "1rem 0", color: "var(--muted)", fontSize: "0.8rem" }}>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        or
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>

      <button type="button" onClick={handleGoogle} disabled={busy} style={{ ...btn, width: "100%" }}>
        Continue with Google
      </button>

      <p style={{ marginTop: "1.25rem", fontSize: "0.85rem", color: "var(--muted)", textAlign: "center" }}>
        {mode === "signin" ? "Need an account?" : "Already have one?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setErr("");
          }}
          style={{ background: "none", border: "none", color: "var(--accent)", padding: 0, fontSize: "0.85rem" }}
        >
          {mode === "signin" ? "Sign up" : "Sign in"}
        </button>
      </p>

      {err && (
        <p style={{ marginTop: "1rem", padding: "0.6rem 0.75rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, color: "var(--error)", fontSize: "0.85rem" }}>
          {err}
        </p>
      )}
    </main>
  );
}
