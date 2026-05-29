import { Button } from "../ui/Button";
import type { Upload } from "../../lib/types";

type Props = {
  uploads: Upload[];
  onDelete: (id: string, filename: string) => void;
};

export function UploadsList({ uploads, onDelete }: Props) {
  if (uploads.length === 0) return null;

  return (
    <section className="mt-6">
      <h2 className="m-0 mb-[0.6rem] text-[0.95rem] font-semibold">Your uploads</h2>
      <ul className="m-0 flex list-none flex-col gap-[0.4rem] p-0">
        {uploads.map((u) => (
          <UploadRow key={u.id} upload={u} onDelete={onDelete} />
        ))}
      </ul>
    </section>
  );
}

function UploadRow({ upload, onDelete }: { upload: Upload; onDelete: Props["onDelete"] }) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-[0.85rem] py-[0.6rem]">
      <div className="min-w-0 flex-1">
        <div className="overflow-hidden text-ellipsis whitespace-nowrap font-medium">
          {upload.filename}
        </div>
        <div className="mt-[0.15rem] text-[0.78rem] text-muted">
          {upload.uploadedAt && upload.uploadedAt.toDate().toLocaleString()}
        </div>
        <div className="mt-[0.4rem] flex flex-wrap gap-[0.85rem] text-[0.82rem]">
          <span>
            <strong>{upload.parsed.completed.length}</strong> completed
          </span>
          <span>
            <strong>{upload.parsed.in_progress.length}</strong> in progress
          </span>
          <span>
            <strong>{upload.parsed.remaining.length}</strong> remaining
          </span>
        </div>
      </div>
      <Button
        size="xs"
        variant="danger"
        onClick={() => onDelete(upload.id, upload.filename)}
        className="flex-shrink-0"
      >
        Delete
      </Button>
    </li>
  );
}
