"use client";

import { useRef, useState } from "react";
import { MAX_MB_LABEL } from "../../lib/constants";

type Props = {
  onPick: (file: File | null) => void;
};

export function UploadDropzone({ onPick }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onPick(f);
        }}
        className={`cursor-pointer rounded-lg border-2 border-dashed px-4 py-8 text-center text-muted transition-colors ${
          dragging ? "border-accent bg-accent-soft" : "border-border bg-transparent"
        }`}
      >
        <div className="mb-1 text-base">Drag a PDF here or click to browse</div>
        <div className="text-[0.85rem]">PDF only, max {MAX_MB_LABEL}</div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
    </>
  );
}
