"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "uploading" | "done" | "error";

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function fmtNow(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return { date: `${yyyy}.${mm}.${dd}`, time: `${hh}:${mi}` };
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [msg, setMsg] = useState<string>("");
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      // delay revoke so the <embed> has time to swap its src on re-render
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  }, [file]);

  const [fileNo, setFileNo] = useState<string>("F-•••• / DARS");
  const [now, setNow] = useState<{ date: string; time: string }>({ date: "————.——.——", time: "——:——" });

  useEffect(() => {
    const n = Math.floor(Math.random() * 9000 + 1000);
    setFileNo(`F-${n} / DARS`);
    setNow(fmtNow(new Date()));
  }, []);

  function pickFile(f: File | null) {
    setFile(f);
    setStatus("idle");
    setMsg("");
    setProgress(0);
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
          setMsg(data.message ?? "filed.");
        } catch {
          setMsg("filed.");
        }
        setProgress(100);
        setStatus("done");
      } else {
        setMsg(`HTTP ${xhr.status}`);
        setStatus("error");
      }
    });
    xhr.addEventListener("error", () => {
      setMsg("transmission failed");
      setStatus("error");
    });

    xhr.open("POST", "http://localhost:8000/upload");
    xhr.send(fd);
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      {/* corner: form tab + date stamp */}
      <header className="absolute inset-x-0 top-0 z-10 flex items-start justify-between px-6 pt-5 sm:px-10">
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/70">
          <span className="rounded-[2px] border border-ink/50 bg-paper-2/70 px-2 py-1">{fileNo}</span>
          <span className="hidden sm:inline">Bureau of Audits · Intake Desk</span>
        </div>
        <div className="text-right font-mono text-[10px] uppercase tracking-[0.2em] text-ink/70">
          <div>{now.date}</div>
          <div className="text-ink/50">
            {now.time} <span className="blink">▪</span> pacific
          </div>
        </div>
      </header>

      {/* hairline rule under header */}
      <div className="absolute inset-x-6 top-14 h-px bg-ink/15 sm:inset-x-10" />

      {/* vertical rail */}
      <aside className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 lg:block">
        <div className="rotate-180 [writing-mode:vertical-rl] font-mono text-[10px] uppercase tracking-[0.45em] text-ink/40">
          Transmission Channel · Port 8000 · Verified
        </div>
      </aside>

      {/* page */}
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-between px-6 pb-10 pt-24 sm:px-10">
        {/* hero */}
        <section className="fade-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-stamp">
            §01 &nbsp;·&nbsp; Degree Audit Reporting System
          </p>

          <h1 className="mt-6 font-display text-[clamp(2.75rem,11vw,9rem)] font-light leading-[0.88] tracking-tight text-ink">
            <span className="block italic">Degree</span>
            <span className="block">
              Audit<span className="text-stamp">.</span>
              <span className="ml-4 align-middle font-mono text-[0.16em] font-medium uppercase tracking-[0.32em] text-ink/55">
                — intake
              </span>
            </span>
          </h1>

          <p className="mt-7 max-w-xl font-body text-base italic leading-relaxed text-ink/75 sm:text-lg">
            Hand over your DARS report. We file it, read it, and{" "}
            <span className="not-italic underline decoration-gold decoration-2 underline-offset-4">
              tell you what's left.
            </span>
          </p>
        </section>

        {/* drop zone */}
        <section className="fade-up mt-14" style={{ animationDelay: "120ms" }}>
          <div
            className={`relative rounded-[2px] border-[1.5px] ${
              drag ? "border-stamp" : "border-ink/85"
            } bg-paper-2/40 px-6 py-10 transition-colors sm:px-12 sm:py-14`}
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
          >
            {/* registration brackets */}
            <span className="absolute -top-[3px] -left-[3px] h-3 w-3 border-t-2 border-l-2 border-stamp" />
            <span className="absolute -top-[3px] -right-[3px] h-3 w-3 border-t-2 border-r-2 border-stamp" />
            <span className="absolute -bottom-[3px] -left-[3px] h-3 w-3 border-b-2 border-l-2 border-stamp" />
            <span className="absolute -bottom-[3px] -right-[3px] h-3 w-3 border-b-2 border-r-2 border-stamp" />

            <div className="grid items-end gap-10 md:grid-cols-[1fr_auto]">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ink/55">
                  Receptacle · PDF only
                </p>
                <h2 className="mt-3 font-display text-3xl leading-[1.05] sm:text-4xl">
                  {file ? "On the desk:" : "Drop your DARS report here."}
                </h2>

                {file ? (
                  <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-sm">
                    <span className="text-ink">{file.name}</span>
                    <span className="text-ink/55">{formatBytes(file.size)}</span>
                    <button
                      type="button"
                      onClick={() => pickFile(null)}
                      className="text-stamp underline underline-offset-4 hover:text-stamp-deep"
                    >
                      remove
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 max-w-md font-body italic text-ink/65">
                    Drag the file in, or click below. Only PDFs are accepted by the desk clerk.
                  </p>
                )}

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="group inline-flex items-center gap-2 border border-ink bg-paper px-5 py-2.5 font-mono text-xs uppercase tracking-[0.22em] text-ink transition-colors hover:bg-ink hover:text-paper"
                  >
                    <span>Select file</span>
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </button>

                  <input
                    ref={inputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                  />

                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={!file || status === "uploading"}
                    className="inline-flex items-center gap-2 bg-ink px-5 py-2.5 font-mono text-xs uppercase tracking-[0.22em] text-paper transition-colors hover:bg-stamp disabled:cursor-not-allowed disabled:bg-ink/25"
                  >
                    <span>{status === "uploading" ? "Transmitting…" : "Transmit"}</span>
                    <span aria-hidden>▣</span>
                  </button>
                </div>
              </div>

              {/* progress bar */}
              {status === "uploading" && (
                <div className="md:col-span-2">
                  <div className="mb-1.5 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.28em] text-ink/65">
                    <span className="truncate pr-3">Transmitting · {file?.name}</span>
                    <span className="text-stamp">{progress}%</span>
                  </div>
                  <div className="h-[3px] w-full overflow-hidden bg-ink/15">
                    <div
                      className="h-full bg-stamp transition-[width] duration-150 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* oversized serial */}
              <div className="hidden text-right md:block">
                <div className="font-display text-[8rem] leading-none text-ink/10">
                  {String(file ? 1 : 0).padStart(2, "0")}
                </div>
                <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.32em] text-ink/45">
                  files queued
                </div>
              </div>
            </div>

            {/* RECEIVED stamp */}
            {status === "done" && (
              <div
                key={file?.name ?? "stamped"}
                className="stamp-slam pointer-events-none absolute right-4 top-4 select-none sm:right-8 sm:top-8"
              >
                <div className="border-[3px] border-stamp px-5 py-2 text-stamp">
                  <div className="font-display text-3xl font-semibold leading-none tracking-[0.06em]">
                    RECEIVED
                  </div>
                  <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.25em]">
                    {now.date} · {now.time}
                  </div>
                  <div className="max-w-[14rem] truncate font-mono text-[10px] uppercase tracking-[0.2em] opacity-80">
                    {file?.name}
                  </div>
                </div>
              </div>
            )}

            {/* inline pdf preview */}
            {file && previewUrl && (
              <div className="mt-8 border-t border-ink/15 pt-5">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ink/55">
                    Preview ·{" "}
                    <span className="text-ink">{file.name}</span>{" "}
                    <span className="text-ink/45">({formatBytes(file.size)})</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowPreview((v) => !v)}
                    className="font-mono text-[10px] uppercase tracking-[0.28em] text-stamp underline-offset-4 hover:underline"
                  >
                    {showPreview ? "[ hide ]" : "[ show ]"}
                  </button>
                </div>
                {showPreview && (
                  <div className="border border-ink/30 bg-paper">
                    <embed
                      src={previewUrl}
                      type="application/pdf"
                      className="block h-[28rem] w-full sm:h-[34rem]"
                    />
                  </div>
                )}
              </div>
            )}

            {/* ledger / error line */}
            {status === "done" && msg && (
              <p className="mt-7 border-t border-ink/15 pt-4 font-mono text-xs uppercase tracking-[0.22em] text-ink/65">
                ↳ ledger says: <span className="text-ink">{msg}</span>
              </p>
            )}
            {status === "error" && (
              <p className="mt-7 border-t border-stamp/30 pt-4 font-mono text-xs uppercase tracking-[0.2em] text-stamp">
                ▲ transmission failed — {msg}
              </p>
            )}
          </div>
        </section>

        {/* footer metadata strip */}
        <footer
          className="fade-up mt-14 border-t border-ink/15 pt-4"
          style={{ animationDelay: "240ms" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-y-2 font-mono text-[10px] uppercase tracking-[0.3em] text-ink/55">
            <span>Channel · :8000 / upload</span>
            <span className="hidden sm:inline">UCLA · Registrar's Bureau · Unofficial</span>
            <span>For Internal Use ▢ ▢ ▢</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
