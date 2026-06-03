"use client";

import { useEffect, useMemo } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { formatBytes } from "../../lib/format";
import type { UploadStatus } from "../../lib/types";

type Props = {
  file: File;
  status: UploadStatus;
  progress: number;
  errorMessage: string;
  onCancel: () => void;
  onUpload: () => void;
};

export function UploadPreviewModal({
  file,
  status,
  progress,
  errorMessage,
  onCancel,
  onUpload,
}: Props) {
  const previewUrl = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => {
    // Delay revoke so the <embed> doesn't tear down mid-render.
    return () => {
      setTimeout(() => URL.revokeObjectURL(previewUrl), 1000);
    };
  }, [previewUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && status !== "uploading") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => {
        if (status !== "uploading") onCancel();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(15, 23, 42, 0.55)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-[760px] flex-col overflow-hidden rounded-xl bg-card shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
      >
        <header className="border-b border-border px-5 py-4">
          <div className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold">
            {file.name}
          </div>
          <div className="mt-[0.15rem] text-[0.8rem] text-muted">{formatBytes(file.size)}</div>
        </header>

        <embed
          src={previewUrl}
          type="application/pdf"
          className="min-h-[50vh] w-full flex-1 bg-bg"
        />

        <footer className="flex flex-col gap-3 border-t border-border px-5 py-4">
          {status === "error" && errorMessage && (
            <Alert tone="error">✕ {errorMessage}</Alert>
          )}

          {status === "uploading" && <UploadProgressBar progress={progress} />}

          <div className="flex justify-end gap-[0.6rem]">
            <Button onClick={onCancel} disabled={status === "uploading"}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={onUpload}
              disabled={status === "uploading"}
            >
              {status === "uploading"
                ? "Uploading…"
                : status === "error"
                ? "Retry upload"
                : "Upload"}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function UploadProgressBar({ progress }: { progress: number }) {
  return (
    <div>
      <div className="mb-[0.35rem] flex justify-between text-[0.82rem] text-muted">
        <span>Uploading…</span>
        <span>{progress}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-border">
        <div
          className="h-full bg-accent transition-[width] duration-150 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
