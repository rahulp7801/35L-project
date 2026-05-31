"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "firebase/auth";
import { useAuth } from "../../lib/auth";
import { useUpload } from "../../lib/upload";
import { Button } from "../ui/Button";

// Top-level navigation for the authenticated app. Sticky so it stays in reach
// when the page scrolls; rendered by the (authed) layout only, so login pages
// never see it.

const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/explore", label: "Explore" },
  { href: "/plan", label: "Plan" },
];

// True when the link's href is the current page. "/" must match exactly so it
// doesn't light up while the user is on /explore.
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { openDialog } = useUpload();

  if (!user) return null;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
        <Link
          href="/"
          className="text-[1.05rem] font-semibold tracking-tight text-text"
        >
          DARS Tracker
        </Link>

        <nav aria-label="Primary" className="flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-[0.88rem] transition-colors ${
                  active
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-muted hover:bg-accent-soft/60 hover:text-text"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Button variant="primary" size="sm" onClick={openDialog}>
            Upload PDF
          </Button>
          <NavbarUser user={user} onLogout={logout} />
        </div>
      </div>
    </header>
  );
}

// Compact user marker for the navbar row: avatar + sign-out. The fuller
// UserBadge (with name + email block) is intentionally not reused here — it's
// too tall for a navbar.
function NavbarUser({ user, onLogout }: { user: User; onLogout: () => void }) {
  const title = user.displayName || user.email || "Account";
  return (
    <div className="flex items-center gap-2">
      {user.photoURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.photoURL}
          alt=""
          title={title}
          referrerPolicy="no-referrer"
          className="h-8 w-8 rounded-full border border-border"
        />
      ) : (
        <div
          title={title}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-border text-[0.78rem] font-semibold text-muted"
        >
          {(user.displayName || user.email || "?").slice(0, 1).toUpperCase()}
        </div>
      )}
      <Button size="sm" onClick={onLogout}>
        Sign out
      </Button>
    </div>
  );
}
