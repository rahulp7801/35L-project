import type { User } from "firebase/auth";
import { Button } from "../ui/Button";

type Props = {
  user: User;
  onLogout: () => void;
};

export function UserBadge({ user, onLogout }: Props) {
  return (
    <div className="flex items-center gap-[0.7rem]">
      {user.photoURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.photoURL}
          alt=""
          referrerPolicy="no-referrer"
          className="h-10 w-10 rounded-full border border-border"
        />
      ) : (
        <AvatarFallback />
      )}
      <div className="text-[0.82rem] leading-[1.25]">
        {user.displayName && <div className="font-medium text-text">{user.displayName}</div>}
        <div className="text-muted">{user.email}</div>
        <Button size="sm" onClick={onLogout} className="mt-[0.35rem]">
          Sign out
        </Button>
      </div>
    </div>
  );
}

function AvatarFallback() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-border">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--muted)" aria-hidden>
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    </div>
  );
}
