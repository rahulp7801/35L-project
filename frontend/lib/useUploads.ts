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
} from "firebase/firestore";
import { db } from "./firebase";
import type { Upload } from "./types";

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
