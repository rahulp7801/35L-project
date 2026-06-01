"use client";

import { ExplorerTabs } from "../../../components/explore/ExplorerTabs";

// /explore — Course Explorer: lookup-by-course, lookup-by-professor, and a
// filtered "easy electives" browse. Tab strip handles switching between them.
export default function ExplorePage() {
  return (
    <>
      <header className="mb-6">
        <h1 className="m-0 text-2xl font-semibold tracking-tight">Course Explorer</h1>
        <p className="m-0 mt-1 text-[0.9rem] text-muted">
          Search any UCLA course or professor, or browse a department by GPA to
          find easy electives.
        </p>
      </header>
      <ExplorerTabs />
    </>
  );
}
