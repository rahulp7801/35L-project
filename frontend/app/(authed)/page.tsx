"use client";

import { useAuth } from "../../lib/auth";
import { useUploads, deleteUpload, togglePlannedCourse } from "../../lib/useUploads";
import { useUpload } from "../../lib/upload";
import { paceForecast } from "../../lib/stats";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { UploadsList } from "../../components/upload/UploadsList";
import { StatStrip } from "../../components/dashboard/StatStrip";
import { ProgressCard } from "../../components/dashboard/ProgressCard";
import { CourseCard } from "../../components/dashboard/CourseCard";
import { OutstandingCard } from "../../components/dashboard/OutstandingCard";
import { GradeDistributionCard } from "../../components/dashboard/GradeDistributionCard";
import { TermTimelineCard } from "../../components/dashboard/TermTimelineCard";
import { ComparisonCard } from "../../components/dashboard/ComparisonCard";
import { WhatIfCard } from "../../components/dashboard/WhatIfCard";
import { PlannedCard, buildKnownUnits } from "../../components/dashboard/PlannedCard";
import type { PlannedCourse } from "../../lib/types";

// Dashboard page: DARS summary, requirement breakdown, and upload history.
// The course explorer lives at /explore now; the navbar's "Upload PDF" button
// drives the upload flow from anywhere.
export default function Dashboard() {
  const { user } = useAuth();
  const uploads = useUploads(user);
  const { openDialog, setError } = useUpload();

  // The (authed) layout guards on user; this is just for the type-narrowing.
  if (!user) return null;

  async function handleDelete(uploadId: string, filename: string) {
    if (!user) return;
    if (!confirm(`Delete "${filename}"? This can't be undone.`)) return;
    try {
      await deleteUpload(user.uid, uploadId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "delete failed");
    }
  }

  const latest = uploads[0];
  const parsed = latest?.parsed;
  const hasSections = !!parsed?.sections && parsed.sections.length > 0;
  let pace = null;
  if (parsed) pace = paceForecast(parsed);

  // turn the flat planned list into lookups the cards below can use
  let plannedList: PlannedCourse[] = [];
  if (latest && latest.planned) plannedList = latest.planned;

  // section title -> set of course codes planned for it
  const plannedBySection = new Map<string, Set<string>>();
  for (const p of plannedList) {
    const set = plannedBySection.get(p.section);
    if (set) {
      set.add(p.code);
    } else {
      plannedBySection.set(p.section, new Set([p.code]));
    }
  }
  // every section that has at least one planned course (for the progress bar)
  const plannedSections = new Set<string>();
  for (const p of plannedList) plannedSections.add(p.section);

  async function handleTogglePlan(section: string, code: string) {
    if (!user || !latest) return;
    try {
      await togglePlannedCourse(user.uid, latest.id, { code, section }, plannedList);
    } catch (e) {
      let msg = "couldn't update plan";
      if (e instanceof Error) msg = e.message;
      setError(msg);
    }
  }

  // PlannedCard's remove button hands us the whole entry, reuse the toggle
  async function handleRemoveFromPlan(entry: PlannedCourse) {
    await handleTogglePlan(entry.section, entry.code);
  }

  return (
    <>
      <header className="mb-6">
        <h1 className="m-0 text-2xl font-semibold tracking-tight">DARS Dashboard</h1>
        <p className="m-0 mt-1 text-[0.9rem] text-muted">
          {parsed
            ? `Latest: ${latest!.filename}`
            : "Upload your UCLA Degree Audit Report to see what's left."}
        </p>
      </header>

      {parsed ? (
        // `grid-cols-1` makes the implicit track `minmax(0, 1fr)` (instead of
        // the default `auto`), so a horizontally-scrolling child like the
        // term timeline can't push the whole column wider than the viewport.
        <div className="grid grid-cols-1 gap-5">
          <StatStrip parsed={parsed} />

          {/* Requirement progress (with pace forecast) + grade distribution.
              Layout collapses to a single column on narrow screens.
              `min-w-0` on grid children stops long inline content (e.g. the
              pace forecast line) from pushing a column wider than its cell. */}
          {hasSections ? (
            <div className="grid gap-5 lg:grid-cols-3">
              <div className="min-w-0 lg:col-span-2">
                <ProgressCard
                  sections={parsed.sections!}
                  pace={pace}
                  plannedSections={plannedSections}
                />
              </div>
              <div className="min-w-0">
                <GradeDistributionCard
                  completed={parsed.completed}
                  cumulativeGpa={parsed.cumulative_gpa?.gpa ?? null}
                />
              </div>
            </div>
          ) : (
            <GradeDistributionCard
              completed={parsed.completed}
              cumulativeGpa={parsed.cumulative_gpa?.gpa ?? null}
            />
          )}

          <TermTimelineCard
            completed={parsed.completed}
            inProgress={parsed.in_progress}
          />

          {parsed.in_progress.length > 0 && (
            <WhatIfCard
              completed={parsed.completed}
              inProgress={parsed.in_progress}
              cumulative={parsed.cumulative_gpa ?? null}
            />
          )}

          {plannedList.length > 0 && (
            <PlannedCard
              planned={plannedList}
              onRemove={handleRemoveFromPlan}
              knownUnits={buildKnownUnits(parsed.completed, parsed.in_progress)}
            />
          )}

          <div className="grid gap-5 lg:grid-cols-3">
            <div className="min-w-0 lg:col-span-2">
              {hasSections ? (
                <OutstandingCard
                  sections={parsed.sections!.filter((s) => s.status === "unfulfilled")}
                  plannedBySection={plannedBySection}
                  onTogglePlan={handleTogglePlan}
                />
              ) : (
                <OutstandingCard
                  remaining={parsed.remaining}
                  plannedBySection={plannedBySection}
                  onTogglePlan={handleTogglePlan}
                />
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-5">
              <CourseCard
                title="Completed"
                accent="var(--success)"
                courses={parsed.completed}
              />
              <CourseCard
                title="In progress"
                accent="var(--accent)"
                courses={parsed.in_progress}
              />
            </div>
          </div>

          <ComparisonCard completed={parsed.completed} />

          <UploadsList uploads={uploads} onDelete={handleDelete} />
        </div>
      ) : (
        <EmptyState onUpload={openDialog} />
      )}
    </>
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
