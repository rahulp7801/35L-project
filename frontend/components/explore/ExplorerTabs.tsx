"use client";

import { useRef, useState } from "react";
import { CourseGradesCard } from "../grades/CourseGradesCard";
import { InstructorGradesCard } from "../grades/InstructorGradesCard";
import { BrowseCoursesCard } from "../grades/BrowseCoursesCard";
import { CompareProfessorsCard } from "../grades/CompareProfessorsCard";

// Tabbed shell that switches between the three search widgets on /explore.
//
// All three cards stay mounted and are toggled via `hidden`, not unmount, so
// the user's search state (queries, selected course, filter values) is
// preserved when they tab away and back. This is cheap: the cards' only
// at-mount side-effect is BrowseCoursesCard fetching the department list,
// which is module-cached in lib/grades.ts.

type TabId = "course" | "professor" | "compare" | "browse";

const TABS: { id: TabId; label: string; description: string }[] = [
  { id: "course", label: "Course", description: "Look up one course by name" },
  { id: "professor", label: "Professor", description: "Look up an instructor by name" },
  { id: "compare", label: "Compare", description: "Compare A% and distributions across professors" },
  { id: "browse", label: "Browse", description: "Filter for easy electives" },
];

export function ExplorerTabs() {
  const [active, setActive] = useState<TabId>("course");
  const activeDescription = TABS.find((t) => t.id === active)?.description;
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});

  // ARIA-style keyboard nav on the tablist: ←/→ moves and focuses, Home/End
  // jumps to the ends. Matches the WAI-ARIA tabs pattern users expect.
  function onTablistKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const currentIndex = TABS.findIndex((t) => t.id === active);
    let nextIndex = currentIndex;
    if (e.key === "ArrowRight") nextIndex = (currentIndex + 1) % TABS.length;
    else if (e.key === "ArrowLeft") nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = TABS.length - 1;
    else return;
    e.preventDefault();
    const nextTab = TABS[nextIndex];
    setActive(nextTab.id);
    tabRefs.current[nextTab.id]?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Course explorer mode"
        onKeyDown={onTablistKeyDown}
        className="mb-4 flex items-end gap-1 border-b border-border"
      >
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[tab.id] = el;
              }}
              role="tab"
              type="button"
              id={`explorer-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`explorer-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActive(tab.id)}
              className={`relative px-4 py-2 text-[0.9rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                isActive
                  ? "text-accent"
                  : "text-muted hover:text-text"
              }`}
            >
              {tab.label}
              {isActive && (
                <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-t bg-accent" />
              )}
            </button>
          );
        })}
        <span className="ml-auto pb-[0.6rem] text-[0.78rem] text-muted">
          {activeDescription}
        </span>
      </div>

      <TabPanel id="course" active={active}>
        <CourseGradesCard />
      </TabPanel>
      <TabPanel id="professor" active={active}>
        <InstructorGradesCard />
      </TabPanel>
      <TabPanel id="compare" active={active}>
        <CompareProfessorsCard />
      </TabPanel>
      <TabPanel id="browse" active={active}>
        <BrowseCoursesCard />
      </TabPanel>
    </div>
  );
}

function TabPanel({
  id,
  active,
  children,
}: {
  id: TabId;
  active: TabId;
  children: React.ReactNode;
}) {
  const isActive = id === active;
  return (
    <div
      role="tabpanel"
      id={`explorer-panel-${id}`}
      aria-labelledby={`explorer-tab-${id}`}
      hidden={!isActive}
    >
      {children}
    </div>
  );
}
