import { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement>;

export function TextField({ className = "", ...rest }: Props) {
  return (
    <input
      className={`w-full rounded-md border border-border bg-card px-[0.7rem] py-[0.55rem] text-[0.95rem] text-text ${className}`}
      {...rest}
    />
  );
}
