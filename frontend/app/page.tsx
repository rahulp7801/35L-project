"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "uploading" | "done" | "error";

type Course = {
  term: string;
  code: string;
  units: number;
  grade: string;
  title: string;
};

type Remaining = { section: string; needs_raw: string; eligible: string };

type Parsed = {
  completed: Course[];
  in_progress: Course[];
  remaining: Remaining[];
};

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
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
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [msg, setMsg] = useState<string>("");
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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
    setFile(f);
    setStatus("idle");
    setMsg("");
    setProgress(0);
    setParsed(null);
  }

  function handleUpload() {
    if (!file) return;
    setStatus("uploading");
    setMsg("");
    setProgress(0);

    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append("file", file);

    xhr.upload.addEventListener("progress", (ev) => {
      if (ev.lengthComputable) {
        setProgress(Math.round((ev.loaded / ev.total) * 100));
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          setMsg(data.message ?? "uploaded");
          if (data.completed && data.in_progress && data.remaining) {
            setParsed({
              completed: data.completed,
              in_progress: data.in_progress,
              remaining: data.remaining,
            });
          }
        } catch {
          setMsg("uploaded");
        }
        setProgress(100);
        setStatus("done");
      } else {
        setMsg(`HTTP ${xhr.status}`);
        setStatus("error");
      }
    });
    xhr.addEventListener("error", () => {
      setMsg("upload failed");
      setStatus("error");
    });

    xhr.open("POST", "http://localhost:8000/upload");
    xhr.send(fd);
  }

  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <header style={{ marginBottom: "1.75rem" }}>
        <h1 style={{ fontSize: "1.85rem", fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>
          DARS Upload
        </h1>
        <p style={{ color: "var(--muted)", margin: "0.35rem 0 0", fontSize: "0.95rem" }}>
          Upload your UCLA Degree Audit Report (PDF) to see what's left.
        </p>
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
            if (f && (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"))) {
              pickFile(f);
            }
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
              <div style={{ fontSize: "0.85rem" }}>or use the button below</div>
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

      {parsed && (
        <section style={{ marginTop: "1.5rem", display: "grid", gap: "1.25rem" }}>
          <CourseCard
            title="Completed"
            count={parsed.completed.length}
            accent="var(--success)"
            courses={parsed.completed}
          />
          <CourseCard
            title="In progress"
            count={parsed.in_progress.length}
            accent="var(--accent)"
            courses={parsed.in_progress}
          />
          <RemainingCard remaining={parsed.remaining} />
        </section>
      )}
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "1.25rem 1.5rem",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};

function CardHeader({ title, count, accent }: { title: string; count: number; accent: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: "0.85rem",
        paddingBottom: "0.6rem",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <h2 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>{title}</h2>
      <span
        style={{
          fontSize: "0.78rem",
          fontWeight: 600,
          color: accent,
          background: "var(--accent-soft)",
          padding: "0.15rem 0.55rem",
          borderRadius: 999,
        }}
      >
        {count}
      </span>
    </div>
  );
}

function CourseCard({
  title,
  count,
  accent,
  courses,
}: {
  title: string;
  count: number;
  accent: string;
  courses: Course[];
}) {
  return (
    <div style={cardStyle}>
      <CardHeader title={title} count={count} accent={accent} />
      {courses.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: 0 }}>Nothing here yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.5rem" }}>
          {courses.map((c, i) => (
            <li
              key={`${c.term}-${c.code}-${i}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "0.75rem",
                fontSize: "0.9rem",
              }}
            >
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ color: "var(--muted)", marginRight: "0.4rem" }}>{c.term}</span>
                <span style={{ fontWeight: 500 }}>{c.code}</span>
                <span style={{ color: "var(--muted)", marginLeft: "0.5rem" }}>{c.title}</span>
              </span>
              <span
                style={{
                  flexShrink: 0,
                  fontWeight: 600,
                  color: accent,
                  fontSize: "0.85rem",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {c.grade}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RemainingCard({ remaining }: { remaining: Remaining[] }) {
  return (
    <div style={cardStyle}>
      <CardHeader title="Outstanding" count={remaining.length} accent="var(--error)" />
      {remaining.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: 0 }}>All requirements satisfied.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.85rem" }}>
          {remaining.map((r, i) => (
            <li
              key={i}
              style={{
                padding: "0.75rem 0.85rem",
                background: "var(--accent-soft)",
                border: "1px solid var(--border)",
                borderRadius: 8,
              }}
            >
              <p style={{ margin: 0, fontWeight: 600, fontSize: "0.92rem" }}>{r.section}</p>
              <p
                style={{
                  margin: "0.3rem 0 0",
                  fontSize: "0.8rem",
                  color: "var(--error)",
                  fontWeight: 500,
                }}
              >
                Needs · {r.needs_raw}
              </p>
              {r.eligible && (
                <p
                  style={{
                    margin: "0.45rem 0 0",
                    fontSize: "0.82rem",
                    color: "var(--muted)",
                    lineHeight: 1.45,
                    fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                  }}
                >
                  <span style={{ color: "var(--text)", fontWeight: 500 }}>From: </span>
                  {r.eligible}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
