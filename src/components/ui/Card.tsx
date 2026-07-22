import type { ElementType, ComponentPropsWithoutRef } from "react";

type CardProps<T extends ElementType> = { as?: T; className?: string } & Omit<
  ComponentPropsWithoutRef<T>,
  "as" | "className"
>;

export function Card<T extends ElementType = "div">({ as, className = "", ...props }: CardProps<T>) {
  const Component = as ?? "div";
  // .glass = vidro fosco (blur + tinta translúcida + aro de luz), a assinatura visual do app
  // (documento de referência de design). Propaga daqui pra todo card do sistema de uma vez.
  return <Component {...props} className={`glass rounded-2xl ${className}`} />;
}
