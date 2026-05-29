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
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
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

  function toggleMode() {
    setMode(mode === "signin" ? "signup" : "signin");
    setErr("");
  }

  return (
    <main className="mx-auto max-w-[360px] px-5 py-16">
      <h1 className="m-0 mb-6 text-2xl font-semibold">
        {mode === "signin" ? "Sign in" : "Create account"}
      </h1>

      <form onSubmit={handleEmail} className="flex flex-col gap-[0.6rem]">
        <TextField
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <Button type="submit" variant="primary" disabled={busy} className="w-full">
          {busy ? "…" : mode === "signin" ? "Sign in" : "Sign up"}
        </Button>
      </form>

      <div className="my-4 flex items-center gap-[0.6rem] text-[0.8rem] text-muted">
        <div className="h-px flex-1 bg-border" />
        or
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button onClick={handleGoogle} disabled={busy} className="w-full">
        Continue with Google
      </Button>

      <p className="mt-5 text-center text-[0.85rem] text-muted">
        {mode === "signin" ? "Need an account?" : "Already have one?"}{" "}
        <button
          type="button"
          onClick={toggleMode}
          className="border-none bg-transparent p-0 text-[0.85rem] text-accent"
        >
          {mode === "signin" ? "Sign up" : "Sign in"}
        </button>
      </p>

      {err && (
        <div className="mt-4">
          <Alert tone="error">{err}</Alert>
        </div>
      )}
    </main>
  );
}
