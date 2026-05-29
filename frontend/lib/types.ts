import type { Timestamp } from "firebase/firestore";

export type Course = {
  term: string;
  code: string;
  units: number;
  grade: string;
  title: string;
};

export type Needs = {
  units?: number;
  courses?: number;
  sub_groups?: number;
  gpa?: number;
};

export type Remaining = {
  section: string;
  needs_raw: string;
  needs?: Needs;
  eligible?: string;
};

export type SectionNeed = {
  needs_raw: string;
  needs: Needs;
  eligible?: string;
};

export type SectionStatus = "fulfilled" | "in_progress" | "unfulfilled";

export type Section = {
  title: string;
  status: SectionStatus;
  needs: SectionNeed[];
  completed: Course[];
  in_progress: Course[];
};

export type Parsed = {
  completed: Course[];
  in_progress: Course[];
  remaining: Remaining[];
  sections?: Section[];
};

export type Upload = {
  id: string;
  filename: string;
  size: number;
  uploadedAt: Timestamp | null;
  parsed: Parsed;
};

export type UploadStatus = "idle" | "uploading" | "done" | "error";
