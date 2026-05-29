type Props = {
  title: string;
  count: number;
  accent: string;
};

export function CardHeader({ title, count, accent }: Props) {
  return (
    <div className="mb-[0.85rem] flex items-baseline justify-between border-b border-border pb-[0.6rem]">
      <h2 className="m-0 text-base font-semibold">{title}</h2>
      <span
        className="rounded-full bg-accent-soft px-[0.55rem] py-[0.15rem] text-[0.78rem] font-semibold"
        style={{ color: accent }}
      >
        {count}
      </span>
    </div>
  );
}
