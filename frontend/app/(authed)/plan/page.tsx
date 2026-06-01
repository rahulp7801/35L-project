"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../lib/auth";
import { useUploads } from "../../../lib/useUploads";
import {
  buildPlanRequest,
  fetchPlan,
  planRequestSummary,
  type PlanResponse,
} from "../../../lib/planner";
import { Card } from "../../../components/ui/Card";
import { Alert } from "../../../components/ui/Alert";
import { QuarterCard } from "../../../components/plan/QuarterCard";

// /plan — Multi-quarter recommendation map driven by POST /plan.
//
// Owns: pulling the user's latest parsed DARS upload, building the request,
// firing it, rendering the per-quarter result. Keeps logic shallow — all
// scoring + pass-splitting happens server-side in backend/planner.py.
export default function PlanPage() {
  const { user } = useAuth();
  const uploads = useUploads(user);
  const latest = uploads[0];
  const parsed = latest?.parsed;

  // The request only depends on the upload identity; memo the build so the
  // effect doesn't re-fire on every render of the page.
  const request = useMemo(() => (parsed ? buildPlanRequest(parsed) : null), [parsed]);
  const summary = request ? planRequestSummary(request) : null;

  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!request) {
      setPlan(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setError("");
    fetchPlan(request)
      .then((r) => alive && setPlan(r))
      .catch((e) =>
        alive && setError(e instanceof Error ? e.message : "plan failed"),
      )
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [request]);

  if (!user) return null;

  return (
    <>
      <header className="mb-6">
        <h1 className="m-0 text-2xl font-semibold tracking-tight">Course Plan</h1>
        <p className="m-0 mt-1 text-[0.9rem] text-muted">
          A quarter-by-quarter recommendation that fills your outstanding
          requirements, ranked by historical GPA, split into first-pass and
          second-pass picks.
        </p>
      </header>

      {!parsed && <NoUploadState />}

      {parsed && summary && (
        <p className="m-0 mb-4 text-[0.85rem] text-muted">
          Building a plan from{" "}
          <strong className="text-text">{summary.requirements}</strong>{" "}
          outstanding requirement{summary.requirements === 1 ? "" : "s"} (
          {summary.candidates} candidate course
          {summary.candidates === 1 ? "" : "s"}). Starting from{" "}
          <strong className="text-text">{request?.start_term}</strong>.
        </p>
      )}

      {parsed && <Disclaimer />}

      {loading && <PlanSkeleton />}

      {error && !loading && (
        <Alert tone="error">Couldn&apos;t build a plan: {error}</Alert>
      )}

      {plan && !loading && !error && <PlanBody plan={plan} />}
    </>
  );
}

function NoUploadState() {
  return (
    <Card className="!py-12 text-center">
      <h2 className="m-0 text-lg font-semibold">No DARS uploaded yet</h2>
      <p className="m-0 mx-auto mt-2 max-w-md text-[0.9rem] text-muted">
        Upload your DARS PDF on the dashboard first — the plan reads your
        outstanding requirements from it.
      </p>
    </Card>
  );
}

function Disclaimer() {
  return (
    <div className="mb-5">
      <Alert tone="info">
        This plan doesn&apos;t
        know which sections will actually be offered next term, and can&apos;t
        see real enrollment caps. Treat it as a starting point and verify with
        your advisor.
      </Alert>
    </div>
  );
}

function PlanBody({ plan }: { plan: PlanResponse }) {
  const { quarters, unsatisfied, config } = plan;
  return (
    <div className="grid grid-cols-1 gap-5">
      {quarters.length === 0 && (
        <Card>
          <p className="m-0 text-[0.9rem] text-muted">
            Nothing left to recommend — looks like every outstanding requirement
            is satisfied by your in-progress or completed courses.
          </p>
        </Card>
      )}

      {quarters.map((q) => (
        <QuarterCard key={q.term_code} quarter={q} firstPassCap={config.first_pass_cap} />
      ))}

      {unsatisfied.length > 0 && (
        <Card>
          <h2 className="m-0 mb-[0.5rem] text-base font-semibold text-error">
            Couldn&apos;t fully cover
          </h2>
          <p className="m-0 mb-[0.5rem] text-[0.85rem] text-muted">
            These requirements ran out of eligible candidates before
            satisfying their NEEDS count, or hit the {config.max_quarters}-quarter cap.
          </p>
          <ul className="m-0 grid list-none gap-[0.3rem] p-0 text-[0.88rem]">
            {unsatisfied.map((u, i) => (
              <li key={i} className="flex items-baseline justify-between gap-2">
                <span>{u.title}</span>
                <span className="shrink-0 text-muted">
                  still needs {u.still_needed}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

// Two-quarter-card skeleton; the real list is usually 1-6 cards so this is
// representative enough to avoid layout shift when the response lands.
function PlanSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5">
      {[0, 1].map((i) => (
        <Card key={i}>
          <div className="mb-4 h-5 w-32 animate-pulse rounded bg-border" />
          <div className="mb-2 h-3 w-24 animate-pulse rounded bg-border" />
          <div className="space-y-2">
            <div className="h-10 animate-pulse rounded bg-border" />
            <div className="h-10 animate-pulse rounded bg-border" />
            <div className="h-10 animate-pulse rounded bg-border" />
          </div>
        </Card>
      ))}
    </div>
  );
}
