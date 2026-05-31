"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth";
import { UploadProvider } from "../../lib/upload";
import { Navbar } from "../../components/layout/Navbar";
import { UploadAlerts } from "../../components/layout/UploadAlerts";

// Layout shared by every signed-in route (/, /explore, future authed pages).
// Owns the auth-guard redirect, the navbar, and the global UploadProvider so
// the upload action is reachable from anywhere inside this group.
//
// The group folder is `(authed)` — Next.js route groups don't affect the URL,
// so the children still mount at `/` and `/explore`.
export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <UploadProvider>
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <UploadAlerts />
        {children}
      </main>
    </UploadProvider>
  );
}
