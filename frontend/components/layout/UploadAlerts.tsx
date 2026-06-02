"use client";

import { Alert } from "../ui/Alert";
import { useUpload } from "../../lib/upload";

// Global "✓ saved file.pdf" / "✕ upload failed" banner shown above page content
// after the upload modal has closed. While the modal is mounted it shows the
// same error inline, so we suppress the banner via `hasFile` to avoid double
// reporting.
export function UploadAlerts() {
  const { status, message, hasFile } = useUpload();

  if (status === "done" && message) {
    return (
      <div className="mb-5">
        <Alert tone="success">✓ {message}</Alert>
      </div>
    );
  }
  if (status === "error" && !hasFile && message) {
    return (
      <div className="mb-5">
        <Alert tone="error">✕ {message}</Alert>
      </div>
    );
  }
  return null;
}
