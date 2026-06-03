"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { MAX_BYTES, MAX_MB_LABEL, PARSE_ENDPOINT } from "./constants";
import { formatBytes } from "./format";
import type { Parsed, UploadStatus } from "./types";

type State = {
  file: File | null;
  status: UploadStatus;
  message: string;
};

const INITIAL: State = { file: null, status: "idle", message: "" };

export function useFileUpload(user: User | null) {
  const [state, setState] = useState<State>(INITIAL);

  function pickFile(f: File | null) {
    if (!f) {
      setState(INITIAL);
      return;
    }
    const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setState({ ...INITIAL, status: "error", message: "Only PDF files are allowed." });
      return;
    }
    if (f.size > MAX_BYTES) {
      setState({
        ...INITIAL,
        status: "error",
        message: `File is ${formatBytes(f.size)} — max ${MAX_MB_LABEL}.`,
      });
      return;
    }
    setState({ ...INITIAL, file: f });
  }

  async function upload() {
    if (!state.file || !user) return;
    const file = state.file;
    setState((s) => ({ ...s, status: "uploading", message: "" }));

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(PARSE_ENDPOINT, { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? `parse failed (HTTP ${res.status})`);
      }
      const parsed: Parsed = await res.json();

      await addDoc(collection(db, "users", user.uid, "uploads"), {
        filename: file.name,
        size: file.size,
        uploadedAt: serverTimestamp(),
        parsed,
      });
      setState({ file: null, status: "done", message: `saved ${file.name}` });
    } catch (e) {
      setState((s) => ({
        ...s,
        status: "error",
        message: e instanceof Error ? e.message : "upload failed",
      }));
    }
  }

  function setError(message: string) {
    setState((s) => ({ ...s, status: "error", message }));
  }

  return { ...state, pickFile, upload, setError };
}
