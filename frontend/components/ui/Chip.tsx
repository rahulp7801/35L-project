export function Chip({ label }: { label: string }) {
  return (
    <span className="inline-block rounded-full border border-border bg-accent-soft px-[0.6rem] py-[0.2rem] text-[0.78rem] font-medium text-text">
      {label}
    </span>
  );
}
