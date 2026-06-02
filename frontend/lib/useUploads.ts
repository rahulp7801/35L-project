"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { PlannedCourse, Upload } from "./types";

export function useUploads(user: User | null): Upload[] {
  const [uploads, setUploads] = useState<Upload[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "uploads"),
      orderBy("uploadedAt", "desc"),
    );
    return onSnapshot(q, (snap) => {
      setUploads(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            filename: data.filename,
            size: data.size,
            uploadedAt: data.uploadedAt ?? null,
            parsed: data.parsed,
            planned: data.planned ?? [],
          };
        }),
      );
    });
  }, [user]);

  return uploads;
}

export async function deleteUpload(uid: string, uploadId: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "uploads", uploadId));
}

// add or remove a planned course. if it's already in the list, remove it.
export async function togglePlannedCourse(
  uid: string,
  uploadId: string,
  entry: PlannedCourse,
  current: PlannedCourse[],
): Promise<void> {
  let exists = false;
  for (const p of current) {
    if (p.code === entry.code && p.section === entry.section) {
      exists = true;
      break;
    }
  }

  let next: PlannedCourse[];
  if (exists) {
    next = [];
    for (const p of current) {
      if (p.code !== entry.code || p.section !== entry.section) {
        next.push(p);
      }
    }
  } else {
    next = [...current, entry];
  }

  await updateDoc(doc(db, "users", uid, "uploads", uploadId), { planned: next });
}
