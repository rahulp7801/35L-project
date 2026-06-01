import { ReactNode } from "react";

type Tone = "success" | "error" | "info";

const tones: Record<Tone, string> = {
  success: "bg-[#ecfdf5] border-[#a7f3d0] text-success",
  error: "bg-[#fef2f2] border-[#fecaca] text-error",
  info: "bg-accent-soft border-[#bfdbfe] text-accent",
};

export function Alert({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <p
      className={`rounded-md border px-[0.85rem] py-[0.65rem] text-[0.9rem] ${tones[tone]}`}
    >
      {children}
    </p>
  );
}
