"use client";

// Global upload state: lifts useFileUpload above any single page so the
// "Upload PDF" button in the navbar can trigger it from anywhere, and the
// post-upload alert can persist across route changes.
//
// Renders the upload dialog and the preview modal as children of the provider,
// so they overlay the entire app via fixed positioning regardless of which
// page is currently mounted.

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./auth";
import { useFileUpload } from "./useFileUpload";
import { UploadDialog } from "../components/upload/UploadDialog";
import { UploadPreviewModal } from "../components/upload/UploadPreviewModal";
import type { UploadStatus } from "./types";

type UploadCtx = {
  openDialog: () => void;
  status: UploadStatus;
  message: string;
  // True while the preview modal is mounted. The global alert banner uses
  // this to suppress itself, since the modal renders the same error inline.
  hasFile: boolean;
  // Surface a transient error from outside the upload flow (e.g. a failed
  // Firestore delete) through the same banner.
  setError: (message: string) => void;
};

const Ctx = createContext<UploadCtx | null>(null);

export function UploadProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const upload = useFileUpload(user);
  const [dialogOpen, setDialogOpen] = useState(false);

  const value: UploadCtx = {
    openDialog: () => setDialogOpen(true),
    status: upload.status,
    message: upload.message,
    hasFile: upload.file !== null,
    setError: upload.setError,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <UploadDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onPick={upload.pickFile}
      />
      {upload.file && (
        <UploadPreviewModal
          file={upload.file}
          status={upload.status}
          progress={upload.progress}
          errorMessage={upload.message}
          onCancel={() => upload.pickFile(null)}
          onUpload={upload.upload}
        />
      )}
    </Ctx.Provider>
  );
}

export function useUpload(): UploadCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUpload must be used inside <UploadProvider>");
  return ctx;
}
