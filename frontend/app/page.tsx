"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { db } from "../lib/firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

type Course = { term: string; code: string; units: number; grade: string; title: string };
type Need = { section: string; needs_raw: string };
type Parsed = { completed: Course[]; in_progress: Course[]; remaining: Need[] };

type Upload = {
  id: string;
  filename: string;
  size: number;
  uploadedAt: Timestamp | null;
  parsed: Parsed;
};

type Status = "idle" | "uploading" | "done" | "error";

const MAX_BYTES = 10 * 1024 * 1024;

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function validatePdf(f: File): string | null {
  const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return "Only PDF files are allowed.";
  if (f.size > MAX_BYTES) return `File is ${formatBytes(f.size)} — max 10 MB.`;
  return null;
}

const btnBase: React.CSSProperties = {
  padding: "0.55rem 1rem",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--text)",
  fontWeight: 500,
  fontSize: "0.9rem",
  transition: "background 0.15s, border-color 0.15s",
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: "var(--accent)",
  borderColor: "var(--accent)",
  color: "#fff",
};

export default function Home() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [msg, setMsg] = useState<string>("");
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "uploads"),
      orderBy("uploadedAt", "desc"),
    );
    return onSnapshot(q, (snap) => {
      setUploads(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            filename: data.filename,
            size: data.size,
            uploadedAt: data.uploadedAt ?? null,
            parsed: data.parsed,
          };
        }),
      );
    });
  }, [user]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  }, [file]);

  function pickFile(f: File | null) {
    setProgress(0);
    if (!f) {
      setFile(null);
      setStatus("idle");
      setMsg("");
      return;
    }
    const err = validatePdf(f);
    if (err) {
      setFile(null);
      setStatus("error");
      setMsg(err);
      return;
    }
    setFile(f);
    setStatus("idle");
    setMsg("");
  }

  async function handleUpload() {
    if (!file || !user) return;
    setStatus("uploading");
    setMsg("");
    setProgress(0);

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("http://localhost:8000/parse", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? `parse failed (HTTP ${res.status})`);
      }
      const parsed: Parsed = await res.json();
      setProgress(100);

      await addDoc(collection(db, "users", user.uid, "uploads"), {
        filename: file.name,
        size: file.size,
        uploadedAt: serverTimestamp(),
        parsed,
      });
      setMsg(`saved ${file.name}`);
      setStatus("done");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "upload failed");
      setStatus("error");
    }
  }

  if (loading || !user) return null;

  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <header style={{ marginBottom: "1.75rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.85rem", fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>
            DARS Upload
          </h1>
          <p style={{ color: "var(--muted)", margin: "0.35rem 0 0", fontSize: "0.95rem" }}>
            Upload your UCLA Degree Audit Report (PDF) to see what's left.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
          {user.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.photoURL}
              alt=""
              referrerPolicy="no-referrer"
              style={{ width: 40, height: 40, borderRadius: "50%", border: "1px solid var(--border)" }}
            />
          ) : (
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--muted)" aria-hidden>
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
          )}
          <div style={{ fontSize: "0.82rem", lineHeight: 1.25 }}>
            {user.displayName && (
              <div style={{ fontWeight: 500, color: "var(--text)" }}>{user.displayName}</div>
            )}
            <div style={{ color: "var(--muted)" }}>{user.email}</div>
            <button
              type="button"
              onClick={() => logout()}
              style={{ ...btnBase, marginTop: "0.35rem", padding: "0.25rem 0.6rem", fontSize: "0.78rem" }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <section
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "1.5rem",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) pickFile(f);
          }}
          style={{
            border: `2px dashed ${drag ? "var(--accent)" : "var(--border)"}`,
            background: drag ? "var(--accent-soft)" : "transparent",
            borderRadius: 8,
            padding: "2rem 1rem",
            textAlign: "center",
            transition: "background 0.15s, border-color 0.15s",
          }}
        >
          {file ? (
            <div>
              <div style={{ fontWeight: 500 }}>{file.name}</div>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "0.2rem" }}>
                {formatBytes(file.size)}
              </div>
              <button
                type="button"
                onClick={() => pickFile(null)}
                style={{
                  ...btnBase,
                  marginTop: "0.85rem",
                  padding: "0.35rem 0.75rem",
                  fontSize: "0.82rem",
                  color: "var(--muted)",
                }}
              >
                Remove
              </button>
            </div>
          ) : (
            <div style={{ color: "var(--muted)" }}>
              <div style={{ fontSize: "1rem", marginBottom: "0.25rem" }}>
                Drag a PDF here
              </div>
              <div style={{ fontSize: "0.85rem" }}>or use the button below · PDF only, max 10 MB</div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: "0.6rem", marginTop: "1.25rem" }}>
          <button type="button" onClick={() => inputRef.current?.click()} style={btnBase}>
            Choose file
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || status === "uploading"}
            style={btnPrimary}
          >
            {status === "uploading" ? "Uploading…" : "Upload"}
          </button>
        </div>

        {status === "uploading" && (
          <div style={{ marginTop: "1.25rem" }}>
            <div
              style={{
                fontSize: "0.82rem",
                color: "var(--muted)",
                marginBottom: "0.35rem",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>Uploading…</span>
              <span>{progress}%</span>
            </div>
            <div style={{ height: 6, background: "var(--border)", borderRadius: 999, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${progress}%`,
                  background: "var(--accent)",
                  transition: "width 0.15s ease-out",
                }}
              />
            </div>
          </div>
        )}

        {status === "done" && msg && (
          <p
            style={{
              marginTop: "1.25rem",
              padding: "0.65rem 0.85rem",
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderRadius: 6,
              color: "var(--success)",
              fontSize: "0.9rem",
            }}
          >
            ✓ {msg}
          </p>
        )}
        {status === "error" && (
          <p
            style={{
              marginTop: "1.25rem",
              padding: "0.65rem 0.85rem",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 6,
              color: "var(--error)",
              fontSize: "0.9rem",
            }}
          >
            ✕ {msg}
          </p>
        )}
      </section>

      {uploads.length > 0 && (
        <section style={{ marginTop: "1.5rem" }}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0 0 0.6rem" }}>Your uploads</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {uploads.map((u) => (
              <li
                key={u.id}
                style={{
                  padding: "0.6rem 0.85rem",
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
              >
                <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {u.filename}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                  {u.uploadedAt && u.uploadedAt.toDate().toLocaleString()}
                </div>
                <div style={{ fontSize: "0.82rem", marginTop: "0.4rem", display: "flex", gap: "0.85rem", flexWrap: "wrap" }}>
                  <span><strong>{u.parsed?.completed?.length ?? 0}</strong> completed</span>
                  <span><strong>{u.parsed?.in_progress?.length ?? 0}</strong> in progress</span>
                  <span><strong>{u.parsed?.remaining?.length ?? 0}</strong> remaining</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {file && previewUrl && (
        <section style={{ marginTop: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.6rem",
            }}
          >
            <h2 style={{ fontSize: "0.95rem", fontWeight: 600, margin: 0 }}>Preview</h2>
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              style={{ ...btnBase, padding: "0.35rem 0.75rem", fontSize: "0.82rem" }}
            >
              {showPreview ? "Hide" : "Show"}
            </button>
          </div>
          {showPreview && (
            <embed
              src={previewUrl}
              type="application/pdf"
              style={{
                width: "100%",
                height: "32rem",
                border: "1px solid var(--border)",
                borderRadius: 8,
                background: "var(--card)",
              }}
            />
          )}
        </section>
      )}
    </main>
  );
}
