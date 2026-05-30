"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { useUploads, deleteUpload } from "../lib/useUploads";
import { useFileUpload } from "../lib/useFileUpload";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { UserBadge } from "../components/layout/UserBadge";
import { UploadDialog } from "../components/upload/UploadDialog";
import { UploadPreviewModal } from "../components/upload/UploadPreviewModal";
import { UploadsList } from "../components/upload/UploadsList";
import { StatStrip } from "../components/dashboard/StatStrip";
import { ProgressCard } from "../components/dashboard/ProgressCard";
import { CourseCard } from "../components/dashboard/CourseCard";
import { OutstandingCard } from "../components/dashboard/OutstandingCard";

export default function Home() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const uploads = useUploads(user);
  const upload = useFileUpload(user);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) return null;

  async function handleDelete(uploadId: string, filename: string) {
    if (!user) return;
    if (!confirm(`Delete "${filename}"? This can't be undone.`)) return;
    try {
      await deleteUpload(user.uid, uploadId);
    } catch (e) {
      upload.setError(e instanceof Error ? e.message : "delete failed");
    }
  }

  const latest = uploads[0];
  const parsed = latest?.parsed;
  const hasSections = !!parsed?.sections && parsed.sections.length > 0;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-tight">DARS Dashboard</h1>
          <p className="m-0 mt-1 text-[0.9rem] text-muted">
            {parsed
              ? `Latest: ${latest!.filename}`
              : "Upload your UCLA Degree Audit Report to see what's left."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={() => setDialogOpen(true)}>
            Upload PDF
          </Button>
          <UserBadge user={user} onLogout={logout} />
        </div>
      </header>

      {upload.status === "done" && upload.message && (
        <div className="mb-5">
          <Alert tone="success">✓ {upload.message}</Alert>
        </div>
      )}
      {upload.status === "error" && !upload.file && upload.message && (
        <div className="mb-5">
          <Alert tone="error">✕ {upload.message}</Alert>
        </div>
      )}

      {parsed ? (
        <div className="grid gap-5">
          <StatStrip parsed={parsed} />
          {hasSections && <ProgressCard sections={parsed.sections!} />}
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {hasSections ? (
                <OutstandingCard
                  sections={parsed.sections!.filter((s) => s.status === "unfulfilled")}
                />
              ) : (
                <OutstandingCard remaining={parsed.remaining} />
              )}
            </div>
            <div className="flex flex-col gap-5">
              <div className="min-h-0 flex-1">
                <CourseCard
                  title="Completed"
                  accent="var(--success)"
                  courses={parsed.completed}
                />
              </div>
              <div className="min-h-0 flex-1">
                <CourseCard
                  title="In progress"
                  accent="var(--accent)"
                  courses={parsed.in_progress}
                />
              </div>
            </div>
          </div>
          <UploadsList uploads={uploads} onDelete={handleDelete} />
        </div>
      ) : (
        <EmptyState onUpload={() => setDialogOpen(true)} />
      )}

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
    </main>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <Card className="!py-12 text-center">
      <h2 className="m-0 text-lg font-semibold">No DARS uploaded yet</h2>
      <p className="m-0 mx-auto mt-2 max-w-md text-[0.9rem] text-muted">
        Upload your UCLA Degree Audit Report (PDF) and we&apos;ll break down what
        you&apos;ve completed, what&apos;s in progress, and what&apos;s still outstanding.
      </p>
      <div className="mt-5 flex justify-center">
        <Button variant="primary" onClick={onUpload}>
          Upload DARS PDF
        </Button>
      </div>
    </Card>
  );
}
