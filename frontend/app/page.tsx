"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { useUploads, deleteUpload } from "../lib/useUploads";
import { useFileUpload } from "../lib/useFileUpload";
import { Alert } from "../components/ui/Alert";
import { UserBadge } from "../components/layout/UserBadge";
import { UploadDropzone } from "../components/upload/UploadDropzone";
import { UploadPreviewModal } from "../components/upload/UploadPreviewModal";
import { UploadsList } from "../components/upload/UploadsList";
import { ProgressCard } from "../components/dashboard/ProgressCard";
import { CourseCard } from "../components/dashboard/CourseCard";
import { OutstandingCard } from "../components/dashboard/OutstandingCard";

export default function Home() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const uploads = useUploads(user);
  const upload = useFileUpload(user);

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
    <main className="mx-auto max-w-[680px] px-5 py-12">
      <header className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h1 className="m-0 text-[1.85rem] font-semibold tracking-tight">DARS Upload</h1>
          <p className="m-0 mt-[0.35rem] text-[0.95rem] text-muted">
            Upload your UCLA Degree Audit Report (PDF) to see what&apos;s left.
          </p>
        </div>
        <UserBadge user={user} onLogout={logout} />
      </header>

      <section className="rounded-[10px] border border-border bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <UploadDropzone onPick={upload.pickFile} />

        {upload.status === "done" && upload.message && (
          <div className="mt-5">
            <Alert tone="success">✓ {upload.message}</Alert>
          </div>
        )}
        {upload.status === "error" && !upload.file && (
          <div className="mt-5">
            <Alert tone="error">✕ {upload.message}</Alert>
          </div>
        )}
      </section>

      {parsed && (
        <section className="mt-6 grid gap-5">
          {hasSections && <ProgressCard sections={parsed.sections!} />}
          <CourseCard title="Completed" accent="var(--success)" courses={parsed.completed} />
          <CourseCard title="In progress" accent="var(--accent)" courses={parsed.in_progress} />
          {hasSections ? (
            <OutstandingCard
              sections={parsed.sections!.filter((s) => s.status === "unfulfilled")}
            />
          ) : (
            <OutstandingCard remaining={parsed.remaining} />
          )}
        </section>
      )}

      <UploadsList uploads={uploads} onDelete={handleDelete} />

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
