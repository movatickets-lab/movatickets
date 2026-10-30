import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const button = cva("inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50", {
  variants: {
    variant: { primary: "bg-brand text-white hover:bg-brand-dark", outline: "border border-brand text-brand hover:bg-brand-soft", ghost: "text-cocoa hover:bg-mist", danger: "bg-danger text-white hover:opacity-90" },
    size: { md: "px-4 py-2.5 text-sm", lg: "px-5 py-3 text-base", sm: "px-3 py-1.5 text-sm" },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

export function Button({ className, variant, size, type = "button", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>) {
  return <button type={type} className={cn(button({ variant, size }), className)} {...p} />;
}
