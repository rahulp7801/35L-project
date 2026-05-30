"use client";

import { useEffect } from "react";
import { UploadDropzone } from "./UploadDropzone";

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (file: File | null) => void;
};

export function UploadDialog({ open, onClose, onPick }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-dialog-title"
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-center justify-center p-6"
      style={{ background: "rgba(15, 23, 42, 0.55)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[520px] rounded-xl bg-card p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
      >
        <header className="mb-4 flex items-center justify-between">
          <h2 id="upload-dialog-title" className="m-0 text-base font-semibold">
            Upload DARS PDF
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="border-none bg-transparent text-xl leading-none text-muted"
          >
            ×
          </button>
        </header>
        <UploadDropzone
          onPick={(f) => {
            onPick(f);
            if (f) onClose();
          }}
        />
      </div>
    </div>
  );
}
