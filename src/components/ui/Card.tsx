import type { ElementType, ComponentPropsWithoutRef } from "react";

type CardProps<T extends ElementType> = { as?: T; className?: string } & Omit<
  ComponentPropsWithoutRef<T>,
  "as" | "className"
>;

export function Card<T extends ElementType = "div">({ as, className = "", ...props }: CardProps<T>) {
  const Component = as ?? "div";
  return <Component {...props} className={`rounded-2xl border border-border bg-surface ${className}`} />;
}
