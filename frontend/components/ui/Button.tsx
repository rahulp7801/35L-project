import { ButtonHTMLAttributes } from "react";

type Variant = "base" | "primary" | "danger" | "ghost";
type Size = "md" | "sm" | "xs";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const sizeClasses: Record<Size, string> = {
  md: "px-4 py-[0.55rem] text-[0.9rem]",
  sm: "px-[0.6rem] py-[0.3rem] text-[0.78rem]",
  xs: "px-[0.6rem] py-1 text-[0.78rem]",
};

const variantClasses: Record<Variant, string> = {
  base: "bg-card text-text border-border",
  primary: "bg-accent text-white border-accent",
  danger: "bg-card text-error border-border",
  ghost: "bg-transparent text-accent border-transparent",
};

export function Button({
  variant = "base",
  size = "md",
  className = "",
  type = "button",
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-md border font-medium transition-colors ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...rest}
    />
  );
}
